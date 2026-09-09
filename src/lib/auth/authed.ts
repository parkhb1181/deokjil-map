'use client'

import { ApiFailure } from '@/lib/api/http'
import { withAuth } from './refresh'

/**
 * 로그인이 필요한 요청을 보낸다.
 *
 * ─────────────────────────────────────────────────────────
 * **`withAuth` 를 화면에서 직접 부르지 않는 이유.**
 *
 * `withAuth` 는 토큰이 없으면 `null` 을 넘겨 그대로 부른다. 공개 조회가
 * 그렇게 동작해야 비회원이 읽을 수 있기 때문이다 (CM-20). 그런데 **쓰기는
 * 반대다** — 토큰 없이 보내면 서버가 401 을 주고, 화면은 그것을 「로그인이
 * 풀렸다」 로 읽어 재발급을 시도한다. 로그인한 적이 없는 사람에게
 * 재발급이 도는 것은 낭비고, 실패 문구도 「다시 로그인해주세요」 가 되어
 * 한 번도 로그인 안 한 사람에게 이상하게 들린다.
 *
 * 그래서 여기서 먼저 끊는다. 토큰이 없으면 서버를 부르지 않고
 * `NOT_SIGNED_IN` 을 던진다. 화면은 그 코드를 보고 로그인 안내를 띄운다.
 *
 * 만료된 토큰은 `withAuth` 가 한 번 재발급해 다시 보낸다. **재발급은
 * 진행 중인 것 하나로 묶여 있어** 화면 여럿이 동시에 써도 서버는 한 번만
 * 맞는다 (`refresh.ts`). Refresh Rotation 이라 두 번 보내면 서버가
 * 재사용으로 보고 세션을 통째로 폐기한다 (AU-03).
 */
export async function authed<T>(call: (token: string) => Promise<T>): Promise<T> {
  return withAuth<T>(
    (token) => {
      if (!token) {
        throw new ApiFailure('NOT_SIGNED_IN', '로그인이 필요합니다', 401)
      }
      return call(token)
    },
    /*
     * 재발급을 시도할 조건.
     *
     * **`NOT_SIGNED_IN` 은 여기 안 걸린다.** 코드로 갈라야 한다 — 상태만
     * 보면 401 이 둘 다라 로그인한 적 없는 사람에게도 재발급이 돈다.
     */
    (e) => e instanceof ApiFailure && e.httpStatus === 401 && e.code !== 'NOT_SIGNED_IN',
  )
}
