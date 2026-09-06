'use client'

/**
 * 카카오에서 돌아온 자리.
 *
 * 인가코드를 서버에 넘겨 자체 토큰으로 바꾸고, 가입 정보를 넣었는지에
 * 따라 갈라 보낸다 (AU-01 · AU-05).
 *
 * **화면이 거의 없다.** 지나가는 자리라 성공하면 아무것도 안 보이고
 * 바로 넘어간다. 보이는 것은 실패했을 때뿐이다.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Basics'
import { loginWithKakao } from '@/lib/api/auth'
import { callbackUri } from '@/lib/auth/kakao-url'
import { saveTokens, takeNext, takeState } from '@/lib/auth/session'
import { slotFor } from '@/lib/api/errors'
import { wf } from '@/lib/wireframe'

export default function Callback() {
  const router = useRouter()
  const params = useSearchParams()
  const [failed, setFailed] = useState<string | null>(null)

  /*
   * 개발에서 이펙트가 두 번 돈다 (StrictMode). 인가코드는 **한 번만
   * 쓸 수 있어서** 두 번째 요청이 반드시 실패하고, 그 실패가 화면에
   * 뜬다. 실제로는 첫 번째가 성공했는데도 그렇다.
   */
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code = params.get('code')
    const state = params.get('state')
    /* 사용자가 카카오 화면에서 취소하면 code 대신 error 가 온다 */
    const denied = params.get('error')

    if (denied) {
      setFailed(
        denied === 'access_denied'
          ? '로그인을 취소했어요'
          : '카카오 로그인에 실패했어요',
      )
      return
    }
    if (!code) {
      setFailed('로그인 정보가 오지 않았어요')
      return
    }

    /*
     * 우리가 보낸 요청인지 확인한다.
     *
     * 남이 자기 인가코드로 우리 페이지를 열면 피해자 브라우저가 남의
     * 계정으로 로그인된다. state 가 그걸 막는다. 저장해둔 값과 다르면
     * 코드를 아예 서버에 넘기지 않는다.
     */
    const mine = takeState()
    if (!mine || mine !== state) {
      setFailed('로그인 요청이 확인되지 않았어요. 다시 시도해주세요')
      return
    }

    loginWithKakao(code, callbackUri())
      .then((r) => {
        saveTokens(r)
        const next = takeNext()
        /*
         * 가입 정보를 안 넣었으면 거기부터다 (AU-05). 서버가 준
         * signupCompleted 가 유일한 근거다 — 화면이 짐작하면 이미
         * 채운 사람에게 다시 묻게 된다.
         *
         * replace 다. 뒤로가기가 인가코드가 붙은 이 주소로 돌아오면
         * 이미 쓴 코드로 다시 요청한다.
         */
        router.replace(
          r.signupCompleted ? next : wf(`/welcome?next=${encodeURIComponent(next)}`),
        )
      })
      .catch((e) => {
        const slot = slotFor(e)
        setFailed(slot.text)
      })
  }, [params, router])

  if (!failed) {
    return (
      <PageShell>
        <p className="authwait">로그인 중이에요…</p>
      </PageShell>
    )
  }

  return (
    <PageShell title="로그인">
      <div className="authfail">
        <p className="authfail__msg">{failed}</p>
        <Button block onClick={() => router.replace(wf('/login'))}>
          다시 시도
        </Button>
      </div>
    </PageShell>
  )
}
