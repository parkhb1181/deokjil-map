import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { wf } from '@/lib/wireframe'

/**
 * 로그아웃 완료 (AU-04).
 *
 * ─────────────────────────────────────────────────────────
 * **왜 화면을 따로 두나.**
 *
 * 로그아웃하면 곧장 홈으로 보내고 있었다. 그런데 홈은 로그인 전과
 * 후가 오른쪽 위 버튼 하나만 다르다. 눌러서 나간 사람이 도착한
 * 화면에서 확인할 수 있는 것이 그 작은 버튼뿐이라, 정말 나간 것인지
 * 확인하려고 내 활동에 다시 들어가 보게 된다.
 *
 * 탈퇴에는 이런 화면이 있는데(`/bye`) 로그아웃에만 없었다. 되돌릴 수
 * 없는 쪽만 알려주고 되돌릴 수 있는 쪽은 말없이 넘긴 셈이다.
 *
 * **`/me` 아래에 두지 않는 이유는 `/bye` 와 같다.** 여기 오는 사람은
 * 이미 로그아웃된 상태다. 나중에 그 경로에 인증을 걸면 이 화면까지
 * 같이 막힌다.
 *
 * 화면 뼈대는 `.bye` 를 그대로 쓴다. 「끝났다 + 한 줄 설명 + 나가는
 * 문」 이라는 같은 모양이고, 여기서 또 하나 만들면 둘 중 하나만
 * 고쳐지는 날이 온다.
 *
 * 서버 컴포넌트다. 누를 것이 링크뿐이라 상태가 없다.
 */
export const metadata: Metadata = {
  title: '로그아웃 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <PageShell>
      <div className="bye">
        <img className="bye__mark" src="/duck-face.webp" alt="" width={88} height={88} />

        <h1 className="bye__title">로그아웃했어요</h1>

        {/* 담아둔 행사는 이 기기에 그대로 남는다. 로그인과 무관하게
            저장되는 값이라(bookmark.ts) 나갔다고 사라지지 않는다.
            묻지 않아도 궁금해할 것이라 먼저 말한다 */}
        <p className="bye__desc">
          이 기기에서 나갔어요. 담아둔 행사는 그대로 있어요.
        </p>

        <p className="bye__sub">다시 쓰려면 카카오로 로그인하면 돼요.</p>

        <Link className="btn btn--primary btn--block" href={wf('/home')}>
          처음으로
        </Link>

        <Link className="btn btn--ghost btn--block" href={wf('/login')}>
          다시 로그인
        </Link>
      </div>
    </PageShell>
  )
}
