'use client'

export type Tab = 'home' | 'list' | 'map' | 'course'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: '홈', icon: '⌂' },
  { id: 'list', label: '찾기', icon: '⌕' },
  { id: 'map', label: '지도', icon: '◎' },
  { id: 'course', label: '내 코스', icon: '♡' },
]

interface Props {
  active: Tab
  /** 담은 개수. 0 이면 배지를 달지 않는다. 빈 배지는 노이즈다 */
  savedCount: number
  onChange: (tab: Tab) => void
}

/**
 * 레퍼런스 세 서비스(오프메이트·팝플리·팝가)가 모두 쓰는 하단 탭 구조.
 * 이 카테고리의 표준 문법이라 여기서 벗어나면 학습 비용만 생긴다.
 *
 * '내 코스' 탭은 담기 기능(P2)과 함께 열었다. 빈 탭을 미리 노출하면
 * 첫인상에서 미완성으로 읽히므로 기능 없이 먼저 내보내지 않았다.
 */
export default function BottomNav({ active, savedCount, onChange }: Props) {
  return (
    <nav className="bottomnav" aria-label="주요 화면">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`bottomnav__item ${active === tab.id ? 'bottomnav__item--on' : ''}`}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          <span className="bottomnav__icon" aria-hidden>
            {tab.icon}
          </span>
          {tab.label}
          {tab.id === 'course' && savedCount > 0 && (
            <span className="bottomnav__badge">{savedCount}</span>
          )}
        </button>
      ))}
    </nav>
  )
}
