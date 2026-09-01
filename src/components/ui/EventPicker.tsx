'use client'

/**
 * 행사 고르기.
 *
 * 글에 이미지 업로드를 받지 않는다. 대신 **우리가 이미 가진 행사에서
 * 고른다.** 고른 행사의 대표 사진이 목록과 상세의 사진이 되고,
 * `event_id` 로 이벤트 상세와 이어진다.
 *
 * 셀렉트 상자를 쓰지 않는다. 204건은 스크롤로 훑을 양이 아니고,
 * OS 기본 셀렉트는 검색이 안 된다. 눌러야 펼쳐지는 이유도 같다.
 * 닫혀 있으면 한 줄이라 쓰기 화면이 짧아지고, 필요한 사람만 연다.
 *
 * 필수가 아니다. 콘서트처럼 우리 데이터에 없는 행사도 있어서,
 * 고르지 않아도 글을 올릴 수 있어야 한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'

export type PickableEvent = {
  id: string
  /** 아티스트·대상명 */
  subject: string
  title: string
  place: string
  district: string
  ends_on: string
  image_url: string | null
}

/** 화면에 한 번에 그리는 최대 개수. 검색으로 좁히라는 뜻이다 */
const SHOWN = 40

export function EventPicker({ all, picked, onPick }: {
  all: PickableEvent[]
  picked: PickableEvent | null
  onPick: (e: PickableEvent | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const boxRef = useRef<HTMLInputElement>(null)

  /* 오늘 날짜는 useEffect 에서 확정한다. 서버 프리렌더 시점은 빌드
     시각이라 그대로 쓰면 배포 다음날부터 끝난 행사가 남는다 */
  const [today, setToday] = useState('')
  useEffect(() => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    setToday(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  }, [])

  /* 펼치면 바로 칠 수 있게 한다. 열고 나서 또 입력칸을 눌러야 하면
     탭이 두 번이 된다 */
  useEffect(() => {
    if (open) boxRef.current?.focus()
  }, [open])

  const hits = useMemo(() => {
    /* 끝난 행사는 뺀다. 지난 정보는 없는 정보보다 나쁘다.
       today 가 비어 있는 첫 렌더에서는 사전순 비교가 항상 참이라
       전부 남는데, 그때는 아직 목록이 닫혀 있어 보이지 않는다 */
    const live = all.filter((e) => e.ends_on >= today)
    const key = q.trim().toLowerCase()
    if (!key) return live
    return live.filter((e) =>
      `${e.subject} ${e.title} ${e.place} ${e.district}`.toLowerCase().includes(key),
    )
  }, [all, q, today])

  /* 골랐으면 목록 자리에 고른 것만 남는다 */
  if (picked) {
    return (
      <div className="epick">
        <div className="epick__picked">
          {picked.image_url ? (
            <img className="epick__thumb" src={picked.image_url} alt="" />
          ) : (
            <span className="epick__thumb epick__thumb--none" />
          )}
          <span className="epick__pickedmain">
            <span className="epick__pickedtitle">{picked.title}</span>
            <span className="epick__pickedsub">
              {picked.subject} · {picked.district} · ~{picked.ends_on.slice(5).replace('-', '/')}
            </span>
          </span>
          <button
            type="button"
            className="epick__clear"
            onClick={() => {
              onPick(null)
              setOpen(false)
              setQ('')
            }}
            aria-label="고른 행사 지우기"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`epick${open ? ' epick--open' : ''}`}>
      <button
        type="button"
        className="epick__head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {/* 이름표는 바깥 fld__label 이 「행사」 로 세운다. 여기는 값이
            들어가는 자리라 아직 안 골랐다는 것만 말한다. 안쪽에도
            「함께 갈 행사」 를 두면 같은 말이 두 줄이 된다 */}
        <span className="epick__label epick__label--none">고르지 않음</span>
        {/* 선택 표시는 오른쪽 끝이다. 라벨에 붙이면 라벨의 일부처럼
            읽혀 한 덩어리가 된다 */}
        <span className="epick__opt">선택</span>
        <svg className="epick__caret" viewBox="0 0 16 16" aria-hidden focusable="false">
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="epick__panel">
          <div className="epick__search">
            <svg viewBox="0 0 16 16" aria-hidden focusable="false">
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              ref={boxRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="아티스트나 행사 이름"
              aria-label="행사 검색"
            />
          </div>

          {hits.length === 0 ? (
            <p className="epick__none">
              찾는 행사가 없어요. 고르지 않고 올려도 괜찮아요.
            </p>
          ) : (
            <ul className="epick__list">
              {hits.slice(0, SHOWN).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="epick__item"
                    onClick={() => {
                      onPick(e)
                      setOpen(false)
                      setQ('')
                    }}
                  >
                    {e.image_url ? (
                      <img className="epick__thumb" src={e.image_url} alt="" loading="lazy" />
                    ) : (
                      <span className="epick__thumb epick__thumb--none" />
                    )}
                    <span className="epick__itemmain">
                      <span className="epick__itemtitle">{e.title}</span>
                      <span className="epick__itemsub">
                        {e.subject} · {e.district}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {hits.length > SHOWN && (
                <li className="epick__more">
                  {hits.length - SHOWN}개 더 있어요. 이름으로 검색해보세요
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
