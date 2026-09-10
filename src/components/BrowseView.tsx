'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { EventItem, EventKind } from '@/types'
import {
  DISTRICT_LABELS,
  EVENT_KIND_LABELS,
  countsByDate,
  filterEvents,
  rangeLabel,
  shiftDate,
  SORT_LABELS,
  sortByKey,
  type DateRange,
  type SortKey,
  type DistrictFilter,
  type FilterState,
  type KindFilter,
} from '@/lib/filters'
import DateCalendar from './DateCalendar'
import EventCard from './EventCard'
import TopSubjects from './TopSubjects'
import UpcomingConcerts from './UpcomingConcerts'
import { FilterBar } from './FilterBar'

interface Props {
  events: EventItem[]
  today: string
  filter: FilterState
  onFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  onOpen: (id: string) => void
}

/** 지역 칩은 상위 몇 개까지만 낸다 */
const DISTRICT_CHIPS = 11

/**
 * 목록을 한 번에 그리는 개수.
 *
 * 30 은 375px 화면에서 열 번쯤 밀어야 바닥에 닿는 양이다. 더 줄이면
 * 스크롤 중에 붙이는 일이 잦아지고, 더 늘리면 첫 렌더가 다시 무거워진다.
 */
const STEP = 30

/** 기간 달력에서 고를 수 있는 마지막 날. 지도의 날짜 이동 한계와 같은 값이다 */
const MAX_AHEAD_DAYS = 60

/**
 * 목록 화면. 예전의 홈과 찾기를 합친 것이다.
 *
 * 둘은 같은 목록에 같은 필터를 걸고 있었고 차이가 검색창 하나뿐이었다.
 * 나눠 둔 동안 "홈과 전체가 무슨 차이냐"는 말이 계속 나왔다.
 *
 * 지역별 섹션도 걷어냈다. 지역 필터와 지역 섹션이 같은 일을 두 번 하고 있었고,
 * 홍대가 191건 중 134건이라 나눠도 "홍대 하나 + 부스러기"였다.
 * 대신 하나로 합쳐 마감 임박 순으로 세운다. 섹션이 하던 일(어디에 얼마나 있나)은
 * 지역 칩에 붙은 숫자가 받는다.
 *
 * 날짜 칩은 뺐다. 이 서비스의 질문이 "오늘 뭐 하지"라 기본값이 곧 답이고,
 * 칩 일곱 개가 세로로 40px 를 먹으면서 첫 화면에서 카드를 밀어냈다.
 *
 * 대신 기간을 시트 속 달력으로 넣었다. 칩으로 돌아간 것이 아니다.
 * 접혀 있어 첫 화면을 먹지 않고, 안 고르면 안 걸린다. 기본값은
 * 여전히 「전부」 라 목록을 열자마자 좁혀지는 일이 없다.
 *
 * 지도의 날짜 축과는 다른 축이다. 지도는 화살표로 하루씩 넘기고,
 * 여기는 "이번 주말" 처럼 며칠을 묶는다. 하루로는 주말을 못 고른다.
 */
export default function BrowseView({ events, today, filter, onFilter, onOpen }: Props) {
  // 날짜·지역은 여기서 걸지 않는다. 아래에서 축별로 따로 센다
  const base = useMemo(
    () => filterEvents(events, { ...filter, date: 'all', district: 'all', kind: 'all' }, today),
    [events, filter, today],
  )

  // 칩에 붙는 숫자는 자기를 뺀 나머지 조건을 반영해야 한다.
  // 전체 건수를 그대로 쓰면 눌러 놓고 빈 화면을 만난다
  const kindOptions = useMemo(() => {
    const pool = filter.district === 'all' ? base : base.filter((e) => e.place.district === filter.district)
    const count = (k: KindFilter) => (k === 'all' ? pool.length : pool.filter((e) => e.kind === k).length)
    /* 0 건인 종류는 칩을 안 만든다. 콘서트는 아직 데이터가 없을 수
       있어서(크롤러가 안 긁고 KOPIS 도 안 붙었다) 늘 그리면 눌러도
       빈 화면인 칩이 하나 생긴다. 지금 고른 종류는 0 건이어도 남긴다.
       누른 칩이 사라지면 무엇을 눌렀는지 알 수 없다 */
    const kinds: KindFilter[] = ['BIRTHDAY_CAFE', 'POPUP', 'CONCERT']
    return [
      { value: 'all', label: '전체', count: count('all') },
      ...kinds
        .filter((k) => count(k) > 0 || filter.kind === k)
        .map((k) => ({ value: k as string, label: EVENT_KIND_LABELS[k as EventKind], count: count(k) })),
    ]
  }, [base, filter.district, filter.kind])

  const districtOptions = useMemo(() => {
    const pool = filter.kind === 'all' ? base : base.filter((e) => e.kind === filter.kind)
    const by = new Map<string, number>()
    for (const e of pool) by.set(e.place.district, (by.get(e.place.district) ?? 0) + 1)
    const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, DISTRICT_CHIPS)
    const opts = [
      { value: 'all', label: '전 지역', count: pool.length },
      ...top.map(([d, n]) => ({
        value: d as string,
        label: DISTRICT_LABELS[d as keyof typeof DISTRICT_LABELS] ?? d,
        count: n,
      })),
    ]
    // 고른 지역이 상위 3위 밖이면 칩이 사라져 해제할 방법이 없어진다
    if (filter.district !== 'all' && !opts.some((o) => o.value === filter.district)) {
      const n = pool.filter((e) => e.place.district === filter.district).length
      opts.push({
        value: filter.district as string,
        label: DISTRICT_LABELS[filter.district as keyof typeof DISTRICT_LABELS] ?? filter.district,
        count: n,
      })
    }
    return opts
  }, [base, filter.kind, filter.district])

  const maxDate = useMemo(() => shiftDate(today, MAX_AHEAD_DAYS, today), [today])

  /* 달력 칸에 찍는 숫자. 다른 축과 같은 규칙으로 자기(기간)만 빼고
     지역·유형·검색어를 반영한다. 홍대만 보는 중에 서울 전체 건수를
     찍으면 날짜를 눌러 놓고 빈 화면을 만난다 */
  const dateCounts = useMemo(
    () => countsByDate(events, filter, today, maxDate),
    [events, filter, today, maxDate],
  )

  /* 정렬은 필터가 아니라 보기 방식이라 FilterState 에 넣지 않았다.
     주소로 공유되지도 않고 지도와 공유할 값도 아니다 */
  const [sort, setSort] = useState<SortKey>('deadline')
  const [sortOpen, setSortOpen] = useState(false)

  /**
   * 지금 그릴 개수.
   *
   * ─────────────────────────────────────────────────────────
   * **200장을 한 번에 그리던 것을 끊는다.**
   *
   * 목록 길이가 그대로 화면의 무게였다. 실측(2026-09-10)으로 홈이
   * 요소 3,210개에 `img` 214개였고, 필터로 14건만 남기면 351개로
   * 떨어졌다. 첫 접속이 특히 나빴다 — 하이드레이션 전에 SEO 목록을
   * 한 번 그리고, 날짜가 정해지면 카드 200장으로 통째로 갈아치워서
   * 큰 트리를 두 번 만든다. 버튼을 눌러도 손이 아니라 그 다음
   * 렌더에서 멈춘다.
   *
   * **검색 색인은 이 값과 무관하다.** 크롤러가 보는 것은 서버가 그린
   * `SeoIndex` 의 링크 목록이고(HomeApp), 그쪽은 손대지 않았다.
   */
  const [shown, setShown] = useState(STEP)
  /** 더 불러올 자리. 이게 화면에 들어오면 한 번 더 붙인다 */
  const moreRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(
    () => sortByKey(filterEvents(events, { ...filter, date: 'all' }, today), sort, today),
    [events, filter, today, sort],
  )

  /* 조건이 바뀌면 처음부터 센다. 안 되돌리면 콘서트 14건을 보다가
     전체로 돌아왔을 때 이미 200장이 열려 있어 끊은 의미가 없다 */
  useEffect(() => {
    setShown(STEP)
  }, [filter.district, filter.kind, filter.query, filter.range, sort])

  /*
   * 바닥이 보이면 한 묶음 더 붙인다.
   *
   * 「더 보기」 버튼을 두지 않는다. 이 화면은 훑는 화면이고, 훑다가
   * 버튼을 만나면 거기서 한 번 멈춰야 한다. 스크롤 이벤트 대신
   * IntersectionObserver 를 쓴다 — 스크롤마다 계산하면 그 자체가
   * 지금 고치려는 렉이 된다.
   *
   * `rootMargin` 으로 화면에 닿기 전에 미리 붙인다. 바닥에 닿고 나서
   * 그리기 시작하면 빈 자리를 한 번 보게 된다.
   */
  const hasMore = shown < visible.length
  useEffect(() => {
    if (!hasMore) return
    const el = moreRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setShown((n) => n + STEP)
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, shown])

  const rows = useMemo(() => visible.slice(0, shown), [visible, shown])

  return (
    <>
      <TopSubjects events={events} today={today} />

      {/* 아무 축도 안 걸었을 때만 낸다. 좁히기 시작한 사람의 화면에
          조건 밖의 콘서트가 남아 있으면 필터가 안 먹은 것으로 읽힌다
          (UpcomingConcerts.tsx) */}
      {filter.kind === 'all' &&
        filter.district === 'all' &&
        !filter.range &&
        !filter.query.trim() && (
          <UpcomingConcerts
            events={events}
            today={today}
            onOpen={onOpen}
            onSeeAll={() => onFilter('kind', 'CONCERT')}
          />
        )}

      {/* 칩을 전부 늘어놓던 줄을 접었다. 유형 넷과 지역 열하나가 한
          줄에 있으면 옆으로 흐르고, 지금 무엇이 걸려 있는지 보려면
          줄을 끝까지 밀어야 한다 */}
      <FilterBar
        query={filter.query}
        onQuery={(v) => onFilter('query', v)}
        axes={[
          {
            key: 'kind',
            placeholder: '종류',
            title: '어떤 행사',
            options: kindOptions,
            value: filter.kind,
            onPick: (v) => onFilter('kind', v as KindFilter),
          },
          {
            key: 'district',
            placeholder: '지역',
            title: '어느 동네',
            options: districtOptions,
            value: filter.district,
            onPick: (v) => onFilter('district', v as DistrictFilter),
          },
          /* 기간은 값이 목록으로 안 떨어져서 시트에 달력을 그린다.
             지도의 날짜 축(하루씩 이동)과 다른 축이다. "이번 주말"은
             하루로 표현할 수 없다 */
          {
            key: 'range',
            placeholder: '기간',
            title: '언제 갈까',
            options: [],
            value: filter.range ? 'set' : 'all',
            pillLabel: filter.range ? rangeLabel(filter.range) : undefined,
            onPick: () => onFilter('range', null),
            render: (close) => (
              <DateCalendar
                inline
                mode="range"
                range={filter.range}
                selected={null}
                today={today}
                maxDate={maxDate}
                counts={dateCounts}
                onPick={() => {}}
                onPickRange={(r: DateRange) => {
                  onFilter('range', r)
                  close()
                }}
                onClose={close}
              />
            ),
          },
        ]}
      />

      {/* 정렬 축을 누를 수 있게 했다. 「마감 임박 순」 이 글자로만 있어서
          바꿀 수 있는 값인지 알 수 없었다. 시트는 필터와 같은 것을 쓴다.
          같은 종류의 선택인데 여는 방식이 다르면 두 번 배워야 한다 */}
      <p className="count">
        {visible.length}곳
        <button
          type="button"
          className="count__sort"
          onClick={() => setSortOpen(true)}
          aria-haspopup="dialog"
        >
          {SORT_LABELS[sort]}
          <svg viewBox="0 0 12 12" aria-hidden focusable="false">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </p>

      {sortOpen && (
        <div className="fsheet" onClick={() => setSortOpen(false)}>
          <div className="fsheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="fsheet__head">
              <h2>정렬 순</h2>
              <button type="button" onClick={() => setSortOpen(false)} aria-label="닫기">
                ✕
              </button>
            </div>
            <ul className="fsheet__list">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    className={`fsheet__item${sort === k ? ' fsheet__item--on' : ''}`}
                    aria-pressed={sort === k}
                    onClick={() => {
                      setSort(k)
                      setSortOpen(false)
                    }}
                  >
                    <span>{SORT_LABELS[k]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="placeholder">
          조건에 맞는 곳이 없어요.
          <br />
          검색어나 필터를 지워보세요.
        </p>
      ) : (
        <div className="rows">
          {rows.map((ev) => (
            <EventCard key={ev.id} event={ev} today={today} variant="row" onOpen={onOpen} />
          ))}
          {/* 바닥 표시. 여기가 보이면 다음 묶음이 붙는다. 남은 것이
              없으면 자리도 안 만든다 */}
          {hasMore && <div ref={moreRef} className="rows__more" aria-hidden />}
        </div>
      )}
    </>
  )
}
