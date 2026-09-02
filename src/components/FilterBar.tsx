'use client'

/**
 * 유형·지역 필터 바.
 *
 * 전에는 칩을 전부 늘어놓았다. 유형 넷과 지역 넷이 한 줄에 여덟 개라
 * 옆으로 흘렀고, 지금 무엇이 걸려 있는지 보려면 줄을 끝까지 밀어야
 * 했다. 지역이 늘수록 나빠지는 구조다.
 *
 * 그래서 **고른 것만 보이게** 바꿨다. 고른 값은 지울 수 있는 알약이
 * 되고, 안 고른 축은 「지역 선택」 처럼 눌러서 여는 버튼 하나로 접힌다.
 * 지금 무엇이 걸려 있는지가 줄 맨 앞에서 바로 읽힌다.
 *
 * 시트로 여는 이유는 목록이 길어서다. 지역은 열한 개고 드롭다운으로
 * 두면 좁은 화면에서 절반이 잘린다. 시트는 아래에서 올라와 화면을
 * 다 쓴다.
 *
 * 숫자를 같이 적는다. 눌러 놓고 빈 화면을 만나지 않게 하려는 것이고,
 * 그 숫자는 자기를 뺀 나머지 조건을 반영한다.
 */
import { useState, type ReactNode } from 'react'

export type Choice = { value: string; label: string; count?: number }

export type Axis = {
  /** 'kind' · 'district' 같은 필터 키 */
  key: string
  /** 안 골랐을 때 버튼에 적히는 말. "지역 선택" */
  placeholder: string
  /** 시트 제목 */
  title: string
  options: Choice[]
  /** 지금 고른 값. 'all' 이면 안 고른 것으로 본다 */
  value: string
  onPick: (v: string) => void
  /**
   * 시트 안에 옵션 목록 대신 이걸 그린다. 기간처럼 값이 목록으로
   * 떨어지지 않는 축에 쓴다. 달력을 옵션 60개로 펴면 시트가
   * 스크롤 덩어리가 되고 어느 날이 주말인지도 알 수 없다.
   */
  render?: (close: () => void) => ReactNode
  /** 알약에 적히는 말. `options` 에 없는 값을 가진 축이 쓴다 */
  pillLabel?: string
}

export function FilterBar({ axes, query, onQuery }: {
  axes: Axis[]
  query: string
  onQuery: (v: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const sheet = axes.find((a) => a.key === open) ?? null

  return (
    <div className="fbar">
      {/* 검색이 맨 앞이다. 필터로 좁히는 것보다 이름을 치는 쪽이 빠른
          경우가 많고, 사람들이 먼저 손을 대는 자리이기도 하다.

          와이어프레임 빌드에서는 이 줄에 로고와 동행이 같이 선다.
          헤더가 로고 하나만 이고 91px 를 먹던 것을 여기로 합쳤다 */}
      <div className="fbar__search">
          <svg viewBox="0 0 16 16" aria-hidden focusable="false">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="대상 · 카페명 검색"
            aria-label="검색"
          />
          {query && (
            <button type="button" className="fbar__x" onClick={() => onQuery('')} aria-label="검색어 지우기">
              ✕
            </button>
          )}
        </div>

      <div className="fbar__row" role="group" aria-label="필터">
        {axes.map((a) => {
          const on = a.value !== 'all'
          const picked = a.options.find((o) => o.value === a.value)
          return on ? (
            /* 고른 값. 알약 안에 X 를 붙여 한 번에 지운다. 다시 열어
               「전체」 를 찾아 누르게 하면 두 번 눌러야 한다 */
            <span className="fbar__on" key={a.key}>
              <button type="button" className="fbar__onlabel" onClick={() => setOpen(a.key)}>
                {picked?.label ?? a.pillLabel ?? a.value}
              </button>
              <button
                type="button"
                className="fbar__clear"
                onClick={() => a.onPick('all')}
                aria-label={`${a.title} 조건 지우기`}
              >
                ✕
              </button>
            </span>
          ) : (
            <button type="button" className="fbar__btn" key={a.key} onClick={() => setOpen(a.key)}>
              {a.placeholder}
              <svg viewBox="0 0 12 12" aria-hidden focusable="false">
                <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )
        })}
      </div>


      {sheet && (
        <div className="fsheet" onClick={() => setOpen(null)}>
          <div className="fsheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="fsheet__head">
              <h2>{sheet.title}</h2>
              <button type="button" onClick={() => setOpen(null)} aria-label="닫기">✕</button>
            </div>
            {sheet.render ? (
              <div className="fsheet__custom">{sheet.render(() => setOpen(null))}</div>
            ) : (
              <ul className="fsheet__list">
                {sheet.options.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      className={`fsheet__item${sheet.value === o.value ? ' fsheet__item--on' : ''}`}
                      aria-pressed={sheet.value === o.value}
                      onClick={() => {
                        sheet.onPick(o.value)
                        setOpen(null)
                      }}
                    >
                      <span>{o.label}</span>
                      {o.count !== undefined && <em>{o.count}</em>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
