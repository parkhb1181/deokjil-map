'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ALL_EVENTS } from '@/lib/events-source'
import {
  defaultFilter,
  filterEvents,
  todayKey,
  type FilterState,
} from '@/lib/filters'
import { track, trackVisit } from '@/lib/analytics'
import Logo from '@/components/Logo'
import BottomNav, { type Tab } from '@/components/BottomNav'
import BrowseView from '@/components/BrowseView'
import MapView from '@/components/MapView'
import EventDetail from '@/components/EventDetail'
import SeoIndex from '@/components/SeoIndex'
import { closeDetailRoute, openDetailRoute, useRoute } from '@/lib/route'
import { loadBookmarks, persistBookmarks } from '@/lib/bookmark'
import { SaveProvider, type SaveApi } from '@/components/SaveContext'
import BookmarkView from '@/components/BookmarkView'

/**
 * 메인 화면 본체.
 *
 * 주소 둘이 이 하나를 쓴다.
 *
 *   /              실서비스. 헤더 + 탭 셋
 *   /w4871/home    와이어프레임. 로고를 검색줄로 내린 두 칸 구조 + 탭 넷
 *
 * 복사해서 둘로 두지 않는 이유는, 한쪽만 고쳐지면 팀이 보는 화면과
 * 실제로 나가는 화면이 갈라지기 때문이다. 갈라진 것을 알아채는 방법도
 * 없다. 다른 것은 껍데기(chrome)뿐이라 그것만 인자로 받는다.
 *
 * 빌드 플래그(IS_WIREFRAME)로 가르지 않는다. 그러면 프로덕션 빌드에서
 * /w4871/home 도 옛 헤더로 나온다. duckmoim.com 이 와이어프레임 화면을
 * 그대로 서빙하고 있어서, 와이어프레임인지 아닌지는 빌드가 아니라
 * 주소가 정해야 한다.
 */
export default function HomeApp({ chrome }: { chrome: 'header' | 'brand' }) {
  // 오늘 날짜는 클라이언트에서만 확정한다.
  // 서버 프리렌더 시점(빌드 시각)을 쓰면 배포 다음날부터 하이드레이션이 어긋난다.
  const [today, setToday] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('browse')
  const [filter, setFilter] = useState<FilterState>(() => defaultFilter('1970-01-01'))
  // 담은 이벤트 id. 담은 순서를 유지한다
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
    // 담아둔 목록 복원. localStorage 라 서버에서는 읽을 수 없다
    setSaved(loadBookmarks())
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
          persistBookmarks(next)
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
    setTab('browse')
    // 어느 갤에 뿌린 링크가 유입을 만들었는지 본다
    track('arrive_query', { query: routeQuery })
  }, [routeQuery])

  return (
    <SaveProvider value={save}>
      <div className="app">
        {/* 와이어프레임 빌드에서는 헤더를 걷어내고 로고와 동행을
            검색줄로 내렸다 (components/BrandLine.tsx). 로고 하나가
            91px 를 이고 첫 화면을 먹던 자리다.

            실서비스는 아직 그대로 둔다. 팀이 먼저 보고 판단한 뒤에
            옮긴다 */}
        {chrome === 'header' && (
        <header className="header">
          <div className="header__row">
            <h1 className="header__logo">
              <Logo />
            </h1>

            {/* 검색칸은 헤더에서 내렸다. 필터와 멀리 떨어져 있어서
                좁히는 일이 두 자리에서 일어났다. 지금은 목록과 지도가
                각자 필터 줄 안에 검색칸을 갖는다. 질의는 여전히 하나라
                어느 쪽에서 쳐도 양쪽이 같이 움직인다 */}

            {/* 동행 입구는 BrandLine 으로 옮겼다. 이 헤더는 와이어프레임이
                꺼진 빌드에서만 그려지는데, 동행 자체가 와이어프레임
                전용이라 여기 두면 영영 안 그려진다 */}
          </div>
        </header>
        )}

        <main className={`main ${tab === 'map' ? 'main--map' : ''}`}>
          {!today ? (
            <SeoIndex events={ALL_EVENTS} />
          ) : tab === 'browse' ? (
            <BrowseView
              brand={chrome === 'brand'}
              events={ALL_EVENTS}
              today={today}
              filter={filter}
              onFilter={setField}
              onOpen={openDetail}
            />
          ) : tab === 'map' ? (
            <MapView
              brand={chrome === 'brand'}
              events={ALL_EVENTS}
              today={today}
              filter={filter}
              onFilter={setField}
              onOpen={openDetail}
            />
          ) : (
            <BookmarkView
              events={ALL_EVENTS}
              today={today}
              saved={saved}
              onOpen={openDetail}
              onToggleSave={save.toggle}
              onBrowse={() => setTab('browse')}
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

        <BottomNav companion={chrome === 'brand'} active={tab} savedCount={saved.length} onChange={setTab} />

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
                host: new URL(ev.sourceUrl).hostname,
              })
            }
          />
        )}

      </div>
    </SaveProvider>
  )
}
