import { logout } from '@/lib/api/auth'
import { USE_API } from '@/lib/api/config'
import { clearTokens, getAccessToken } from './session'

/**
 * 로그아웃.
 *
 * 서버에 알리고 이 기기에서 지운다 (AU-04). 서버는 Refresh 를 지우고
 * 남은 Access 의 잔여 시간을 막는다.
 *
 * ─────────────────────────────────────────────────────────
 * **서버가 실패해도 이 기기에서는 나간다.**
 *
 * 「로그아웃했는데 로그인 상태」 가 제일 나쁘다. 남의 기기에서 눌렀거나
 * 지하철에서 눌렀는데 실패 안내가 뜨고 그대로 남아 있으면, 사용자는
 * 나간 줄 알고 자리를 뜬다.
 *
 * 그래서 순서가 정해져 있다 — 서버를 먼저 부르고, **성패와 무관하게**
 * 토큰을 지운다. 서버 쪽이 안 지워졌다면 그 토큰은 만료까지 살아
 * 있지만 우리 손에 없으므로 쓸 수 없다. 30분이면 죽는다.
 */
export async function signOut(): Promise<void> {
  const token = getAccessToken()

  if (USE_API && token) {
    try {
      await logout(token)
    } catch {
      /* 네트워크가 끊겼거나 토큰이 이미 죽었다. 어느 쪽이든 나간다 */
    }
  }

  clearTokens()
}
