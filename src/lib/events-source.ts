import rawEvents from '@/data/events.json'
import mockConcerts from '@/data/concerts.mock.json'
import type { EventItem } from '@/types'

/**
 * 앱이 읽는 이벤트 목록.
 *
 * 지금까지는 화면마다 `events.json` 을 직접 import 했다. 일곱 곳이었다.
 * 콘서트 목데이터를 섞으려면 일곱 군데를 다 고쳐야 했고, 나중에 DB 를
 * 붙일 때도 마찬가지가 된다. **읽는 자리를 한 곳으로 모은다.**
 *
 * 여기가 나중에 DB 를 읽을 자리다. 빌드 때 한 번 뽑아 이 배열을
 * 채우면 화면 코드는 그대로 돌아간다.
 *
 * ─────────────────────────────────────────────────────────
 * 콘서트 목데이터는 **개발에서만** 섞인다.
 *
 * 크롤러가 콘서트를 안 긁고 KOPIS 오픈API 는 아직 안 붙었다.
 * 목록에 콘서트가 한 건도 없으면 필터를 눌러도 0건이라 와이어프레임에서
 * 확인할 수가 없다.
 *
 * 그렇다고 배포에 섞으면 안 된다. CLAUDE.md 가 못박은 첫 번째 규칙이
 * "출처를 속이지 않는다" 이고, 없는 공연을 띄우면 사용자가 헛걸음한다.
 * 그러면 재방문 지표가 오염돼 제품 매력도 때문인지 데이터 품질
 * 때문인지 구분할 수 없게 된다 (poc-plan 1번).
 *
 * NODE_ENV 는 빌드 시점에 정해지므로 배포 번들에서는 이 배열이
 * 통째로 빠진다. 사이트맵·OG 카드에도 안 들어간다.
 *
 * KOPIS 가 붙으면 concerts.mock.json 과 이 분기를 같이 지운다.
 */
const MOCK: EventItem[] =
  process.env.NODE_ENV === 'development'
    ? ((mockConcerts as { events: unknown[] }).events as EventItem[])
    : []

export const ALL_EVENTS: EventItem[] = [...(rawEvents as EventItem[]), ...MOCK]

/**
 * 실제 수집한 것만. 목데이터가 절대 섞이면 안 되는 자리가 쓴다.
 *
 * 사이트맵이 그렇다. 개발에서 사이트맵을 열어볼 일은 없지만, 한 번
 * 섞이기 시작하면 어디까지 퍼졌는지 추적하기 어렵다. 애초에 갈래를
 * 나눠 둔다.
 */
export const REAL_EVENTS: EventItem[] = rawEvents as EventItem[]
