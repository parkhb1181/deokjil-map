import rawEvents from '@/data/events.json'
import type { EventItem } from '@/types'
import { USE_API_EVENTS } from '@/lib/api/config'
import { fetchAllEvents } from '@/lib/api/events'

/**
 * 앱이 읽는 이벤트 목록.
 *
 * 화면마다 `events.json` 을 직접 import 하던 것을 한 곳으로 모았다.
 * 일곱 곳이었다.
 *
 * ─────────────────────────────────────────────────────────
 * **여기가 JSON 과 API 가 갈리는 자리다.**
 *
 * `USE_API_EVENTS` 가 꺼져 있으면 번들에 든 JSON 을 읽고, 켜져 있으면
 * `/api/v1/events` 를 부른다. 화면 코드는 어느 쪽인지 모른다.
 *
 * `USE_API` 가 아니라 `USE_API_EVENTS` 인 이유는 `lib/api/config.ts` 에
 * 있다 — 로그인을 켜는 것과 행사 소스를 바꾸는 것은 다른 결정이다.
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
 * 수집한 것만 돌려준다.
 *
 * 개발에서만 섞던 콘서트 목데이터를 지웠다. KOPIS 오픈API 가 붙어 크롤러가
 * 실제 콘서트를 담기 시작했고, `src/data/README.md` 가 그때 이 분기와
 * `concerts.mock.json` 을 같이 지우라고 적어 두었다.
 *
 * 한 번의 렌더 안에서 여러 번 불러도 fetch 는 한 번만 나간다. Next 가
 * 같은 요청을 렌더 단위로 묶는다. JSON 경로는 애초에 배열이다.
 */
async function realEvents(): Promise<EventItem[]> {
  return USE_API_EVENTS ? fetchAllEvents() : (rawEvents as EventItem[])
}

/** 화면이 그리는 전부 */
export async function getAllEvents(): Promise<EventItem[]> {
  return realEvents()
}

/**
 * 사이트맵·OG 카드처럼 가짜가 섞이면 안 되는 자리.
 *
 * 목데이터가 사라져 지금은 위와 같다. 그래도 이름을 남기는 이유는 부르는
 * 쪽이 이미 갈려 있고, **"여기에는 실데이터만 온다"는 의도가 호출부에서
 * 읽혀야** 하기 때문이다. 다시 목데이터를 섞을 일이 생기면 이 함수가
 * 갈라지는 자리가 된다.
 */
export async function getRealEvents(): Promise<EventItem[]> {
  return realEvents()
}
