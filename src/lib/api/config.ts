/**
 * API 접속 설정.
 *
 * **여기가 나중에 바꿀 곳이다.** 주소 한 줄과 깃발 한 줄이다.
 *
 * `NEXT_PUBLIC_API_BASE` 가 비어 있으면 목데이터로 돈다. 지금이 그
 * 상태다. 백엔드에 `/api/v1/events` 가 생기고 도메인이 붙으면 이 값을
 * 채우는 것으로 실서비스 데이터로 갈아탄다.
 *
 * **주소가 `http://` 면 브라우저가 막는다.** duckmoim.com 은 HTTPS 라
 * HTTPS 페이지에서 HTTP 를 부르면 mixed content 로 차단된다. 서버끼리
 * 부르는 ISR 경로는 통하지만 목록 2페이지 이후는 브라우저가 직접 부른다
 * (API 설계 2-3). 그래서 백엔드 도메인과 인증서가 먼저다.
 * 지금 EC2 는 `http://3.34.148.51:8080` 이라 그대로는 못 붙인다.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? '').replace(/\/+$/, '')

/** API 를 부를 것인가. 비어 있으면 목데이터다 */
export const USE_API = API_BASE.length > 0

/**
 * ISR 재검증 주기(초).
 *
 * 행사는 하루 단위로 바뀌는 데이터라 분 단위로 다시 뽑을 이유가 없다.
 * 짧게 잡으면 Vercel 빌드·함수 시간이 그만큼 붙는다. 회의에서 정해지면
 * 이 값만 고친다. 1시간을 기본으로 둔다.
 */
export const REVALIDATE_SECONDS = Number(process.env.NEXT_PUBLIC_REVALIDATE ?? 3600)

/** 목록 한 번에 받는 개수. API 컨벤션의 `size` */
export const PAGE_SIZE = 50
