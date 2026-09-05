import type { EventItem, Goods, Place } from '@/types'
import { apiGet, apiGetAll, ApiFailure } from './http'
import { PAGE_SIZE } from './config'

/**
 * 행사 카탈로그를 받아 `EventItem` 으로 옮긴다.
 *
 * **응답 모양이 계약과 다르면 여기서만 고친다.** 화면 코드는 `EventItem`
 * 만 알고, 서버가 무슨 모양으로 주는지는 이 파일 밖으로 나가지 않는다.
 *
 * 계약: 위키 `02-설계-아키텍처/화면-계약.md` 1장
 *
 * ─────────────────────────────────────────────────────────
 * **틀리면 조용히 넘기지 않고 던진다.**
 *
 * 빈 값을 채워 넘기면 화면에 회색 카드가 뜨고, 데이터가 없는 건지
 * 모양이 어긋난 건지 알 수가 없다. 빌드가 그 자리에서 멈추고 어느
 * 필드가 어떻게 어긋났는지 말하게 한다. 재검증에서 터지면 Next 가 직전
 * 정적 페이지를 그대로 내보내므로 사용자는 옛 목록을 본다.
 */

/** 서버가 주는 그대로. 아직 확정되지 않은 자리는 둘 다 받아둔다 */
interface WireEvent {
  id?: unknown
  externalId?: unknown
  place?: unknown
  placeName?: unknown
  regionId?: unknown
  region?: unknown
  district?: unknown
  goods?: unknown
  [k: string]: unknown
}

function fail(field: string, why: string): never {
  throw new ApiFailure(
    'CONTRACT_MISMATCH',
    `행사 응답이 계약과 다릅니다 — ${field}: ${why}. ` +
      '위키 02-설계-아키텍처/화면-계약.md 의 「행사」 를 보고 맞춘다.',
    0,
  )
}

function str(v: unknown, field: string): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return fail(field, `문자열이어야 하는데 ${typeof v} 다`)
}

function num(v: unknown, field: string): number {
  if (typeof v === 'number') return v
  /* DECIMAL(10,7) 이 문자열로 오는 드라이버가 있다. 좌표는 숫자여야 지도가 쓴다 */
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return fail(field, `숫자여야 하는데 ${JSON.stringify(v)} 다`)
}

function toPlace(w: WireEvent): Place {
  if (w.place === null || w.place === undefined) {
    /* 엔티티가 place_name 처럼 평탄해서 그대로 나온 경우다 */
    if (w.placeName !== undefined) {
      fail('place', '중첩 객체가 아니라 평탄하게 왔다')
    }
    fail('place', '없다')
  }
  if (typeof w.place !== 'object') fail('place', `객체여야 하는데 ${typeof w.place} 다`)

  const p = w.place as Record<string, unknown>

  /* 지역은 코드 문자열이라야 필터가 돈다 */
  const district = p.district ?? w.district ?? w.region
  if (district === undefined || district === null) {
    if (w.regionId !== undefined || p.regionId !== undefined) {
      fail('place.district', 'regionId 숫자만 왔다. 코드 문자열이 있어야 지역 필터가 돈다')
    }
    fail('place.district', '없다')
  }

  return {
    name: str(p.name, 'place.name'),
    address: str(p.address, 'place.address'),
    lat: num(p.lat, 'place.lat'),
    lng: num(p.lng, 'place.lng'),
    district: str(district, 'place.district') as Place['district'],
    kind: str(p.kind, 'place.kind') as Place['kind'],
  }
}

function toGoods(v: unknown): Goods[] | undefined {
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v)) fail('goods', '배열이 아니다')

  return v.map((raw, i) => {
    const g = raw as Record<string, unknown>
    /* 컨벤션은 is 접두어 금지라 서버가 random 으로 줄 수 있다 */
    const random = g.isRandom ?? g.random
    if (typeof random !== 'boolean') fail(`goods[${i}].isRandom`, '불리언이 아니다')
    return {
      id: str(g.id ?? `${i}`, `goods[${i}].id`),
      name: str(g.name, `goods[${i}].name`),
      isRandom: random,
      sortOrder: typeof g.sortOrder === 'number' ? g.sortOrder : i,
    }
  })
}

export function toEventItem(raw: unknown): EventItem {
  if (raw === null || typeof raw !== 'object') fail('event', '객체가 아니다')
  const w = raw as WireEvent

  /*
   * 주소가 이 값에 걸린다.
   *
   * PK 숫자가 오면 `/e/1` 이 되어 지금 색인된 205개 주소가 전부 죽는다.
   * externalId 가 함께 오면 그쪽을 쓴다 — 도메인 4장이 "URL 은 외부
   * 식별자로 관리한다" 이고 크롤러 upsert 기준도 그것이다 (NF-11).
   */
  const id = w.externalId !== undefined && w.externalId !== null ? w.externalId : w.id
  if (id === undefined || id === null) fail('id', '없다')

  return {
    ...(w as unknown as EventItem),
    id: str(id, 'id'),
    place: toPlace(w),
    goods: toGoods(w.goods),
  }
}

/** 목록 전부. 빌드·재검증이 정적 페이지를 만들 때 쓴다 */
export async function fetchAllEvents(): Promise<EventItem[]> {
  const items = await apiGetAll<unknown>('/api/v1/events', { size: PAGE_SIZE })
  return items.map(toEventItem)
}

/** 상세 한 건 */
export async function fetchEvent(id: string): Promise<EventItem> {
  return toEventItem(await apiGet<unknown>(`/api/v1/events/${encodeURIComponent(id)}`))
}
