import rawEvents from '@/data/events.json'
import mockConcerts from '@/data/concerts.mock.json'
import type { EventItem } from '@/types'
import { USE_API } from '@/lib/api/config'
import { fetchAllEvents } from '@/lib/api/events'

/**
 * 앱이 읽는 이벤트 목록.
 *
 * 화면마다 `events.json` 을 직접 import 하던 것을 한 곳으로 모았다.
 * 일곱 곳이었다.
 *
 * ─────────────────────────────────────────────────────────
 * **여기가 목데이터와 API 가 갈리는 자리다.**
 *
 * `NEXT_PUBLIC_API_BASE` 가 비어 있으면 번들에 든 JSON 을 읽고, 차 있으면
 * `/api/v1/events` 를 부른다. 화면 코드는 어느 쪽인지 모른다.
 *
 * 상수가 아니라 **함수인 이유**가 이것이다. 상수로 두면 `import` 하는
 * 순간 값이 있어야 해서 fetch 를 끼울 자리가 없다. 예전에는 상수였고,
 * API 를 붙이려면 부르는 쪽 일곱을 다 고쳐야 했다. 지금 고쳐 둔다.
 *
 * **서버에서만 부른다.** 클라이언트 컴포넌트는 props 로 받는다
 * (`HomeApp`). 브라우저가 직접 부르면 CORS 와 mixed content 가 걸리고,
 * 무엇보다 목록이 정적 페이지에 박혀야 ISR 이 의미가 있다.
 */

/**
 * 콘서트 목데이터는 **개발에서만** 섞인다.
 *
 * 크롤러가 콘서트를 안 긁고 KOPIS 오픈API 는 아직 안 붙었다. 목록에
 * 콘서트가 한 건도 없으면 필터를 눌러도 0건이라 와이어프레임에서 확인할
 * 수가 없다.
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
 * mockConcerts 를 아무도 안 쓰게 되어 통째로 떨어져 나간다. 판정 규칙
 * 자체는 lib/wireframe.ts 와 같아야 한다. 화면과 데이터가 따로 놀면
 * 어느 하나만 켜진 배포가 나온다.
 *
 * KOPIS 가 붙으면 concerts.mock.json 과 이 분기를 같이 지운다.
 */
const MOCK_CONCERTS: EventItem[] =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_WIREFRAME === '1'
    ? ((mockConcerts as { events: unknown[] }).events as EventItem[])
    : []

/** 수집한 것만. 목데이터가 절대 섞이면 안 되는 자리가 쓴다 */
async function realEvents(): Promise<EventItem[]> {
  return USE_API ? fetchAllEvents() : (rawEvents as EventItem[])
}

/**
 * 화면이 그리는 전부. 개발에서는 콘서트 목데이터가 섞인다.
 *
 * 한 번의 렌더 안에서 여러 번 불러도 fetch 는 한 번만 나간다. Next 가
 * 같은 요청을 렌더 단위로 묶는다. 목데이터 경로는 애초에 배열이다.
 */
export async function getAllEvents(): Promise<EventItem[]> {
  return [...(await realEvents()), ...MOCK_CONCERTS]
}

/**
 * 사이트맵처럼 가짜가 섞이면 안 되는 자리.
 *
 * 개발에서 사이트맵을 열어볼 일은 없지만, 한 번 섞이기 시작하면 어디까지
 * 퍼졌는지 추적하기 어렵다. 애초에 갈래를 나눠 둔다.
 */
export async function getRealEvents(): Promise<EventItem[]> {
  return realEvents()
}
