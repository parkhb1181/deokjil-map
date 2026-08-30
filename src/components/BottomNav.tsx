'use client'

import type { ReactNode } from 'react'

export type Tab = 'browse' | 'map' | 'course'

/**
 * 아이콘을 글자(≡ ◎ ♡)로 두지 않는다.
 * ◎ 는 지도가 아니라 녹화 버튼으로 읽히고, 나머지도 기기마다 다른 글꼴로
 * 그려져 셋의 굵기와 크기가 제각각이 된다. 같은 규격의 선으로 직접 그린다.
 */
const ICONS: Record<Tab, ReactNode> = {
  browse: <path d="M4 7h16M4 12h16M4 17h10" />,
  // 지도는 접힌 지도보다 핀이 작은 크기에서 훨씬 빨리 읽힌다
  map: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  course: (
    <path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20z" />
  ),
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'browse', label: '목록' },
  { id: 'map', label: '지도' },
  { id: 'course', label: '내 코스' },
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
 * 레퍼런스 세 서비스(오프메이트·팝플리·팝가)가 모두 쓰는 구조.
 * 이 카테고리의 표준 문법이라 여기서 벗어나면 학습 비용만 생긴다.
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
          <svg
            className="bottomnav__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {ICONS[tab.id]}
          </svg>
          {tab.label}
          {tab.id === 'course' && savedCount > 0 && (
            <span className="bottomnav__badge">{savedCount}</span>
          )}
        </button>
      ))}
    </nav>
  )
}
