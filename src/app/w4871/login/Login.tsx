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
import { useRouter, useSearchParams } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { Button, KakaoMark } from '@/components/ui/Basics'
import { wf } from '@/lib/wireframe'
import { kakaoAuthorizeUrl, KAKAO_READY } from '@/lib/auth/kakao-url'

export default function Login() {
  const router = useRouter()
  const params = useSearchParams()
  /* 로그인 뒤 돌아갈 곳. 없으면 홈 */
  const next = params.get('next') ?? '/'
  const [busy, setBusy] = useState<string | null>(null)

  const start = (provider: string) => {
    setBusy(provider)

    /*
     * 카카오 키가 없으면 나갈 곳이 없다. 로컬과 팀 미리보기가 그렇다.
     * 그때는 최초 로그인인 척하고 가입 정보 입력으로 넘긴다 — 화면
     * 흐름은 볼 수 있어야 한다.
     */
    if (!KAKAO_READY) {
      setTimeout(() => {
        setBusy(null)
        router.push(wf(`/welcome?next=${encodeURIComponent(next)}`))
      }, 700)
      return
    }

    /*
     * 카카오 인가 페이지로 나간다. 돌아오는 곳은 /auth/kakao/callback
     * 이고 거기서 인가코드를 서버에 넘긴다 (AU-01).
     *
     * router.push 가 아니라 location 이다. 바깥 도메인이라 Next 라우터가
     * 다루지 못한다.
     *
     * next 를 쿼리로 들려 보내지 않는다. 카카오가 돌려주는 것은 state
     * 뿐이라, 돌아갈 곳은 우리 쪽에 저장해두고 꺼낸다.
     */
    window.location.href = kakaoAuthorizeUrl(next)
  }

  return (
    <PageShell>
      <div className="login">
        {/* 로고부터 설명까지가 한 덩어리다. 남는 공간을 이 덩어리가
            먹고 그 안에서 가운데로 모인다 */}
        <div className="login__top">
          <img className="login__mark" src="/duck-face.webp" alt="" width={112} height={112} />

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
        </div>

        {/* 카카오 하나만 둔다. 고를 것이 둘이면 어느 쪽으로 가입했는지
            기억해야 하고, 다음에 다른 쪽을 누르면 남남인 계정이 하나 더
            생긴다. 국내 서비스에서 카카오를 안 쓰는 사람은 드물다 */}
        <div className="login__acts">
          <Button block tone="kakao" disabled={!!busy} onClick={() => start('kakao')}>
            <KakaoMark />
            {busy === 'kakao' ? '카카오로 이동 중…' : '카카오로 시작하기'}
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
