import { issueState, stashNext } from './session'

/**
 * 카카오 인가 페이지로 나가는 주소를 만든다.
 *
 * 흐름은 이렇다 (API 설계 2-1).
 *
 *   1. 여기서 만든 주소로 나간다
 *   2. 카카오가 `redirect_uri` 로 `?code=...&state=...` 를 붙여 돌려보낸다
 *   3. 콜백 화면이 그 code 를 `POST /api/v1/auth/kakao` 로 넘긴다
 *   4. 서버가 자체 토큰을 준다
 *
 * **인가코드를 토큰으로 바꾸는 것은 서버다.** 그 교환에 카카오 시크릿이
 * 필요하고, 시크릿은 브라우저에 두면 안 된다. 프론트는 code 를 넘기기만
 * 한다.
 */

/**
 * 카카오 개발자 콘솔의 **REST API 키**.
 *
 * JavaScript 키가 아니다. `oauth/authorize` 의 `client_id` 는 REST API
 * 키를 받는다 (카카오 REST API 문서). JS 키는 지도 SDK 처럼
 * `Kakao.init` 에 쓰는 값이고 여기서는 안 통한다.
 *
 * 브라우저에 나가도 되는 값이다. 인가 주소에 실려 주소창에 그대로
 * 보인다. 감춰야 하는 것은 **클라이언트 시크릿** 이고 그건 백엔드가
 * 토큰 교환할 때만 쓴다.
 */
const REST_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_KEY ?? ''

/**
 * 카카오 콘솔에 등록한 Redirect URI 와 **글자 하나까지 같아야 한다.**
 * 다르면 카카오가 `KOE006` 으로 막는다.
 *
 * 배포마다 주소가 다르므로 origin 은 실행 중에 읽는다. 프리뷰 주소도
 * 콘솔에 등록해야 거기서 로그인이 된다.
 */
export const CALLBACK_PATH = '/auth/kakao/callback'

export function callbackUri(): string {
  return typeof window === 'undefined' ? CALLBACK_PATH : window.location.origin + CALLBACK_PATH
}

/** 키가 없으면 로그인 버튼을 눌러도 나갈 곳이 없다. 화면이 먼저 안다 */
export const KAKAO_READY = REST_KEY.length > 0

/**
 * 인가 주소.
 *
 * `next` 를 쿼리로 들려 보내지 않는다. 카카오가 그대로 돌려주는 것은
 * `state` 뿐이고, 거기에 돌아갈 곳까지 실으면 남이 그 값을 만들어
 * 보낼 수 있다. 우리 쪽에 저장해두고 돌아와서 꺼낸다.
 */
export function kakaoAuthorizeUrl(next: string): string {
  stashNext(next)
  const u = new URL('https://kauth.kakao.com/oauth/authorize')
  u.searchParams.set('client_id', REST_KEY)
  u.searchParams.set('redirect_uri', callbackUri())
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('state', issueState())
  /*
   * 동의 항목을 요청하지 않는다. 카카오에서 받는 것은 회원번호뿐이다
   * (결정 D-2). 닉네임·출생연도는 사용자가 직접 넣고(AU-05) 프로필
   * 이미지는 안 받는다. 안 쓸 것을 동의받으면 처리방침과도 어긋난다.
   */
  return u.toString()
}
