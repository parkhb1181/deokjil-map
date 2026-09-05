'use client'

/**
 * 아티스트 모아보기의 장소 목록.
 *
 * 페이지는 정적으로 굽되 이 목록만 클라이언트로 뺐다. 검색을 넣으려면
 * 입력 상태가 필요한데, 페이지 전체를 클라이언트로 돌리면 구조화
 * 데이터와 메타 태그가 같이 딸려 나가 검색 유입이 깨진다.
 *
 * 검색은 브라우저에서 거른다. 한 아티스트의 행사가 이미 다 내려와
 * 있어서(성호가 29곳) 타자마다 바로 좁혀진다. 서버로 보낼 것이 없다.
 *
 * 장소 이름과 구역을 같이 본다. "홍대" 로도 찾고 "악센트" 로도 찾는데
 * 어느 쪽인지는 모른다.
 */
import { useMemo, useState } from 'react'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'
import { posterSrc } from '@/lib/poster'

export function SubjectList({ events }: { events: EventItem[] }) {
  const [q, setQ] = useState('')

  const hits = useMemo(() => {
    const key = q.trim().toLowerCase()
    if (!key) return events
    return events.filter((e) =>
      `${e.place.name} ${DISTRICT_LABELS[e.place.district]} ${e.title ?? ''} ${e.place.address}`
        .toLowerCase()
        .includes(key),
    )
  }, [events, q])

  return (
    <>
      {/* 몇 곳 안 되면 검색이 오히려 훼방이다. 눈으로 다 보이는데
          칸이 하나 더 있으면 그걸 써야 하나 싶어진다 */}
      {events.length > 6 && (
        <div className="psearch">
          <svg viewBox="0 0 16 16" aria-hidden focusable="false">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="카페 이름 · 지역으로 찾기"
            aria-label="장소 검색"
          />
        </div>
      )}

      {hits.length === 0 ? (
        <p className="subj__none">
          &apos;{q.trim()}&apos; 로 찾은 곳이 없어요
        </p>
      ) : (
        <div className="dlist">
          {hits.map((ev) => (
            <div className="drow drow--shot" key={ev.id}>
              {/* 이름만 늘어놓으면 스무 줄이 다 같아 보인다. 포스터가 곧
                  그 행사의 얼굴이라 작게라도 앞에 세운다 — 상세의
                  「근처에서 열려요」 와 같은 크기를 쓴다 */}
              <span className="near__thumb">
                {ev.imageUrl && <img src={posterSrc(ev.imageUrl, 160)} alt="" loading="lazy" />}
              </span>
              <span className="drow__value">
                <a href={`/e/${encodeURIComponent(ev.id)}`}>{ev.place.name}</a>
                {/* 구·종류·마감을 둘째 줄로 내린다. 사진이 앞을 먹어
                    한 줄에 다 넣으면 좁은 화면에서 넉 줄로 접힌다 */}
                <span className="drow__sub">
                  {DISTRICT_LABELS[ev.place.district]}
                  {' · '}
                  {EVENT_KIND_LABELS[ev.kind]}
                  {' · '}~{ev.endsOn}
                  {ev.perks ? ` · ${ev.perks}` : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 걸러낸 뒤 몇 곳이 남았는지. 검색 전에는 안 띄운다. 위 제목에
          이미 전체 개수가 있어서 같은 말을 두 번 하는 셈이다 */}
      {q.trim() && hits.length > 0 && (
        <p className="subj__count">{hits.length}곳</p>
      )}
    </>
  )
}
