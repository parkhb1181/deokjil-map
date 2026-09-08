/**
 * KOPIS(공연예술통합전산망) 오픈API 수집기, 콘서트.
 *
 * **공식 오픈API 다.** 크롤링이 아니라 인증키로 받는다. 그래서 robots.txt 판정이
 * 해당하지 않고(`run.mjs` 가 이 소스만 게이트를 건너뛴다), 대신 **일일 호출 한도**가
 * 있어 수집 상한을 그 안에서 잡는다.
 *
 * 세 번 부른다. 목록에는 좌표도 시설 식별자도 없다.
 *
 *   공연목록   /pblprfr             → mt20id · 공연명 · 기간 · 지역 · 장르
 *   공연상세   /pblprfr/{mt20id}    → mt10id · dtguidance(회차) · prfcast · 예매처
 *   공연시설상세 /prfplc/{mt10id}   → la · lo · adres
 *
 * **좌표가 시설상세에만 있다.** 팝가·오프메이트는 레코드에 좌표가 들어 있어
 * 지오코딩이 필요 없었는데, 여기도 결과적으로 필요 없다 — 대신 호출이 한 단 늘었다.
 * 같은 공연장에서 여러 공연이 열리므로 시설 응답은 mt10id 로 캐시한다.
 *
 * 서울·대중음악은 요청 파라미터로 좁힌다. 응답에도 area·genrenm 이 실려 오지만
 * 전국 전 장르를 받아서 버리면 호출 한도를 그만큼 태운다.
 *
 * 정규화·필터는 to-events.mjs 가 맡는다. 여기서는 KOPIS 필드명과 값을 그대로 둔다 —
 * 날짜의 `2026.10.10` 도, 회차 문자열도 손대지 않는다.
 */
import { fetchText } from '../lib/http.mjs'

/** API 는 http 만 응답한다. https 는 301 이고 리다이렉트를 따라가도 API 가 아니다 */
export const ORIGIN = 'http://www.kopis.or.kr'
const API = `${ORIGIN}/openApi/restful`

/** 사용자에게 보여줄 공개 상세 페이지. 이쪽은 https 가 정본이다 (www 없이) */
const DETAIL_PAGE = 'https://kopis.or.kr/por/db/pblprfr/pblprfrView.do?mt20Id='

/** 대중음악. 아이돌 콘서트가 이 장르로 등록된다 */
const GENRE_POP = 'CCCD'
/** 서울특별시 */
const SIGNGU_SEOUL = '11'

/** 한 페이지 최대. 100 이 먹는 것을 확인했다 */
const ROWS = 100

function serviceKey() {
  const key = process.env.KOPIS_SERVICE_KEY
  if (!key) {
    throw new Error(
      'KOPIS_SERVICE_KEY 가 없다. 로컬은 --env-file=.env.local 로 넘기고 CI 는 Actions 시크릿을 쓴다',
    )
  }
  return key
}

/**
 * XML 파서를 따로 두지 않는다.
 *
 * 응답이 평평한 태그 나열이고 필요한 필드가 스무 개 남짓이다. 의존성을 하나 더
 * 얹는 대신 태그 이름으로 잘라낸다. 크롤러가 node 내장만 쓰는 이유와 같다.
 */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

function decode(text) {
  return text.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, e) => ENTITIES[e])
}

/** `<db>` 블록들을 잘라낸다. 목록·상세·시설상세가 모두 이 껍데기를 쓴다 */
function blocks(xml) {
  return [...xml.matchAll(/<db>([\s\S]*?)<\/db>/g)].map((m) => m[1])
}

/** 첫 번째 값만 쓴다. 중첩 블록(mt13s · relates) 안의 동명 태그를 함께 긁지 않도록 */
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  if (!m) return null
  const value = decode(m[1]).trim()
  return value || null
}

async function getXml(url) {
  const res = await fetchText(url, { timeoutMs: 30_000 })
  if (!res.ok) return { ok: false, status: res.status, error: res.error }
  return { ok: true, xml: res.text }
}

/** `YYYYMMDD`. 목록 API 의 기간 파라미터 형식이다 */
function ymd(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

/**
 * 공연목록을 순회한다.
 *
 * **`totalCount` 가 응답에 없다.** 그래서 100 미만이 오는 페이지를 끝으로 본다.
 *
 * `days` 의 뜻이 팝가·오프메이트와 다르다. 저쪽은 사이트맵 `lastmod` 기준으로
 * "최근에 갱신된 것"을 고르는데, KOPIS 는 **공연 기간**으로 검색한다. 그래서
 * 오늘부터 days 일 안에 열리는 공연이 대상이다.
 */
export async function listConcerts({ days = 90, limit = 700 } = {}) {
  const key = serviceKey()
  const today = new Date()
  const until = new Date(today.getTime() + days * 86_400_000)

  const entries = []
  for (let page = 1; ; page++) {
    const url =
      `${API}/pblprfr?service=${key}` +
      `&stdate=${ymd(today)}&eddate=${ymd(until)}` +
      `&cpage=${page}&rows=${ROWS}` +
      `&shcate=${GENRE_POP}&signgucode=${SIGNGU_SEOUL}`

    const res = await getXml(url)
    if (!res.ok) throw new Error(`공연목록을 읽지 못했다: ${res.status} ${res.error ?? ''}`)

    const rows = blocks(res.xml)
    for (const b of rows) {
      const mt20id = tag(b, 'mt20id')
      if (!mt20id) continue
      entries.push({
        mt20id,
        title: tag(b, 'prfnm'),
        openDate: tag(b, 'prfpdfrom'),
        closeDate: tag(b, 'prfpdto'),
        facility: tag(b, 'fcltynm'),
        poster: tag(b, 'poster'),
        area: tag(b, 'area'),
        genre: tag(b, 'genrenm'),
        state: tag(b, 'prfstate'),
      })
    }

    if (rows.length < ROWS || entries.length >= limit) break
  }

  return entries.slice(0, limit)
}

/** 공연시설상세. 좌표와 주소가 여기 있다 */
async function fetchFacility(mt10id, key) {
  const res = await getXml(`${API}/prfplc/${mt10id}?service=${key}`)
  if (!res.ok) return null

  const b = blocks(res.xml)[0]
  if (!b) return null

  const lat = Number(tag(b, 'la'))
  const lng = Number(tag(b, 'lo'))
  return {
    name: tag(b, 'fcltynm'),
    address: tag(b, 'adres'),
    // 좌표가 비어 오면 숫자가 아니다. 지도에 못 찍으므로 to-events 가 걸러낸다
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    seatScale: tag(b, 'seatscale'),
  }
}

/**
 * 공연상세 + 시설상세를 한 레코드로 합친다.
 *
 * `relates` 안의 `relateurl` 이 예매처다. 시설상세에도 같은 이름의 태그가 있는데
 * 그것은 공연장 홈페이지다 — 섞으면 「예매하기」 가 공연장 대문으로 간다.
 */
export async function fetchConcert(entry, facilityCache) {
  const key = serviceKey()
  const res = await getXml(`${API}/pblprfr/${entry.mt20id}?service=${key}`)
  if (!res.ok) {
    return { mt20id: entry.mt20id, ok: false, status: res.status, error: res.error }
  }

  const b = blocks(res.xml)[0]
  if (!b) return { mt20id: entry.mt20id, ok: false, status: 200, error: '상세가 비어 있다' }

  const mt10id = tag(b, 'mt10id')
  let facility = null
  if (mt10id) {
    if (!facilityCache.has(mt10id)) facilityCache.set(mt10id, await fetchFacility(mt10id, key))
    facility = facilityCache.get(mt10id)
  }

  const relates = b.match(/<relates>([\s\S]*?)<\/relates>/)
  const reservation = relates ? tag(relates[1], 'relateurl') : null

  return {
    mt20id: entry.mt20id,
    ok: true,
    record: {
      source: 'kopis',
      source_url: `${DETAIL_PAGE}${entry.mt20id}`,
      mt20id: entry.mt20id,
      mt10id,

      title: tag(b, 'prfnm') ?? entry.title,
      openDate: tag(b, 'prfpdfrom') ?? entry.openDate,
      closeDate: tag(b, 'prfpdto') ?? entry.closeDate,
      // "토요일(19:30), 일요일(18:00)" 형태. 대표 회차를 뽑는 것은 to-events 몫이다
      dtguidance: tag(b, 'dtguidance'),
      runtime: tag(b, 'prfruntime'),
      age: tag(b, 'prfage'),

      // 짧은 이름(3자 이하)은 제목에 안 나오는 일이 있어 출연진으로도 맞춘다.
      // 팝가에서 태그가 하던 역할을 여기서는 이 필드가 한다
      cast: tag(b, 'prfcast'),
      crew: tag(b, 'prfcrew'),

      area: tag(b, 'area') ?? entry.area,
      genre: tag(b, 'genrenm') ?? entry.genre,
      state: tag(b, 'prfstate') ?? entry.state,
      openrun: tag(b, 'openrun'),
      festival: tag(b, 'festival'),

      priceGuide: tag(b, 'pcseguidance'),
      reservationUrl: reservation,
      image: tag(b, 'poster') ?? entry.poster,

      facilityName: facility?.name ?? entry.facility,
      address: facility?.address ?? null,
      latitude: facility?.latitude ?? null,
      longitude: facility?.longitude ?? null,
      seatScale: facility?.seatScale ?? null,
    },
  }
}

/**
 * 이 소스의 수집 전체.
 *
 * `run.mjs` 의 사이트맵 소스들과 모양이 다르다. 저쪽은 URL 목록을 만들고 하나씩
 * 가져오는데, 여기는 목록 순회 자체가 API 페이징이고 시설 캐시를 잡 단위로
 * 들고 있어야 한다. 그래서 소스가 루프를 갖는다.
 */
export async function collect({ days = 90, limit = 700, onProgress } = {}) {
  const entries = await listConcerts({ days, limit })
  onProgress?.({ phase: 'list', total: entries.length })

  const facilityCache = new Map()
  const records = []
  const failures = []

  for (const [i, entry] of entries.entries()) {
    const r = await fetchConcert(entry, facilityCache)
    if (r.ok) records.push(r.record)
    else failures.push({ url: `${DETAIL_PAGE}${r.mt20id}`, status: r.status, error: r.error })

    if ((i + 1) % 50 === 0 || i === entries.length - 1) {
      onProgress?.({
        phase: 'detail',
        done: i + 1,
        total: entries.length,
        ok: records.length,
        failed: failures.length,
        facilities: facilityCache.size,
      })
    }
  }

  return { records, failures }
}
