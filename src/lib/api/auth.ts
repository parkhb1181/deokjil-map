import { apiSend } from './http'

/**
 * 인증 (API 설계 2-1).
 *
 * 토큰은 전부 헤더로 오간다. Access 는 `Authorization: Bearer`,
 * Refresh 는 재발급 요청 body 다. 쿠키를 쓰지 않는다 (결정 D-1).
 */

export interface LoginResult {
  accessToken: string
  refreshToken: string
  /** 가입 정보를 넣었는가. 화면이 /welcome 으로 보낼지 정하는 유일한 근거다 */
  signupCompleted: boolean
}

/** 인가코드를 자체 토큰으로. 최초면 서버가 회원을 만든다 (AU-01) */
export async function loginWithKakao(code: string, redirectUri: string): Promise<LoginResult> {
  const r = await apiSend<LoginResult>('POST', '/api/v1/auth/kakao', { code, redirectUri })
  if (!r) throw new Error('로그인 응답이 비었습니다')
  return r
}

/**
 * 재발급 (AU-03). Refresh Rotation 이다.
 *
 * **한 번 쓴 Refresh 는 두 번 못 쓴다.** 재사용을 서버가 보면 그 유저의
 * 세션을 전부 폐기하고 401 을 준다. 그래서 이 함수를 동시에 두 번
 * 부르면 안 된다 — 두 번째가 폐기를 부른다. 부르는 쪽에서 하나로 묶는다.
 */
export async function refreshTokens(refreshToken: string): Promise<LoginResult> {
  const r = await apiSend<LoginResult>('POST', '/api/v1/auth/token', { refreshToken })
  if (!r) throw new Error('재발급 응답이 비었습니다')
  return r
}

/** 로그아웃 (AU-04). 서버가 Refresh 를 지우고 남은 Access 를 막는다 */
export function logout(accessToken: string): Promise<null> {
  return apiSend<null>('DELETE', '/api/v1/auth/token', undefined, accessToken)
}
