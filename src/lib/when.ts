/**
 * 시각 문자열 하나만 다루는 곳.
 *
 * 화면 다섯 군데가 각자 `iso.split('T')` 로 쪼개고 있었다. 백엔드 계약이
 * 시각을 ISO-8601 로 못박으면서 그 방식이 전부 깨졌다.
 *
 *   전   2026-09-14T09:00
 *   후   2026-09-14T09:00:00+09:00
 *
 * `split('T')[1].split(':')` 이 `['09', '00', '00+09', '00']` 을 돌려준다.
 * 다섯 군데를 각자 고치면 다음에 포맷이 또 바뀔 때 또 다섯 군데다.
 *
 * **Date 로 왕복하지 않는다.** `new Date(iso)` 는 브라우저 시간대에 맞춰
 * 시각을 옮긴다. 우리 값은 전부 KST 기준이고 화면도 KST 로 보여주므로,
 * 옮겼다가 되돌리는 동안 날짜가 하루 밀릴 자리만 만든다. 문자열에서
 * 필요한 조각만 떼어 쓴다. 요일 계산에만 Date 를 쓰는데 그때는 연·월·일을
 * 숫자로 넘겨 로컬 자정으로 만들므로 시간대가 끼어들지 않는다.
 *
 * **벽시계 숫자를 그대로 읽는다.** 오프셋을 떼고 버리므로 `+09:00` 이
 * 아닌 값(예: `Z`)이 오면 시각이 어긋난다. 계약이 "응답은 KST 오프셋을
 * 포함한다" 고 못박아서 그런 값이 올 자리가 없다고 보고 이렇게 뒀다.
 * 계약이 바뀌면 여기부터 고친다.
 *
 * 계약: 04-협업-규칙/API-컨벤션.md 「필드 표기 규칙」
 */

/** 'YYYY-MM-DDTHH:mm:ss+09:00' 에서 필요한 조각만 뗀다 */
export type Parts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

/**
 * 시각 문자열을 조각으로.
 *
 * 오프셋이 있든 없든, 초가 있든 없든 같은 결과를 준다. 목데이터가
 * 아직 짧은 형식이라 둘 다 받아야 한다.
 */
export function parts(iso: string): Parts {
  const [date, rest = ''] = iso.split('T')
  const [year, month, day] = date.split('-').map(Number)
  /* 오프셋(+09:00 · Z)과 초를 떼고 시·분만 남긴다 */
  const clock = rest.split(/[+\-Z]/)[0]
  const [hour = 0, minute = 0] = clock.split(':').map(Number)
  return { year, month, day, hour, minute }
}

const DOW = '일월화수목금토'

/** 요일 한 글자. 로컬 자정으로 만들어 시간대가 끼어들지 않게 한다 */
function dow(p: Parts): string {
  return DOW[new Date(p.year, p.month - 1, p.day).getDay()]
}

/** '9월 14일 (일) 오전 9:00' */
export function whenText(iso: string): string {
  const p = parts(iso)
  const ampm = p.hour < 12 ? '오전' : '오후'
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12
  return `${p.month}월 ${p.day}일 (${dow(p)}) ${ampm} ${h12}:${pad(p.minute)}`
}

/** '9월 14일 (일)' */
export function dayText(iso: string): string {
  const p = parts(iso)
  return `${p.month}월 ${p.day}일 (${dow(p)})`
}

/** '8월 30일' */
export function dateOnly(iso: string): string {
  const p = parts(iso)
  return `${p.month}월 ${p.day}일`
}

/** '8/30 09:12' */
export function shortTime(iso: string): string {
  const p = parts(iso)
  return `${p.month}/${p.day} ${pad(p.hour)}:${pad(p.minute)}`
}

/** '2026-09-14 09:00'. 백오피스 표처럼 정확한 값이 필요한 자리 */
export function fullText(iso: string): string {
  const p = parts(iso)
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * 지금 시각을 계약 형식으로.
 *
 * 렌더 중에 부르지 않는다. 서버 프리렌더 시각이 빌드 시각이라 그대로
 * 쓰면 해가 바뀐 뒤 하루씩 어긋난다 (CLAUDE.md). 이벤트 처리 중에만 쓴다.
 *
 * 오프셋을 `+09:00` 으로 박지 않고 기기에서 읽는다. 개발자가 다른
 * 시간대에 있으면 박아둔 값이 거짓이 된다.
 */
export function stamp(d: Date = new Date()): string {
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const oh = pad(Math.floor(Math.abs(off) / 60))
  const om = pad(Math.abs(off) % 60)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** '9/14 (월) 09:00'. 목록 카드처럼 좁은 자리 */
export function whenShort(iso: string): string {
  const p = parts(iso)
  return `${p.month}/${p.day} (${dow(p)}) ${pad(p.hour)}:${pad(p.minute)}`
}
