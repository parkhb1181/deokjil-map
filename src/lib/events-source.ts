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
 * 조건을 IS_WIREFRAME 으로 부르지 않고 process.env 를 여기 직접 쓴다.
 * 다른 모듈에서 가져온 상수로 감싸면 번들러가 그 값을 접지 못해 JSON
 * import 가 살아남는다. 실제로 그랬다. 화면에는 안 나오는데 홈 청크에
 * 가짜 공연 데이터가 실려 방문자에게 내려갔다.
 *
 * process.env.NODE_ENV 는 빌드 때 문자열로 치환되므로 조건이 접히고
 * mockConcerts 를 아무도 안 쓰게 되어 통째로 떨어져 나간다.
 * 판정 규칙 자체는 lib/wireframe.ts 와 같아야 한다. 화면과 데이터가
 * 따로 놀면 어느 하나만 켜진 배포가 나온다.
 *
 * KOPIS 가 붙으면 concerts.mock.json 과 이 분기를 같이 지운다.
 */
const MOCK: EventItem[] =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_WIREFRAME === '1'
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
