import { refreshTokens } from '@/lib/api/auth'
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './session'

/**
 * 토큰 재발급.
 *
 * Access 는 30분이면 만료된다 (AU-02). 그때마다 로그인시키지 않으려면
 * Refresh 로 새 쌍을 받아와야 한다.
 *
 * ─────────────────────────────────────────────────────────
 * **동시에 두 번 부르면 안 된다.**
 *
 * Refresh Rotation 이라 한 번 쓴 Refresh 는 죽는다. 그리고 **이미 쓴
 * 것을 다시 내밀면 서버가 그 유저의 세션을 통째로 폐기한다** (AU-03).
 * 도난당한 토큰을 막으려고 그렇게 설계된 것이다.
 *
 * 화면 여럿이 동시에 401 을 받는 일은 흔하다 — 목록과 프로필이 같이
 * 뜨는 순간이 그렇다. 각자 재발급을 부르면 두 번째가 이미 쓴 것을
 * 내밀고, **멀쩡한 사용자가 강제 로그아웃된다.**
 *
 * 그래서 진행 중인 요청을 붙잡아 두고 뒤에 온 쪽은 그것을 기다린다.
 * 탭이 여럿이면 이것으로도 못 막는다 — 그건 서버가 짧은 유예를 두는
 * 쪽으로 풀어야 하고, 여기서 할 수 있는 일이 아니다.
 */

/** 진행 중인 재발급. 없으면 null */
let inFlight: Promise<string | null> | null = null

/**
 * 새 Access 를 얻는다. 실패하면 `null` 이고 세션은 지워진다.
 *
 * 뒤에 온 호출은 앞의 것을 그대로 기다린다. 성공하면 같은 새 토큰을
 * 받고, 실패하면 다 같이 `null` 을 받는다.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (inFlight) return inFlight

  const refresh = getRefreshToken()
  if (!refresh) {
    /* 로그인한 적이 없거나 이미 지워졌다. 부를 것이 없다 */
    clearTokens()
    return Promise.resolve(null)
  }

  inFlight = refreshTokens(refresh)
    .then((r) => {
      saveTokens(r)
      return r.accessToken
    })
    .catch(() => {
      /*
       * Refresh 도 죽었다. 14일이 지났거나, 재사용이 탐지돼 서버가
       * 세션을 폐기했거나, 로그아웃된 뒤다.
       *
       * **다시 시도하지 않는다.** 재사용 탐지가 원인이면 재시도가
       * 정확히 그 상황을 한 번 더 만든다.
       */
      clearTokens()
      return null
    })
    .finally(() => {
      /* 다음 만료 때 다시 부를 수 있게 자리를 비운다 */
      inFlight = null
    })

  return inFlight
}

/**
 * 토큰을 붙여 부르고, 만료면 한 번만 새로 받아 다시 부른다.
 *
 * `call` 은 토큰을 받아 요청을 보내는 함수다. 401 이면 재발급하고 그
 * 함수를 한 번 더 부른다.
 *
 * **재시도는 한 번뿐이다.** 두 번째도 401 이면 토큰 문제가 아니라
 * 권한 문제다 — 계속 돌면 서버만 두드린다.
 *
 * 로그인이 아예 없으면 `call` 을 토큰 없이 부른다. 공개 경로가
 * 그렇게 동작해야 비회원도 읽을 수 있다 (CM-20).
 */
export async function withAuth<T>(
  call: (token: string | null) => Promise<T>,
  isExpired: (e: unknown) => boolean,
): Promise<T> {
  const token = getAccessToken()

  try {
    return await call(token)
  } catch (e) {
    if (!token || !isExpired(e)) throw e

    const fresh = await refreshAccessToken()
    if (!fresh) throw e

    return call(fresh)
  }
}

/** 테스트가 상태를 비울 자리. 화면 코드는 쓰지 않는다 */
export function __resetRefreshForTest(): void {
  inFlight = null
}
