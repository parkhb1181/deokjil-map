'use client'

import type { EventItem } from '@/types'
import EventCard from './EventCard'

interface Props {
  title: string
  /** 제목 아래 보조 문구. 섹션의 근거나 규모를 밝히는 자리 */
  note?: string
  events: EventItem[]
  today: string
  onOpen: (id: string) => void
  onMore?: () => void
  moreLabel?: string
  /** 지역 섹션에서 그 구역 지도로 바로 넘어가는 버튼 */
  onMap?: () => void
}

const PREVIEW_COUNT = 4

/**
 * 지역 섹션. 2열 그리드로 네 칸까지 보여주고 나머지는 전체 보기로 넘긴다.
 *
 * 가로 레일을 쓰지 않는 이유는 옆으로 밀어야 보이는 카드는 안 본다는 것.
 * 첫 화면에 실제로 보이는 카드 수가 곧 상세 진입률이다.
 */
export default function Section({
  title,
  note,
  events,
  today,
  onOpen,
  onMore,
  moreLabel,
  onMap,
}: Props) {
  if (events.length === 0) return null

  return (
    <section className="section">
      <div className="section__head">
        <div className="section__headtext">
          <h2 className="section__title">{title}</h2>
          {note && <p className="section__note">{note}</p>}
        </div>

        <div className="section__actions">
          {onMap && (
            <button type="button" className="section__link" onClick={onMap}>
              지도
            </button>
          )}
          {onMore && (
            <button type="button" className="section__link" onClick={onMore}>
              {moreLabel ?? `전체 ${events.length}`} ›
            </button>
          )}
        </div>
      </div>

      <div className="grid">
        {events.slice(0, PREVIEW_COUNT).map((ev) => (
          <EventCard key={ev.id} event={ev} today={today} variant="tile" onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}
