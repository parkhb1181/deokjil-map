'use client'

import { Fragment, type ReactNode } from 'react'
import { wf } from '@/lib/wireframe'

export type Tab = 'browse' | 'map' | 'bookmark'

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
  bookmark: (
    <path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20z" />
  ),
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'browse', label: '목록' },
  { id: 'map', label: '지도' },
  { id: 'bookmark', label: '즐겨찾기' },
]

/**
 * 동행 입구.
 *
 * 전에는 하단 탭에 넣지 않았다. 나머지 셋이 같은 데이터(행사)를 다르게
 * 보는 것이라, 성격이 다른 동행을 끼우면 넷 다 무슨 묶음인지 흐려진다는
 * 이유였다.
 *
 * 그 이유는 여전히 맞지만, 헤더를 걷어내면서 동행이 갈 자리가 없어졌다.
 * 검색줄에 얹어 봤더니 그 줄이 세 가지 일(브랜드·검색·이동)을 하게 돼서
 * 더 나빴다. 여기가 덜 나쁘다.
 *
 * 탭이 아니라 링크다. 나머지 셋은 같은 화면 안에서 보기를 바꾸지만
 * 이건 다른 화면으로 나간다. 그래서 눌러도 활성 표시가 붙지 않는다.
 */
const COMPANION = {
  href: '/p',
  label: '동행',
  icon: (
    <>
      <circle cx="9.5" cy="8" r="3" />
      <path d="M3.5 20c0-3.2 2.7-5 6-5s6 1.8 6 5" />
      <circle cx="17.5" cy="9.2" r="2.3" />
      <path d="M16.6 15.3c2.7.3 4.9 2 4.9 4.7" />
    </>
  ),
}

interface Props {
  active: Tab
  /** 담은 개수. 0 이면 배지를 달지 않는다. 빈 배지는 노이즈다 */
  savedCount: number
  onChange: (tab: Tab) => void
  /** 동행 칸을 넣을지. 와이어프레임 주소에서만 켠다 */
  companion?: boolean
}

/**
 * 하단 탭.
 *
 * 레퍼런스 세 서비스(오프메이트·팝플리·팝가)가 모두 쓰는 구조.
 * 이 카테고리의 표준 문법이라 여기서 벗어나면 학습 비용만 생긴다.
 */
export default function BottomNav({ active, savedCount, onChange, companion = false }: Props) {
  return (
    <nav className="bottomnav" aria-label="주요 화면">
      {TABS.map((tab) => (
        <Fragment key={tab.id}>
          {/* 동행은 지도와 즐겨찾기 사이에 낀다. 맨 끝에 두면 즐겨찾기가
              가운데로 밀려 손이 기억한 자리가 바뀐다 */}
          {tab.id === 'bookmark' && companion && (
            <a className="bottomnav__item" href={wf(COMPANION.href)}>
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
                {COMPANION.icon}
              </svg>
              {COMPANION.label}
            </a>
          )}

          <button
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
            {tab.id === 'bookmark' && savedCount > 0 && (
              <span className="bottomnav__badge">{savedCount}</span>
            )}
          </button>
        </Fragment>
      ))}
    </nav>
  )
}
