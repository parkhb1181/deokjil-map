'use client'

export type Tab = 'browse' | 'map' | 'course'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'browse', label: '목록', icon: '≡' },
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
 * 하단 탭.
 *
 * 홈과 찾기를 하나로 합쳤다. 둘 다 같은 목록에 같은 필터를 걸고 있었고
 * 차이는 검색창 하나뿐이라, 탭을 나눌 이유가 없었다.
 * 검색창을 목록 위로 올리면서 탭이 셋으로 줄었고 각자 답하는 질문이 갈렸다.
 * 목록은 "뭐가 있나", 지도는 "어디 붙어 있나", 내 코스는 "내가 담은 것".
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
