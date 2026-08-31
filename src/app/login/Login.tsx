'use client'

/**
 * 로그인.
 *
 * 소셜 로그인만 둔다. 아이디·비밀번호를 받지 않으므로 비밀번호 찾기와
 * 재설정 화면이 통째로 사라진다. 1주짜리 일정에서 그만큼이 크다.
 *
 * 최초 로그인이면 서버가 회원을 만들고 가입 정보 미입력 상태로
 * 들여보낸다 (AU-01). 그래서 이 화면에 "가입" 과 "로그인" 을 나누지
 * 않는다. 처음 온 사람도 같은 버튼을 누른다.
 *
 * 어디서 왔는지를 기억한다. 글을 읽다가 댓글을 누르고 로그인한
 * 사람은 그 글로 돌아가야지 홈으로 떨어지면 다시 찾아가야 한다.
 */
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { Button, KakaoMark } from '@/components/ui/Basics'

export default function Login() {
  const params = useSearchParams()
  /* 로그인 뒤 돌아갈 곳. 없으면 홈 */
  const next = params.get('next') ?? '/'
  const [busy, setBusy] = useState<string | null>(null)

  const start = (provider: string) => {
    setBusy(provider)
    /* 인증이 붙으면 여기서 인가 코드를 받으러 나간다.
       돌아올 때 next 를 그대로 들고 온다 */
    setTimeout(() => setBusy(null), 700)
  }

  return (
    <PageShell>
      <div className="login">
        <img className="login__mark" src="/duck-face.webp" alt="" width={132} height={132} />

        <h1 className="login__title">
          같이 갈 사람,
          <br />
          여기서 찾아요
        </h1>
        <p className="login__desc">
          콘서트·팝업·생일카페에 함께 갈 사람을 구합니다.
          <br />
          닉네임만 정하면 바로 쓸 수 있어요.
        </p>

        <div className="login__acts">
          <Button block tone="kakao" disabled={!!busy} onClick={() => start('kakao')}>
            <KakaoMark />
            {busy === 'kakao' ? '카카오로 이동 중…' : '카카오로 시작하기'}
          </Button>
          <Button block tone="ghost" disabled={!!busy} onClick={() => start('google')}>
            {busy === 'google' ? '구글로 이동 중…' : '구글로 시작하기'}
          </Button>
        </div>

        {/* 약관 동의를 따로 누르게 하지 않는다. 버튼을 누르는 것이
            동의라고 적어두는 방식이 널리 쓰이고 화면이 하나 준다 */}
        <p className="login__terms">
          시작하면 <a href="/terms">이용약관</a>과{' '}
          <a href="/privacy">개인정보 처리방침</a>에 동의하는 것으로 봅니다.
        </p>

        <a className="login__skip" href={next}>
          둘러보기만 할게요
        </a>
      </div>
    </PageShell>
  )
}
