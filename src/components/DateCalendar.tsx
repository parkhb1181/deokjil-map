'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { WEEKDAY_LABELS, dateLabel, monthGrid, type DateKey, type DateRange } from '@/lib/filters'

interface Props {
  /** 지금 선택된 날. '전체 기간'이면 null */
  selected: DateKey | null
  today: DateKey
  /** 고를 수 있는 마지막 날. 화살표 이동 한계와 같은 값이다 */
  maxDate: DateKey
  /** 날짜별 행사 수. 없는 날은 0으로 본다 */
  counts: Record<DateKey, number>
  onPick: (date: DateKey) => void
  onClose: () => void
  /**
   * 'range' 면 두 번 눌러 기간을 고른다. 기본은 하루짜리라
   * 지도의 날짜 이동은 그대로 둔다
   */
  mode?: 'single' | 'range'
  /** 지금 걸린 기간. range 모드에서만 쓴다 */
  range?: DateRange | null
  onPickRange?: (range: DateRange) => void
  /** 바깥 클릭으로 닫지 않는다. 시트 안에 들어갈 때 켠다 */
  inline?: boolean
}

/** 'YYYY-MM-DD' → [연, 월] */
function ym(date: DateKey): [number, number] {
  const [y, m] = date.split('-').map(Number)
  return [y, m]
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * 날짜 선택 달력.
 *
 * 화살표는 하루씩만 움직여서 "다음 주 토요일"로 가려면 여러 번 눌러야 했다.
 * 달력을 열면 한 달을 한눈에 보고 바로 짚을 수 있다.
 *
 * 각 날에 행사 수를 같이 찍는다. 날짜만 보여주면 어느 날이 볼 만한지
 * 눌러보기 전에는 알 수 없고, 결국 빈 날을 계속 헛짚게 된다.
 */
export default function DateCalendar({
  selected,
  today,
  maxDate,
  counts,
  onPick,
  onClose,
  mode = 'single',
  range = null,
  onPickRange,
  inline = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const anchor = range?.[0] ?? selected ?? today
  const [year, setYear] = useState(() => ym(anchor)[0])
  const [month, setMonth] = useState(() => ym(anchor)[1])

  /**
   * 시작일만 눌린 상태. 둘째 클릭에서 기간이 확정된다.
   *
   * 이 상태를 부모가 아니라 여기 두는 이유는, 반쯤 고른 것은 아직
   * 필터가 아니기 때문이다. 부모로 올리면 시작일만 누른 순간
   * 목록이 하루짜리로 한 번 걸렀다가 다시 바뀐다.
   */
  const [pending, setPending] = useState<DateKey | null>(null)

  // 바깥을 누르거나 Esc 로 닫는다. 달력은 임시로 여는 것이라 닫기 버튼을 따로 두지 않는다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    // 시트 안에서는 시트가 이미 바깥 클릭을 받는다. 여기서 또 들으면
    // 달력을 누른 것이 바깥 클릭으로 잡혀 시트째 닫힌다
    const id = inline
      ? 0
      : window.setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      window.clearTimeout(id)
    }
  }, [onClose, inline])

  const cells = useMemo(() => monthGrid(year, month), [year, month])

  const [minY, minM] = ym(today)
  const [maxY, maxM] = ym(maxDate)
  const atFirstMonth = monthKey(year, month) <= monthKey(minY, minM)
  const atLastMonth = monthKey(year, month) >= monthKey(maxY, maxM)

  const step = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1, 12)
    setYear(next.getFullYear())
    setMonth(next.getMonth() + 1)
  }

  /** 두 번 눌러 기간을 만든다. 거꾸로 누르면 뒤집어 받는다 */
  const pickRange = (date: DateKey) => {
    if (pending === null) {
      setPending(date)
      return
    }
    onPickRange?.(pending <= date ? [pending, date] : [date, pending])
    setPending(null)
  }

  return (
    <div
      className={`cal${inline ? ' cal--inline' : ''}`}
      ref={rootRef}
      role="dialog"
      aria-label={mode === 'range' ? '기간 선택' : '날짜 선택'}
    >
      <div className="cal__head">
        <button
          type="button"
          className="cal__nav"
          onClick={() => step(-1)}
          disabled={atFirstMonth}
          aria-label="이전 달"
        >
          ‹
        </button>
        <strong className="cal__month">
          {year}년 {month}월
        </strong>
        <button
          type="button"
          className="cal__nav"
          onClick={() => step(1)}
          disabled={atLastMonth}
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="cal__grid cal__grid--head" aria-hidden>
        {WEEKDAY_LABELS.map((w, i) => (
          <span key={w} className={`cal__wd ${i === 0 ? 'cal__wd--sun' : ''}`}>
            {w}
          </span>
        ))}
      </div>

      <div className="cal__grid">
        {cells.map((date, i) => {
          if (!date) return <span key={`x${i}`} className="cal__blank" />

          // 지난 날은 고를 수 없다. 종료된 행사는 애초에 목록에 없어서
          // 눌러도 빈 화면만 나온다 (poc-plan 4.3)
          const out = date < today || date > maxDate
          const n = counts[date] ?? 0

          // 확정된 기간의 양 끝과 그 사이. 반쯤 고른 시작일도 끝으로 친다
          const edge =
            mode === 'range'
              ? date === pending || date === range?.[0] || date === range?.[1]
              : date === selected
          const inside =
            mode === 'range' && !!range && !pending && date > range[0] && date < range[1]

          return (
            <button
              key={date}
              type="button"
              className={[
                'cal__day',
                edge ? 'cal__day--on' : '',
                inside ? 'cal__day--in' : '',
                date === today ? 'cal__day--today' : '',
                !out && n === 0 ? 'cal__day--empty' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={out}
              onClick={() => (mode === 'range' ? pickRange(date) : onPick(date))}
              aria-label={`${month}월 ${Number(date.slice(-2))}일, ${n}곳`}
            >
              <span className="cal__n">{Number(date.slice(-2))}</span>
              {/* 0곳인 날에 '0'을 찍으면 숫자만 빽빽해진다. 있는 날만 표시한다 */}
              <span className="cal__count">{n > 0 ? n : ''}</span>
            </button>
          )
        })}
      </div>

      {/* 두 번 눌러야 하는 것을 알 방법이 없다. 지금 어느 차례인지 적는다.
          하루만 볼 거면 같은 날을 두 번 누르면 된다는 것도 여기서 알린다 */}
      {mode === 'range' && (
        <p className="cal__hint" aria-live="polite">
          {pending
            ? `${dateLabel(pending)} 부터 · 끝나는 날을 누르세요`
            : '시작하는 날을 누르세요. 하루만 보려면 같은 날을 두 번'}
        </p>
      )}
    </div>
  )
}
