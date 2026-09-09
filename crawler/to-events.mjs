/**
 * 수집 원본 → events.json 정규화.
 *
 *   node crawler/to-events.mjs [--out src/data/events.json] [--all]
 *
 * 수집(run.mjs)과 가공을 분리해둔 이유는, 필터 기준을 바꿀 때마다
 * 상대 서버를 다시 두드리지 않기 위해서다.
 *
 * 기본은 K-pop 관련만 남긴다. --all 을 주면 카테고리 필터를 끄고 전부 내보낸다.
 *
 * ─────────────────────────────────────────────────────────
 * **`source` 는 화면이 읽지 않는다.** 적재(scripts/upsert-events.mjs)만 쓴다.
 *
 * 백엔드가 이 값을 요청 바디에 명시하라고 요구한다 — `id` 접두어에서 유도하지
 * 않는다(위키 05-기록-회고/2026-09-08 D-9). 접두어를 파싱하면 `pg_` 를 바꾸는
 * 순간 적재가 조용히 틀린 수집원으로 들어가고, 그 사실이 어디에도 드러나지
 * 않는다. 그래서 **어느 소스인지 아는 자리에서 그냥 적는다** — 아래 빌더 셋은
 * 각각 한 소스만 만든다.
 *
 * `src/types.ts` 의 `EventItem` 에는 넣지 않았다. 그 타입은 화면 계약이고
 * `/api/v1/events` 응답에 `source` 가 없어서, 필수로 두면 API 경로의 매퍼
 * (`src/lib/api/events.ts`)가 만들어낼 수 없는 필드를 요구하게 된다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { LEDGER_PATH, mergeLedger } from './known-subjects.mjs'

const args = process.argv.slice(2)
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'src/data/events.json'
const KEEP_ALL = args.includes('--all')
const IN_POPGA = 'data/raw/crawl/popga.json'
const IN_OFFMATE = 'data/raw/crawl/offmate.json'
const IN_KOPIS = 'data/raw/crawl/kopis.json'
// 화이트리스트 누락 후보 리포트. 데이터가 아니라 점검용이라 커밋하지 않는다
const MISS_OUT = 'data/miss-candidates.json'

function readRecords(path) {
  if (!existsSync(path)) return []
  return JSON.parse(readFileSync(path, 'utf8')).records ?? []
}

/** 서울만 다룬다 (poc-plan 4.2) */
const SEOUL_PREFIX = '서울'

/**
 * 구역 판정.
 *
 * 순서가 중요하다. 세부 구역(홍대·합정·성수)이 구(區) 단위보다 먼저 걸려야 한다.
 * 팬덤의 동선 단위가 "마포구"가 아니라 "홍대"이기 때문이다.
 * 세부 구역에 안 걸리는 것만 구 단위로 떨어진다.
 *
 * 도로명은 동(洞) 이름과 다르다. '동교동'만 넣으면 '동교로34길'이 통째로 샌다 
 * 실제로 홍대 권역 23건이 'etc'에 쌓여 있었다. 도로명을 따로 나열하는 이유다.
 *
 * 반대로 넓게 잡으면 다른 구의 같은 이름에 걸린다. 광진구에도 뚝섬로가 있고
 * 은평구에도 신사동이 있다. 그런 이름은 구(區)와 함께 볼 때만 인정한다.
 */
const DISTRICT_RULES = [
  {
    district: 'hongdae',
    // 연남·동교는 홍대와 걸어서 이어지는 한 동선이라 따로 가르지 않는다.
    // 마포구 신촌로는 홍대입구역 권역이다. 서대문구 신촌로(진짜 신촌)와 다르다
    test: (a) =>
      /서교동|홍대|홍익로|와우산로|어울마당로|동교동|동교로|성미산로|월드컵북로|연남/.test(a) ||
      (/마포구/.test(a) && /신촌로/.test(a)) ||
      // 양화로는 합정역에서 홍대입구역까지 관통해 이름만으로는 못 가른다.
      // 홍대입구역이 160번대라 150 이상을 홍대로 본다. 그 아래는 합정 규칙이 받는다
      /양화로\s*(1[5-9]\d|[2-9]\d\d)/.test(a),
  },
  {
    // 망원은 합정에 붙인다. 도보권이고 단독으로는 표본이 너무 적다
    district: 'hapjeong',
    test: (a) => /합정|양화로|독막로|잔다리로|망원|희우정로|월드컵로/.test(a),
  },
  {
    // 뚝섬로·아차산로는 광진구에도 있다. 성동구일 때만 성수로 본다
    district: 'seongsu',
    test: (a) => /성수|연무장|서울숲/.test(a) || (/성동구/.test(a) && /뚝섬|아차산로/.test(a)),
  },
  {
    // '신사'는 은평구에도 있다. 강남·서초 안에서만 인정한다
    district: 'gangnam',
    test: (a) =>
      /강남|압구정|청담|삼성동|역삼|논현|테헤란로/.test(a) ||
      (/강남구|서초구/.test(a) && /신사/.test(a)),
  },
  { district: 'konkuk', test: (a) => /건대|화양동|능동로/.test(a) },
  { district: 'jamsil', test: (a) => /잠실|송파구|올림픽로/.test(a) },
  { district: 'yeouido', test: (a) => /여의도|여의대로|영등포구/.test(a) },
  { district: 'yongsan', test: (a) => /용산|이태원|한남|아이파크몰/.test(a) },
  { district: 'myeongdong', test: (a) => /명동|중구|을지로|충무로/.test(a) },
  { district: 'jongno', test: (a) => /종로|인사동|익선동|삼청/.test(a) },
]

/**
 * K-pop 판정, 아티스트 화이트리스트 대조.
 *
 * 팝가 카테고리는 "연예인/셀럽"까지만 구분하고 K-pop 여부를 알려주지 않는다.
 * 카테고리만 쓰면 브랜드 팝업(앰버서더 태그)·일본 가수·게임 IP 가 전부 섞여 들어온다.
 * 실제로 재현율 우선 필터에서는 43건 중 실제 K-pop 이 5~8건이었다.
 *
 * 그래서 화이트리스트로 간다. 커버리지가 줄어드는 것은 감수한다 
 * "K-pop 만" 이라는 요구와 높은 재현율은 이 데이터로는 양립하지 않는다.
 * 누락이 보이면 crawler/kpop-artists.json 에만 추가하면 되고,
 * 수집 원본이 남아 있어 다시 긁지 않아도 된다.
 */
const ARTISTS = JSON.parse(readFileSync('crawler/kpop-artists.json', 'utf8')).groups

/** 정규화: 공백·기호를 지우고 소문자로. "스트레이 키즈" 와 "스트레이키즈" 를 같게 본다 */
const norm = (s) => s.toLowerCase().replace(/[\s()·&.,'-]/g, '')

/**
 * 짧은 이름은 부분일치로 쓰면 안 된다.
 * 한국어는 단어 경계가 없어서 "카이"가 "서울스카이"·"아카이브"에,
 * "조이"가 "조이올팍"에 걸린다. 실제로 오탐이 4건 나왔다.
 *
 * 그래서 길이로 갈랐다.
 *  - 4자 이상: 제목·태그 어디든 부분일치 허용
 *  - 3자 이하: 태그와 '정확히' 같을 때만 인정 (태그는 사람이 단 라벨이라 신뢰도가 높다)
 */
const LONG_NAME_MIN = 4

const NEEDLES = ARTISTS.flatMap((g) => [g.name, ...(g.aliases ?? [])]).map((n) => ({
  raw: n,
  key: norm(n),
}))

const LONG_NEEDLES = NEEDLES.filter((n) => n.key.length >= LONG_NAME_MIN)
const SHORT_NEEDLES = NEEDLES.filter((n) => n.key.length >= 2 && n.key.length < LONG_NAME_MIN)

/** 애니·게임·캐릭터 IP 는 K-pop 이 아니다. 카테고리로 먼저 쳐낸다 */
function isNonKpopIp(rec) {
  return rec.categories.some((c) => /애니|캐릭터|게임|웹툰|만화/.test(c))
}

/** 매칭된 아티스트명을 돌려준다. 없으면 null */
function matchArtist(rec) {
  if (isNonKpopIp(rec)) return null

  const hay = norm([rec.title, rec.subTitle ?? '', rec.tags.join(' ')].join(' '))
  const long = LONG_NEEDLES.find((n) => hay.includes(n.key))
  if (long) return long.raw

  const tagKeys = new Set(rec.tags.map(norm))
  const short = SHORT_NEEDLES.find((n) => tagKeys.has(n.key))
  return short ? short.raw : null
}

/**
 * 생일카페 판정.
 * 팝가는 팝업 전문이라 생카가 많지 않지만 섞여 들어온다.
 * 제목이 "정국 생일카페 - 24시 꾸꾸 편의점" 형태라 대상과 장소를 여기서 가른다.
 */
function parseBirthdayCafe(title) {
  const m = title.match(/^(.+?)\s*생일\s*카페\s*(?:[-–]\s*(.+))?$/)
  if (!m) return null
  return { subject: m[1].trim(), place: m[2]?.trim() || null }
}

/**
 * 주소가 정본이다.
 *
 * 태그를 주소와 한 덩어리로 붙여 보면 다른 지점명·행사 태그가 섞여
 * "중구 남대문로"가 강남으로 분류된다. 여러 지점을 함께 여는 팝업은
 * 태그에 지점명이 전부 들어 있어서다.
 *
 * 그래서 주소로 먼저 판정하고, 주소만으로 못 가른 것에만 태그를 본다.
 * 태그에는 구(區)가 없으므로 구 조건이 붙은 규칙은 태그로 걸리지 않는다 
 * 그게 의도한 동작이다.
 */
function districtOf(address, tags = '') {
  const byAddress = DISTRICT_RULES.find((r) => r.test(address))
  if (byAddress) return byAddress.district

  const byTag = tags ? DISTRICT_RULES.find((r) => r.test(tags)) : null
  return byTag ? byTag.district : 'etc'
}

/**
 * 대상 유형 판정.
 * 생카는 이미 버추얼·애니 캐릭터·배우로 확장됐고 스키마도 열어뒀다(poc-plan 7번).
 * 팝가 카테고리가 유일한 단서라 여기서 최대한 갈라둔다.
 */
function subjectTypeOf(rec) {
  const cats = rec.categories.join(' ')
  const tags = rec.tags.join(' ')
  if (/애니|캐릭터|게임/.test(cats)) return 'CHARACTER'
  if (/버추얼|버튜버|플레이브|VTuber/i.test(`${cats} ${tags}`)) return 'VIRTUAL'
  if (/배우|드라마|영화/.test(cats)) return 'ACTOR'
  return 'IDOL'
}

function toEvent(rec, artist) {
  const address = rec.roadAddress || rec.address || ''

  const cafe = parseBirthdayCafe(rec.title)

  // 장소명은 addressDetail(실제 공간 이름)이 정본이다.
  // 다만 "1F"·"2층"·"지층"처럼 층 표기만 들어 있는 경우가 있어 그건 장소명이 아니다.
  const detail = rec.addressDetail?.trim() ?? ''
  // "1F" "2층" "지층" "지하1층" "로비" 처럼 층·구획 표기만 있는 것은 장소명이 아니다
  const isFloorOnly = /^(지하|지|B)?\s*\d*\s*(F|층|로비|LOBBY)$/i.test(detail) || detail.length <= 2
  const buildingFromAddress = (rec.address ?? '')
    .match(/\(([^)]*)\)\s*$/)?.[1]
    ?.split(',')
    .pop()
    ?.trim()

  // 생카는 제목 뒤쪽이 카페명이라 그것을 우선한다
  const placeName =
    (!isFloorOnly && detail) || cafe?.place || buildingFromAddress || address || rec.title

  return {
    id: `pg_${rec.source_url.split('/').pop()}`,
    source: 'POPGA',
    place: {
      name: placeName,
      address,
      lat: rec.latitude,
      lng: rec.longitude,
      district: districtOf(address, rec.tags.join(' ')),
      kind: cafe ? 'CAFE' : 'POPUP_VENUE',
    },
    // 카드에는 대상명이 앞에 와야 한다.
    // 생카는 제목 앞쪽이 대상명이고, 팝업은 매칭된 아티스트명을 쓴다 
    // 팝업 제목은 "아임도넛 X 키스오브라이프 팝업 @홍대"처럼 브랜드가 앞서는 경우가 많다
    subject: cafe?.subject ?? artist ?? rec.title.replace(/\s*팝업(\s*스토어)?\s*$/, '').trim(),
    title: rec.title,
    subjectType: subjectTypeOf(rec),
    kind: cafe ? 'BIRTHDAY_CAFE' : 'POPUP',
    startsOn: rec.openDate,
    endsOn: rec.closeDate,
    ...(rec.operationTime?.length ? { openHours: rec.operationTime.join(' / ') } : {}),
    // 공식 원문이 있으면 그쪽으로 보낸다. 팝가 링크는 백업으로 남긴다 
    // 사용자를 공급처로 보내는 것이 정합성 방어의 핵심이다 (poc-plan 1번)
    sourceUrl: rec.instagram || rec.website || rec.source_url,
    ...(rec.instagram || rec.website ? { listingUrl: rec.source_url } : {}),
    ...(rec.preReservationLink ? { reservationUrl: rec.preReservationLink } : {}),
    ...(rec.image ? { imageUrl: rec.image } : {}),
    ...(rec.benefits?.length
      ? { perks: rec.benefits.map((b) => `${b.key}: ${b.value}`).join('\n') }
      : {}),
    ...(rec.notice ? { conditions: rec.notice } : {}),
    // 팝가가 정리한 것을 우리가 다시 정리했다. 공식 채널에서 직접 받은 것이 아니므로
    // official 로 올리지 않는다 (poc-plan 1번 정합성 교란 방어)
    trust: 'PARSED',
    goods: [],
  }
}

/**
 * 오프메이트 레코드 → 이벤트.
 *
 * 아티스트가 구조화돼 있어 K-pop 화이트리스트가 필요 없고,
 * 좌표도 들어 있어 지오코딩이 필요 없다.
 */
function offmateToEvent(rec) {
  const address = rec.address ?? ''
  const hours =
    rec.startAt && rec.endAt ? `${rec.startAt} ~ ${rec.endAt}` : null

  // 주최자 계정이 원문이다. 없으면 오프메이트 상세로 떨어진다
  const host =
    rec.snsType === 'twitter' && rec.twitterId
      ? `https://x.com/${rec.twitterId.replace(/^@/, '')}`
      : rec.instagramId
        ? `https://www.instagram.com/${rec.instagramId.replace(/^@/, '')}`
        : null

  const perkCount =
    rec.specialGoods.length + rec.firstComeGoods.length + rec.optionalSpecialGoods.length

  return {
    id: `om_${rec.id}`,
    source: 'OFFMATE',
    place: {
      // 생카는 카페가 장소다. 생카 이름(rec.name)은 이벤트명이지 장소명이 아니다
      name: rec.cafeName || address || rec.name || '장소 미정',
      address,
      lat: rec.latitude,
      lng: rec.longitude,
      district: districtOf(address),
      kind: 'CAFE',
    },
    // 멤버명이 대상이다. 그룹명은 검색·필터에서 쓰이도록 제목에 남긴다
    subject: rec.memberName ?? rec.groupName ?? rec.name ?? '',
    title: [rec.groupName, rec.memberName, rec.name].filter(Boolean).join(' · '),
    subjectType: 'IDOL',
    kind: 'BIRTHDAY_CAFE',
    startsOn: rec.startDate,
    endsOn: rec.endDate,
    ...(hours ? { openHours: hours } : {}),
    // 특전 이름 매핑은 아직 없다. 개수만으로도 "특전 N종"이 표시된다
    ...(perkCount ? { perks: `특전 ${perkCount}종` } : {}),
    sourceUrl: host ?? rec.source_url,
    ...(host ? { listingUrl: rec.source_url } : {}),
    ...(rec.images?.[0] ? { imageUrl: rec.images[0] } : {}),
    trust: rec.isHostVerified ? 'PARTNER' : 'PARSED',
    goods: [],
  }
}

/**
 * KOPIS 레코드 → 이벤트.
 *
 * 콘서트만 시작 시각(`startsAt`)을 갖는다 (EV-10). 그 값이 `dtguidance` 라는
 * 안내 문자열로 오기 때문에 여기서 뽑아낸다.
 */

/** KOPIS 는 날짜를 `2026.10.03` 으로 준다. 화면 계약은 `YYYY-MM-DD` 다 */
const dotToDash = (d) => (d ?? '').replace(/\./g, '-')

/**
 * 포스터 주소를 https 로 맞춘다.
 *
 * API 가 `http://www.kopis.or.kr/upload/...` 로 주는데 `https://kopis.or.kr` 에
 * 같은 파일이 있다 (`www` 를 붙인 https 는 301 이다).
 *
 * 두 가지 때문에 여기서 바꾼다. `next.config.ts` 의 `remotePatterns` 가 다른
 * 소스도 전부 https 로 두고 있고, 평문으로 받아온 이미지는 중간에서 바꿔치기
 * 될 수 있다. next/image 가 서버에서 가져오므로 mixed content 는 아니지만,
 * https 가 있는데 안 쓸 이유가 없다.
 */
const posterUrl = (u) =>
  (u ?? '').replace(/^https?:\/\/(www\.)?kopis\.or\.kr/, 'https://kopis.or.kr') || null

/**
 * 대표 회차 시각.
 *
 * `dtguidance` 가 "금요일(19:30), 토요일(17:00), 일요일(16:00)" 형태다.
 * 요일마다 시각이 다르고 `event` 에는 `starts_at` 하나뿐이라 **첫 회차를
 * 대표로 쓴다** (위키 행사-수집원 3장). 정확한 회차는 예매처가 답한다.
 *
 * 시각을 못 찾으면 null 이다. 콘서트는 `startsAt` 이 있어야 검증을 통과하므로
 * 그런 레코드는 아래에서 아예 뺀다 — 검증기를 실패시키면 잡 전체가 죽는다.
 */
function representativeTime(guidance) {
  const m = (guidance ?? '').match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
}

/**
 * 화이트리스트 판정에 넘길 모양으로 바꾼다.
 *
 * `matchArtist` 는 팝가 레코드를 받도록 쓰여 있고, 3자 이하 이름은 **태그와
 * 정확히 같을 때만** 인정한다. 한국어에 단어 경계가 없어 "조이"가 "조이올팍"에
 * 걸리던 오탐 때문이다. KOPIS 에는 태그가 없으니 그 자리에 **제목을 단어로
 * 쪼갠 것**을 넣는다.
 *
 * 콘서트 제목이 정형적이라 이게 통한다 — `EXO PLANET`, `QWER 2nd TOUR`,
 * `산들 단독 콘서트` 처럼 활동명이 독립된 단어로 온다. 그리고 같은 규칙이
 * 오탐도 막는다. 실제 데이터에 `KB 조이올팍 페스티벌` 이 있는데 `조이올팍` 은
 * 한 단어라 `조이` 와 정확히 같지 않다.
 *
 * **출연진(`cast`)은 여기에 넣어도 거의 도움이 안 된다.** 값이 대개 비어 있고
 * (EXO · QWER · tripleS · HIGHLIGHT 전부 null), 있어도 본명이다 — 산들이
 * `이정환`, 태민이 `이태민` 으로 온다. 그래도 함께 넣는 이유는 본명이 활동명인
 * 경우(박지훈)가 있고, 본명은 활동명 목록과 우연히 겹칠 일이 없어서다.
 */
function kopisMatchSource(rec) {
  const cast = (rec.cast ?? '')
    .split(/[,·]/)
    .map((s) => s.trim())
    .filter(Boolean)
  // 콜론·괄호·대괄호까지 경계로 본다. "EXO PLANET #6, EXhOrizon [dot]" 같은 제목 때문이다
  const words = (rec.title ?? '')
    .split(/[\s,:·()[\]#]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  /**
   * 짧은 이름은 **선두 단어**만 본다.
   *
   * 제목 어디든 허용했더니 `영 카이 첫 내한공연` 이 엑소 카이로 잡혔다.
   * 동명이인은 이름만으로 가를 수 없고, 오탐은 사용자에게 없는 행사를
   * 보여주는 것이라 누락보다 나쁘다.
   *
   * 콘서트 제목은 아티스트명이 맨 앞이라 이 제한으로 잃는 것이 거의 없다 —
   * `EXO PLANET`, `산들 단독 콘서트`, `QWER 2nd TOUR` 가 다 선두다.
   * 대신 `2026 ○○ 콘서트` 처럼 앞에 연도가 붙은 짧은 이름은 놓치는데,
   * 그건 누락 후보로 떠서 사람이 본다.
   */
  const lead = words.slice(0, 1)
  return { categories: [], title: rec.title ?? '', subTitle: null, tags: [...lead, ...cast] }
}

function kopisToEvent(rec, artist) {
  const address = rec.address ?? ''
  return {
    id: `kopis_${rec.mt20id}`,
    source: 'KOPIS',
    place: {
      name: rec.facilityName || address,
      address,
      lat: rec.latitude,
      lng: rec.longitude,
      district: districtOf(address),
      kind: 'CONCERT_HALL',
    },
    subject: artist ?? (rec.title ?? '').replace(/\s*\[[^\]]*\]\s*$/, '').trim(),
    title: rec.title,
    subjectType: 'IDOL',
    kind: 'CONCERT',
    startsOn: dotToDash(rec.openDate),
    endsOn: dotToDash(rec.closeDate),
    startsAt: representativeTime(rec.dtguidance),
    // 요일별 회차 안내를 그대로 보여준다. "매일 11:00 ~ 20:00" 자리에
    // "금요일(19:30), 토요일(17:00)" 이 뜨는 편이 사용자에게 정확하다
    ...(rec.dtguidance ? { openHours: rec.dtguidance } : {}),
    sourceUrl: rec.source_url,
    ...(rec.reservationUrl ? { reservationUrl: rec.reservationUrl } : {}),
    ...(posterUrl(rec.image) ? { imageUrl: posterUrl(rec.image) } : {}),
    ...(rec.priceGuide ? { conditions: rec.priceGuide } : {}),
    // 기획사가 KOPIS 에 등록한 공식 정보지만, 우리가 정규화한 것이라
    // OFFICIAL 로 올리지 않는다. 검증기의 마지막 방어선을 콘서트 때문에 열지 않는다
    trust: 'PARSED',
    goods: [],
  }
}

const today = new Date().toISOString().slice(0, 10)

const popgaRecords = readRecords(IN_POPGA)
const offmateRecords = readRecords(IN_OFFMATE)
const kopisRecords = readRecords(IN_KOPIS)

const inSeoulAndOpen = popgaRecords
  .filter((r) => (r.roadAddress || r.address || '').startsWith(SEOUL_PREFIX))
  .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
  .filter((r) => r.closeDate >= today) // 끝난 것은 목록에서 뺀다 (poc-plan 4.3)
  .map((r) => ({ rec: r, artist: matchArtist(r), cafe: parseBirthdayCafe(r.title) }))

const rows = inSeoulAndOpen
  // 생일카페는 그 자체가 팬덤 행사라 화이트리스트를 통과시킨다.
  // 멤버 이름이 목록에 없어도 "○○ 생일카페"면 K-pop 행사로 본다
  .filter(({ artist, cafe }) => KEEP_ALL || artist || cafe)

/**
 * 화이트리스트 누락 후보.
 *
 * 화이트리스트에 없는 팀은 조용히 사라진다. 그게 이 방식의 대가다.
 * 문제는 "빠졌다"는 사실 자체가 아무 신호도 내지 않는다는 것이다.
 * 신인이 데뷔할 때마다 커버리지가 깎이는데 아무도 모른다.
 *
 * 그래서 연예인·셀럽 카테고리인데 이름을 못 맞춘 것을 후보로 뽑아둔다.
 * 사람이 훑어보고 진짜 K-pop 이면 crawler/kpop-artists.json 에 추가하면 된다.
 * 자동으로 통과시키지 않는 이유는, 카테고리만 믿으면 배우·유튜버·일본
 * 가수까지 들어오기 때문이다 (그래서 애초에 화이트리스트를 쓴다).
 */
const missCandidates = inSeoulAndOpen
  .filter(({ artist, cafe }) => !artist && !cafe)
  .filter(({ rec }) => rec.categories.some((c) => /연예인|셀럽|아이돌/.test(c)))
  .filter(({ rec }) => !isNonKpopIp(rec))
  .map(({ rec }) => ({
    title: rec.title,
    categories: rec.categories,
    url: rec.source_url,
    endsOn: rec.closeDate,
  }))

// 오프메이트는 전국이라 서울만 남긴다. 좌표가 없으면 지도에 못 찍으니 제외한다
const cafeEvents = offmateRecords
  .filter((r) => (r.address ?? '').startsWith('서울'))
  .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
  .filter((r) => r.endDate >= today)
  .map(offmateToEvent)

/**
 * 콘서트. 요청 단계에서 이미 서울·대중음악으로 좁혀 왔지만 여기서 다시 본다 —
 * 수집 파라미터가 바뀌어도 정규화의 계약은 그대로여야 한다.
 *
 * **화이트리스트를 콘서트에도 적용한다.** 서울 대중음악은 90일에 200건이 넘고
 * 그 대부분이 인디·재즈·발라드·내한이다. 장르만으로 담으면 목록의 절반 이상이
 * K-pop 이 아닌 공연이 된다. 빠진 것은 아래 누락 후보로 남는다.
 */
const concertsInSeoul = kopisRecords
  .filter((r) => (r.address ?? '').startsWith(SEOUL_PREFIX))
  .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
  .filter((r) => dotToDash(r.closeDate) >= today)
  // 콘서트는 startsAt 이 있어야 검증을 통과한다. 시각을 못 뽑은 것은 여기서 뺀다
  .filter((r) => representativeTime(r.dtguidance))
  .map((r) => ({ rec: r, artist: matchArtist(kopisMatchSource(r)) }))

const concertEvents = concertsInSeoul
  .filter(({ artist }) => KEEP_ALL || artist)
  .map(({ rec, artist }) => kopisToEvent(rec, artist))

/**
 * 콘서트 누락 후보.
 *
 * 팝가는 "연예인·셀럽" 카테고리로 후보를 좁힐 수 있었지만 KOPIS 는 그 축이
 * 없다 — 장르가 이미 대중음악이라 미매칭 전부가 후보가 된다. 그대로 두면
 * 200줄짜리 리포트가 되어 아무도 안 본다.
 *
 * 그래서 **좌석 규모로 정렬만 해 둔다.** 아이돌 콘서트는 큰 공연장에서 열리고
 * 소극장 인디 공연이 대다수라, 큰 것부터 훑는 것이 사람의 시간을 아낀다.
 * 자동으로 통과시키지는 않는다 — 큰 공연장에도 트로트·내한이 들어온다.
 */
const concertMissCandidates = concertsInSeoul
  .filter(({ artist }) => !artist)
  .map(({ rec }) => ({
    title: rec.title,
    categories: [rec.genre, rec.facilityName, `${rec.seatScale ?? '?'}석`],
    url: rec.source_url,
    endsOn: dotToDash(rec.closeDate),
    seats: Number(String(rec.seatScale ?? '0').replace(/,/g, '')) || 0,
  }))
  .sort((a, b) => b.seats - a.seats)

/**
 * 문자열 정리 — 세 소스를 합친 뒤 한 번만 한다.
 *
 * 빌더마다 하지 않는 이유는 **빠뜨리면 드러나지 않기** 때문이다. 원본이 준 값을
 * 그대로 실어도 화면은 그려지고 검증도 통과한다. 실제로 그렇게 새고 있었다 —
 * 2026-09-08 점검에서 `title` 앞뒤 공백 9건 · 개행 3건 · `sourceUrl` 앞 공백 1건이
 * 나왔고, **개행 3건은 상세 제목이 두 줄로 갈려 이미 화면에 보이고 있었다.**
 *
 * 여기 한 곳에 두면 소스를 새로 붙일 때 자동으로 걸린다.
 *
 * **필드마다 다르게 다듬는다.** 개행이 뜻을 갖는 자리가 있다.
 *
 * - `perks` 는 `benefits` 를 줄바꿈으로 이어 만든 것이고 `conditions`(공지) ·
 *   `openHours`(회차 안내)도 줄바꿈이 원문의 일부다 → **줄은 남기고** CRLF 만
 *   LF 로 맞추고 줄 끝 공백을 떤다
 * - `title` · `subject` · 장소명 · 주소는 한 줄이어야 한다 → 공백을 하나로 접는다
 * - 주소(URL)는 **공백을 아예 없앤다.** 한 칸으로 접어도 깨진 주소인 것은 같고,
 *   지우는 쪽이 원래 값에 가깝다
 *
 * 원장(`known-subjects.mjs`)이 이미 `subject` 를 `trim` 해서 키로 쓴다. 그래서
 * 다듬지 않으면 **원장 키와 `events.json` 의 값이 갈리고** `/a/<대상>` 주소가
 * 어긋난다. 지금 데이터에는 없지만 한 소스만 공백을 흘리면 생기는 일이다.
 */
const oneLine = (v) => v.replace(/\s+/g, ' ').trim()
const noSpace = (v) => v.replace(/\s+/g, '')
const keepLines = (v) =>
  v
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim()

const ONE_LINE_FIELDS = ['subject', 'title']
const URL_FIELDS = ['sourceUrl', 'listingUrl', 'reservationUrl', 'imageUrl']
const KEEP_LINE_FIELDS = ['openHours', 'perks', 'conditions']

function normalizeStrings(e) {
  for (const k of ONE_LINE_FIELDS) if (typeof e[k] === 'string') e[k] = oneLine(e[k])
  for (const k of URL_FIELDS) if (typeof e[k] === 'string') e[k] = noSpace(e[k])
  for (const k of KEEP_LINE_FIELDS) if (typeof e[k] === 'string') e[k] = keepLines(e[k])
  if (e.place) {
    if (typeof e.place.name === 'string') e.place.name = oneLine(e.place.name)
    if (typeof e.place.address === 'string') e.place.address = oneLine(e.place.address)
  }
  return e
}

// 아래 isListing 이 sourceUrl 을 정규식으로 보므로 거르기 전에 다듬는다
const all = [
  ...rows.map(({ rec, artist }) => toEvent(rec, artist)),
  ...cafeEvents,
  ...concertEvents,
].map(normalizeStrings)

/**
 * 원문을 못 찾은 것은 싣지 않는다.
 *
 * 두 소스 모두 주최자 계정이 없으면 `sourceUrl` 이 리스팅 주소로 떨어진다.
 * 그대로 두면 화면의 "공식 공지 보기" 가 경쟁 리스팅으로 연결된다. 출처를
 * 속이는 것이고, 앱에 원문 링크를 반드시 노출한다는 규칙도 깨진다.
 *
 * 빼는 쪽을 고른 이유: 링크 없이 정보만 실으면 사용자가 확인할 방법이 없다.
 * 커버리지가 조금 줄더라도 실린 것은 전부 원문으로 이어지는 편이 낫다.
 */
const isListing = (url) => !url || /popga\.co\.kr|offmate/.test(url)
const events = all.filter((e) => !isListing(e.sourceUrl))
const dropped = all.length - events.length

events.sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1))

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(events, null, 2) + '\n', 'utf8')

/**
 * 대상 원장을 얹는다.
 *
 * 위 events 에는 끝난 행사가 없다. 그래서 이 파일을 안 남기면 마지막
 * 행사가 끝난 대상의 주소가 다음 빌드에서 사라지고, 이미 뿌린 링크가
 * 그날 404 가 된다. 왜 이렇게 하는지는 known-subjects.mjs 에 적었다.
 *
 * --out 으로 다른 곳에 뽑아보는 중이면 건드리지 않는다. 실험이 진짜
 * 원장을 덮으면 되돌릴 수 없다 — 지운 이름은 다시 안 돌아온다.
 */
if (OUT === 'src/data/events.json') {
  const before = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) : {}
  const ledger = mergeLedger(before, events)
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8')
  const added = Object.keys(ledger).length - Object.keys(before).length
  console.log(`대상 원장 ${Object.keys(ledger).length}명` + (added ? ` (신규 ${added})` : ''))
}

const byDistrict = {}
for (const e of events) byDistrict[e.place.district] = (byDistrict[e.place.district] ?? 0) + 1

const popupCount = events.filter((e) => e.kind === 'POPUP').length

const concertCount = events.filter((e) => e.kind === 'CONCERT').length

console.log(
  `팝가 ${popgaRecords.length} + 오프메이트 ${offmateRecords.length} + ` +
    `KOPIS ${kopisRecords.length} → ` +
    `서울·진행중${KEEP_ALL ? '' : '·K-pop'} ${events.length}건 ` +
    `(팝업 ${popupCount} · 생카 ${events.length - popupCount - concertCount} · 콘서트 ${concertCount})`,
)
// 조용히 줄어들면 수집이 깨진 것과 구분되지 않는다. 항상 드러낸다
if (dropped) console.log(`원문 없어 제외: ${dropped}건`)

// 후보는 파일로도 남긴다. 자동 갱신이 새벽에 돌아 로그를 아무도 안 볼 때,
// 워크플로가 이 파일을 읽어 실행 요약에 붙인다.
// 콘서트 후보는 좌석 규모 순이라 뒤에 붙여도 정렬이 유지된다
const allMissCandidates = [...missCandidates, ...concertMissCandidates]
writeFileSync(MISS_OUT, JSON.stringify(allMissCandidates, null, 2) + '\n', 'utf8')

if (allMissCandidates.length) {
  console.log(`\n화이트리스트 누락 후보 ${allMissCandidates.length}건, ${MISS_OUT}`)
  console.log('  (K-pop 이면 crawler/kpop-artists.json 에 추가하고 이 스크립트만 다시 돌린다)')
  for (const c of missCandidates) console.log(`  - ${c.title}`)
  // 콘서트는 건수가 많아 큰 공연장 위주로만 보여준다. 전체는 파일에 있다
  for (const c of concertMissCandidates.slice(0, 10)) {
    console.log(`  - [콘서트 ${c.seats}석] ${c.title}`)
  }
  if (concertMissCandidates.length > 10) {
    console.log(`  ... 콘서트 후보 ${concertMissCandidates.length - 10}건 더, 파일 참조`)
  }
}
console.log('구역별:', byDistrict)
console.log(`저장: ${OUT}`)
