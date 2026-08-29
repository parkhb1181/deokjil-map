'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import rawEvents from '@/data/events.json'
import type { EventItem } from '@/types'
import {
  defaultFilter,
  availableDistricts,
  filterEvents,
  todayKey,
  type DistrictFilter,
  type FilterState,
} from '@/lib/filters'
import { track, trackVisit } from '@/lib/analytics'
import BottomNav, { type Tab } from '@/components/BottomNav'
import HomeView from '@/components/HomeView'
import ListView from '@/components/ListView'
import MapView from '@/components/MapView'
import SearchOverlay from '@/components/SearchOverlay'
import EventDetail from '@/components/EventDetail'
import SeoIndex from '@/components/SeoIndex'
import { closeDetailRoute, openDetailRoute, useRoute } from '@/lib/route'
import { loadCourse, persistCourse } from '@/lib/course'
import { SaveProvider, type SaveApi } from '@/components/SaveContext'
import CourseView from '@/components/CourseView'

const ALL_EVENTS = rawEvents as EventItem[]

export default function Page() {
  // 오늘 날짜는 클라이언트에서만 확정한다.
  // 서버 프리렌더 시점(빌드 시각)을 쓰면 배포 다음날부터 하이드레이션이 어긋난다.
  const [today, setToday] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [filter, setFilter] = useState<FilterState>(() => defaultFilter('1970-01-01'))
  const [searchOpen, setSearchOpen] = useState(false)
  // 담은 이벤트 id. 담은 순서를 유지한다 — 코스는 순서가 의미를 가진다
  const [saved, setSaved] = useState<string[]>([])

  const route = useRoute()
  // 앱 안에서 연 상세인지, 공유 링크로 곧장 들어온 것인지 구분한다.
  // 전자는 back으로 닫아 히스토리를 늘리지 않고, 후자는 되돌아갈 곳이 없어 해시만 지운다
  const openedInside = useRef(false)

  useEffect(() => {
    const t = todayKey()
    setToday(t)
    // 기본 날짜는 오늘이다. 오늘이 확정되는 시점이 마운트 이후라 여기서 채운다
    setFilter((f) => ({ ...f, date: t }))
    // 담은 목록 복원. localStorage 라 서버에서는 읽을 수 없다
    setSaved(loadCourse())
    // 방문·재방문 계상. 지표 0·5 의 원천이다
    trackVisit(t)
  }, [])

  /**
   * 담기 토글.
   *
   * 여기 한 곳에서만 상태·저장·계측을 처리한다. 카드마다 흩어두면
   * 담기 한 번에 save_course 가 두 번 나가고, 지표 3이 그대로 부풀려진다.
   */
  const save = useMemo<SaveApi>(
    () => ({
      isSaved: (id) => saved.includes(id),
      toggle: (ev) => {
        setSaved((prev) => {
          const has = prev.includes(ev.id)
          const next = has ? prev.filter((x) => x !== ev.id) : [...prev, ev.id]
          persistCourse(next)
          track('save_course', {
            event_id: ev.id,
            kind: ev.kind,
            district: ev.place.district,
            // 빼기까지 담기로 세면 지표 3이 부풀려진다. 나눠서 보낸다
            action: has ? 'remove' : 'add',
            count: next.length,
          })
          return next
        })
      },
    }),
    [saved],
  )

  const districts = useMemo(() => availableDistricts(ALL_EVENTS), [])

  const setField = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilter((f) => ({ ...f, [key]: value }))
      track('filter_change', { field: String(key), value: String(value) })
    },
    [],
  )

  const openDetail = useCallback((id: string) => {
    openedInside.current = true
    openDetailRoute(id)
    const ev = ALL_EVENTS.find((e) => e.id === id)
    track('view_detail', {
      event_id: id,
      kind: ev?.kind,
      district: ev?.place.district,
      subject: ev?.subject,
    })
  }, [])

  const closeDetail = useCallback(() => {
    const inside = openedInside.current
    openedInside.current = false
    closeDetailRoute(inside)
  }, [])

  const detailEvent = useMemo(
    () => (route.name === 'detail' ? ALL_EVENTS.find((e) => e.id === route.id) ?? null : null),
    [route],
  )

  // 커뮤니티에 뿌린 아티스트별 링크(#/q/정국)로 들어온 경우.
  // 링크가 약속한 화면과 도착 화면이 달라지면 애써 만든 유입이 첫 화면에서 샌다
  const routeQuery = route.name === 'query' ? route.q : null
  useEffect(() => {
    if (!routeQuery) return
    setFilter((f) => ({ ...f, query: routeQuery, district: 'all' }))
    setTab('list')
    // 어느 갤에 뿌린 링크가 유입을 만들었는지 본다
    track('arrive_query', { query: routeQuery })
  }, [routeQuery])

  const goList = useCallback((district: DistrictFilter) => {
    setFilter((f) => ({ ...f, district }))
    setTab('list')
  }, [])

  const goMap = useCallback((district: DistrictFilter) => {
    setFilter((f) => ({ ...f, district }))
    setTab('map')
  }, [])

  return (
    <SaveProvider value={save}>
      <div className="app">
        <header className="header">
          <div className="header__row">
            <div className="header__text">
              <h1 className="header__title">덕모임</h1>
              <p className="header__sub">오늘 서울 어디서 뭐 하지?</p>
            </div>
            {/* 목록 탭에는 자체 검색창이 있다. 여기까지 두면 같은 일을 하는
                입구가 둘이 되고, 어느 쪽이 목록에 반영되는지 헷갈린다 */}
            {tab !== 'list' && (
              <button
                type="button"
                className="header__search"
                aria-label="검색"
                onClick={() => setSearchOpen(true)}
              >
                검색
              </button>
            )}
          </div>
        </header>

        <main className={`main ${tab === 'map' ? 'main--map' : ''}`}>
          {!today ? (
            <SeoIndex events={ALL_EVENTS} />
          ) : tab === 'home' ? (
            <HomeView
              events={ALL_EVENTS}
              today={today}
              date={filter.date}
              kind={filter.kind}
              district={filter.district}
              onDate={(v) => setField('date', v)}
              onKind={(v) => setField('kind', v)}
              onDistrict={(v) => setField('district', v)}
              onOpen={openDetail}
              onDistrictMap={goMap}
            />
          ) : tab === 'list' ? (
            <ListView
              events={ALL_EVENTS}
              today={today}
              filter={filter}
              onFilter={setField}
              onOpen={openDetail}
            />
          ) : tab === 'map' ? (
            <MapView
              events={ALL_EVENTS}
              today={today}
              filter={filter}
              onFilter={setField}
              onOpen={openDetail}
            />
          ) : (
            <CourseView
              events={ALL_EVENTS}
              today={today}
              saved={saved}
              onOpen={openDetail}
              onToggleSave={save.toggle}
              onBrowse={() => setTab('home')}
            />
          )}
        </main>

        <footer className="footer">
          <p>주최자 공지 기반 · 방문 전 원문 확인 권장</p>
          <p className="footer__notice">
            모든 정보는 출처를 표기하며 원문으로 연결됩니다.
            게시를 원치 않으시는 권리자께서는 알려주시면 즉시 내리겠습니다.
          </p>
        </footer>

        <BottomNav active={tab} savedCount={saved.length} onChange={setTab} />

        {detailEvent && today && (
          <EventDetail
            event={detailEvent}
            today={today}
            onClose={closeDetail}
            onOpenSource={(ev) =>
              // 원문 클릭률은 신뢰도의 대리 지표다 (poc-plan 1번)
              track('open_source', {
                event_id: ev.id,
                kind: ev.kind,
                trust: ev.trust,
                host: new URL(ev.source_url).hostname,
              })
            }
          />
        )}

        {searchOpen && today && (
          <SearchOverlay
            events={ALL_EVENTS}
            today={today}
            onClose={() => setSearchOpen(false)}
            onOpen={(id) => {
              setSearchOpen(false)
              openDetail(id)
            }}
            // 지도 탭에서만 질의를 건다. 홈에서는 예전처럼 상세로 바로 간다
            {...(tab === 'map'
              ? {
                  onQuery: (q: string) => {
                    setField('query', q)
                    setSearchOpen(false)
                  },
                }
              : {})}
          />
        )}
      </div>
    </SaveProvider>
  )
}
