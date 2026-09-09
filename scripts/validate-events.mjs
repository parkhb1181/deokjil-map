/**
 * events.json 배포 전 검증.
 *
 * 자동 갱신(.github/workflows/refresh-data.yml)은 사람이 안 보는 새벽에 돈다.
 * 팝가가 페이로드 형식을 바꾸면 crawler/sources/popga.mjs 의 정규식 추출이
 * 조용히 빈 값을 뱉는데, 그대로 커밋되면 틀린 데이터가 배포된다.
 *
 * 여기서 걸러 실패시킨다. 낡은 데이터가 남는 편이 틀린 데이터보다 낫다.
 */
import { readFileSync } from 'node:fs'

const PATH = process.argv[2] ?? 'src/data/events.json'
const events = JSON.parse(readFileSync(PATH, 'utf8'))
const problems = []

/**
 * 열거값. 화면 계약이 정본이고 전부 대문자 스네이크다.
 *
 * 한동안 크롤러가 소문자를 뱉고 화면은 대문자를 기다리는 상태였다.
 * 라벨 표가 값을 못 찾아 undefined 가 되는데, 던지지는 않아서
 * 목록이 조용히 비었다. 그런 것은 새벽에 돌고 아침에 발견된다.
 */
const ENUMS = {
  kind: ['BIRTHDAY_CAFE', 'POPUP', 'CONCERT'],
  subjectType: ['IDOL', 'VIRTUAL', 'CHARACTER', 'ACTOR'],
  trust: ['OFFICIAL', 'PARTNER', 'USER', 'PARSED'],
}
const PLACE_KINDS = ['CAFE', 'POPUP_VENUE', 'CONCERT_HALL']

/** 수집이 통째로 깨졌는지. 서울 생카·팝업이 이보다 적은 날은 없었다 */
const FLOOR = 30
if (events.length < FLOOR) {
  problems.push(`이벤트가 ${events.length}건뿐이다 (최소 ${FLOOR}건 기대). 수집이 깨졌을 가능성이 높다`)
}

/**
 * 종류별 실종은 총계로 안 잡힌다.
 *
 * 팝업·생카가 200건 넘게 있으면 콘서트가 0건이어도 위 FLOOR 를 통과한다.
 * KOPIS 인증키가 만료되거나 응답 형식이 바뀌어 수집이 0건이 되는 날,
 * 목록은 멀쩡해 보이고 콘서트 필터만 조용히 빈다.
 *
 * **실패시키지 않고 경고로 둔다.** 콘서트가 0건인 것은 틀린 데이터가 아니라
 * 부족한 데이터고, 여기서 죽이면 멀쩡한 팝업·생카 갱신까지 배포되지 않는다.
 * 새로 붙인 수집원이 이미 잘 돌던 경로를 무너뜨리게 하지 않는다.
 */
const kindCounts = {}
for (const e of events) kindCounts[e.kind] = (kindCounts[e.kind] ?? 0) + 1

const warnings = []
if (!kindCounts.CONCERT) {
  warnings.push('콘서트가 0건이다. KOPIS 수집이 깨졌는지 확인한다 (인증키·응답 형식)')
}

for (const e of events) {
  const at = `${e.id} (${e.subject})`

  // 출처를 속이지 않는다. CLAUDE.md 1번 규칙.
  // sourceUrl 은 주최자 원문이어야 한다. 리스팅이 여기 오면 화면의
  // "공식 공지 보기" 가 경쟁 리스팅으로 연결된다
  if (!e.sourceUrl) {
    problems.push(`${at}: sourceUrl 이 없다`)
  } else if (/popga\.co\.kr|offmate/.test(e.sourceUrl)) {
    problems.push(`${at}: sourceUrl 이 리스팅이다. ${e.sourceUrl}`)
  }

  if (e.trust === 'OFFICIAL') {
    problems.push(`${at}: 확인되지 않은 것을 official 로 올렸다`)
  }

  if (!e.startsOn || !e.endsOn || e.startsOn > e.endsOn) {
    problems.push(`${at}: 기간이 뒤집혔거나 비어 있다 (${e.startsOn} ~ ${e.endsOn})`)
  }

  if (!Number.isFinite(e.place?.lat) || !Number.isFinite(e.place?.lng)) {
    problems.push(`${at}: 좌표가 없다. 지도에 안 뜬다`)
  }

  for (const [field, allowed] of Object.entries(ENUMS)) {
    if (!allowed.includes(e[field])) {
      problems.push(`${at}: ${field} 가 계약 밖이다. ${e[field]}`)
    }
  }
  if (e.place && !PLACE_KINDS.includes(e.place.kind)) {
    problems.push(`${at}: place.kind 가 계약 밖이다. ${e.place.kind}`)
  }

  /**
   * 콘서트만 시작 시각을 갖는다 (EV-10).
   *
   * KOPIS 는 회차를 "금요일(19:30), 토요일(17:00)" 같은 안내 문자열로 주고,
   * 크롤러가 거기서 대표 시각을 뽑는다. 형식이 바뀌면 그 파싱이 조용히 null 을
   * 뱉는데, 화면은 시각 없는 콘서트를 그냥 그려서 아무도 모른다.
   *
   * 종류와 장소도 짝이어야 한다. 콘서트를 POPUP_VENUE 로 적으면 지도·필터가
   * 팝업과 섞이고, 반대로 카페 행사를 CONCERT_HALL 로 적으면 콘서트 필터에 뜬다.
   */
  if (e.kind === 'CONCERT') {
    if (!e.startsAt) {
      problems.push(`${at}: 콘서트인데 startsAt 이 없다. 회차 파싱이 깨졌을 수 있다`)
    } else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.startsAt)) {
      problems.push(`${at}: startsAt 이 HH:mm 이 아니다. ${e.startsAt}`)
    }
    if (e.place?.kind !== 'CONCERT_HALL') {
      problems.push(`${at}: 콘서트인데 place.kind 가 ${e.place?.kind} 다`)
    }
  } else if (e.startsAt) {
    problems.push(`${at}: 콘서트가 아닌데 startsAt 이 있다 (${e.kind})`)
  }

  if (e.place?.kind === 'CONCERT_HALL' && e.kind !== 'CONCERT') {
    problems.push(`${at}: 공연장인데 kind 가 ${e.kind} 다`)
  }
}

// 경고는 실패보다 먼저 보여준다. 실패로 죽으면 아래가 출력되지 않는다
for (const w of warnings) console.error(`⚠️  ${w}`)

if (problems.length) {
  console.error(`검증 실패, ${problems.length}건\n`)
  for (const p of problems.slice(0, 40)) console.error('  ' + p)
  if (problems.length > 40) console.error(`  ... 외 ${problems.length - 40}건`)
  process.exit(1)
}

const breakdown = Object.entries(kindCounts)
  .map(([k, v]) => `${k} ${v}`)
  .join(' · ')
console.log(`검증 통과, ${events.length}건 (${breakdown})`)
