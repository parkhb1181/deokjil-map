'use client'

/**
 * 페이지 껍데기.
 *
 * 헤더·뒤로가기·본문 폭을 한 곳에서 정한다. 화면마다 각자 만들면
 * 헤더 높이와 좌우 시작선이 조금씩 달라지고, 그 차이는 화면을
 * 오갈 때 덜컹거림으로 보인다.
 *
 * 좌우 시작선은 --gutter 하나로 관리한다. 개별 16px 을 쓰지 않는다.
 */
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'

export function PageShell({ title, right, children, onBack }: {
  /** 헤더 가운데 줄. 스크롤과 상관없이 계속 보인다 */
  title?: string
  right?: ReactNode
  children: ReactNode
  /** 안 주면 브라우저 뒤로가기 */
  onBack?: () => void
}) {
  const router = useRouter()

  return (
    <div className="shell">
      <header className="shell__bar">
        <button
          type="button"
          className="shell__back"
          onClick={onBack ?? (() => router.back())}
          aria-label="뒤로"
        >
          <svg viewBox="0 0 20 20" aria-hidden focusable="false">
            <path
              d="M12.5 4 6.5 10l6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {title && <span className="shell__title">{title}</span>}
        {right && <span className="shell__right">{right}</span>}
      </header>
      <main className="shell__body">{children}</main>
    </div>
  )
}

/**
 * 화면 아래에 붙는 행동 막대.
 *
 * 댓글 입력처럼 항상 손에 닿아야 하는 것을 담는다. 홈 인디케이터에
 * 가리지 않도록 safe-area 를 더한다.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="shell__foot">{children}</div>
}
