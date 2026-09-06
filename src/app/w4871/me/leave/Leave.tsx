'use client'

/**
 * 회원 탈퇴 (AU-11).
 *
 * **되돌릴 수 없는 것이라 무엇이 남는지를 먼저 말한다.**
 *
 * 「정말 탈퇴하시겠어요?」 만 묻고 지우면, 나간 뒤에 자기 댓글이 남아
 * 있는 것을 보고 속았다고 느낀다. 남는 것이 실제로 있다 — 처리방침
 * 제3조가 이미 공개한 내용이고, 화면이 그것과 다른 말을 하면 안 된다.
 *
 * 확인 체크를 둔다. 버튼 하나로 끝내면 마이메뉴에서 잘못 눌러 들어온
 * 사람이 그대로 나가진다.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Basics'
import { USE_API } from '@/lib/api/config'
import { apiSend } from '@/lib/api/http'
import { withAuth } from '@/lib/auth/refresh'
import { clearTokens } from '@/lib/auth/session'
import { slotFor } from '@/lib/api/errors'
import { ApiFailure } from '@/lib/api/http'
import { wf } from '@/lib/wireframe'

export default function Leave() {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const submit = async () => {
    setSending(true)
    setFailed(null)

    if (!USE_API) {
      /* 서버가 없다. 흐름만 확인하고 홈으로 보낸다 */
      setTimeout(() => {
        clearTokens()
        router.replace(wf('/bye'))
      }, 600)
      return
    }

    try {
      await withAuth(
        (token) => apiSend<null>('DELETE', '/api/v1/users/me', undefined, token),
        (e) => e instanceof ApiFailure && e.httpStatus === 401,
      )
      /* 성공했으면 이 기기에서도 나간다. 서버에 계정이 없는데 토큰이
         남아 있으면 다음 요청마다 401 을 받는다 */
      clearTokens()
      router.replace(wf('/bye'))
    } catch (e) {
      setSending(false)
      setFailed(slotFor(e).text)
    }
  }

  return (
    <PageShell title="회원 탈퇴" onBack={() => history.back()}>
      <div className="leave">
        <p className="leave__lead">
          탈퇴하면 되돌릴 수 없어요. 같은 카카오 계정으로 다시 가입해도
          예전 기록은 안 돌아와요.
        </p>

        {/* 지워지는 것과 남는 것을 나란히 둔다. 하나만 적으면 나머지를
            숨긴 것처럼 읽힌다 */}
        <section className="leave__box">
          <h2 className="leave__h">지워지는 것</h2>
          <ul className="leave__list">
            <li>닉네임, 한줄소개, 프로필 사진</li>
            <li>카카오 연결</li>
          </ul>
        </section>

        <section className="leave__box">
          <h2 className="leave__h">남는 것</h2>
          <ul className="leave__list">
            <li>
              쓰신 모집글과 댓글. 닉네임은 지우고 빈 자리로 둬요. 주고받던
              말이 중간에 끊기지 않게요
            </li>
            <li>
              신고나 이용 제한을 받은 기록. 정해진 기간 동안만 두고, 제재를
              피해 나갔다 다시 들어오는 것을 막는 데만 써요
            </li>
          </ul>
          <p className="leave__note">
            얼마나 두는지는{' '}
            <Link href="/privacy">개인정보 처리방침</Link> 제3조에 적어뒀어요.
          </p>
        </section>

        <label className="leave__agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>다 읽었어요. 탈퇴할게요</span>
        </label>

        {failed && <p className="leave__err">{failed}</p>}
      </div>

      <div className="form__bar">
        <Button block tone="danger" disabled={!agreed || sending} onClick={submit}>
          {sending ? '탈퇴하는 중…' : '탈퇴하기'}
        </Button>
      </div>
    </PageShell>
  )
}
