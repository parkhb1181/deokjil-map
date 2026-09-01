'use client'

import { useMemo } from 'react'
import type { EventItem, EventKind } from '@/types'
import {
  DISTRICT_LABELS,
  EVENT_KIND_LABELS,
  filterEvents,
  sortByDeadline,
  type DistrictFilter,
  type FilterState,
  type KindFilter,
} from '@/lib/filters'
import EventCard from './EventCard'
import TopSubjects from './TopSubjects'

interface Props {
  events: EventItem[]
  today: string
  filter: FilterState
  onFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  onOpen: (id: string) => void
}

/** 지역 칩은 상위 몇 개까지만 낸다 */
const DISTRICT_CHIPS = 3

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
    const kinds: KindFilter[] = ['birthday_cafe', 'popup', 'concert']
    return [
      { value: 'all' as KindFilter, label: `전체 ${count('all')}` },
      ...kinds
        .filter((k) => count(k) > 0 || filter.kind === k)
        .map((k) => ({ value: k, label: `${EVENT_KIND_LABELS[k as EventKind]} ${count(k)}` })),
    ]
  }, [base, filter.district, filter.kind])

  const districtOptions = useMemo(() => {
    const pool = filter.kind === 'all' ? base : base.filter((e) => e.kind === filter.kind)
    const by = new Map<string, number>()
    for (const e of pool) by.set(e.place.district, (by.get(e.place.district) ?? 0) + 1)
    const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, DISTRICT_CHIPS)
    const opts = [
      { value: 'all' as DistrictFilter, label: '전 지역' },
      ...top.map(([d, n]) => ({
        value: d as DistrictFilter,
        label: `${DISTRICT_LABELS[d as keyof typeof DISTRICT_LABELS] ?? d} ${n}`,
      })),
    ]
    // 고른 지역이 상위 3위 밖이면 칩이 사라져 해제할 방법이 없어진다
    if (filter.district !== 'all' && !opts.some((o) => o.value === filter.district)) {
      const n = pool.filter((e) => e.place.district === filter.district).length
      opts.push({
        value: filter.district,
        label: `${DISTRICT_LABELS[filter.district as keyof typeof DISTRICT_LABELS] ?? filter.district} ${n}`,
      })
    }
    return opts
  }, [base, filter.kind, filter.district])

  const visible = useMemo(
    () => sortByDeadline(filterEvents(events, { ...filter, date: 'all' }, today), today),
    [events, filter, today],
  )

  return (
    <>
      <TopSubjects events={events} today={today} />

      <div className="filterrow" role="group" aria-label="유형과 지역">
        {kindOptions.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`chip ${filter.kind === o.value ? 'chip--on' : ''}`}
            aria-pressed={filter.kind === o.value}
            onClick={() => onFilter('kind', o.value)}
          >
            {o.label}
          </button>
        ))}

        <span className="filterrow__sep" aria-hidden />

        {districtOptions.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`chip ${filter.district === o.value ? 'chip--on' : ''}`}
            aria-pressed={filter.district === o.value}
            onClick={() => onFilter('district', o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <p className="count">
        {visible.length}곳
        <span className="count__sort">마감 임박 순</span>
      </p>

      {visible.length === 0 ? (
        <p className="placeholder">
          조건에 맞는 곳이 없어요.
          <br />
          검색어나 필터를 지워보세요.
        </p>
      ) : (
        <div className="rows">
          {visible.map((ev) => (
            <EventCard key={ev.id} event={ev} today={today} variant="row" onOpen={onOpen} />
          ))}
        </div>
      )}
    </>
  )
}
