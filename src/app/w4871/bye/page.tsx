import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { wf } from '@/lib/wireframe'

/**
 * 탈퇴 완료 (AU-11).
 *
 * **`/me` 아래에 두지 않는다.** 여기 오는 사람은 이미 로그아웃된
 * 상태다. 내 화면 주소에 두면 로그인이 필요한 자리처럼 읽히고,
 * 나중에 그 경로에 인증을 걸 때 이 화면까지 같이 막힌다.
 *
 * 뒤로가기로 탈퇴 폼에 돌아가지 않게 replace 로 온다 (Leave.tsx).
 *
 * 서버 컴포넌트다. 누를 것이 링크 하나뿐이라 상태가 없다.
 */
export const metadata: Metadata = {
  title: '탈퇴 완료 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <PageShell>
      <div className="bye">
        <img className="bye__mark" src="/duck-face.webp" alt="" width={88} height={88} />

        <h1 className="bye__title">탈퇴가 끝났어요</h1>

        {/* 무엇이 남았는지 한 번 더 말한다. 탈퇴 화면에서 읽었더라도
            방금 일어난 일이라 여기서 확인받고 싶어한다 */}
        <p className="bye__desc">
          회원 정보를 지웠습니다. 쓰신 글과 댓글은 닉네임 없이 자리표시자로
          남아 있어요.
        </p>

        <p className="bye__sub">
          다시 오고 싶어지면 카카오로 새로 가입하시면 됩니다. 다만 이전
          기록은 돌아오지 않아요.
        </p>

        <Link className="btn btn--primary btn--block" href={wf('/')}>
          처음으로
        </Link>
      </div>
    </PageShell>
  )
}
