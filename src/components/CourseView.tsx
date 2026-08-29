'use client'

import type { EventItem } from '@/types'
import { DISTRICT_LABELS, groupByDistrict, sortEvents } from '@/lib/filters'
import EventCard from './EventCard'

interface Props {
  events: EventItem[]
  today: string
  /** 담은 순서를 유지한 id 목록 */
  saved: string[]
  onOpen: (id: string) => void
  onToggleSave: (event: EventItem) => void
  onBrowse: () => void
}

/**
 * 내 코스.
 *
 * **지역으로 묶는다.** 담은 순서대로 나열하면 목록이 하나 더 생길 뿐이지만,
 * 지역으로 묶으면 "홍대에서 3곳, 성수에서 1곳"이 되어 그날의 동선이 보인다.
 * 이 제품의 축이 지역이라는 것과 같은 이유다.
 *
 * 종료된 것은 빼지 않고 흐리게 남긴다. 목록에서 조용히 사라지면
 * 담아둔 걸 잃어버린 것처럼 보인다. 뺄지 말지는 사용자가 정한다.
 */
export default function CourseView({
  events,
  today,
  saved,
  onOpen,
  onToggleSave,
  onBrowse,
}: Props) {
  const savedSet = new Set(saved)
  const picked = events.filter((e) => savedSet.has(e.id))

  const live = picked.filter((e) => e.ends_on >= today)
  const ended = picked.filter((e) => e.ends_on < today)
  const groups = groupByDistrict(sortEvents(live, today))

  if (picked.length === 0) {
    return (
      <div className="course course--empty">
        <p className="course__emptytitle">담아둔 곳이 없어요</p>
        <p className="course__emptybody">
          카드의 <strong>담기</strong>를 누르면 여기 모여요.
          <br />
          지역별로 묶어서 그날 동선을 보여드릴게요.
        </p>
        <button type="button" className="course__cta" onClick={onBrowse}>
          오늘 열리는 곳 보기
        </button>
      </div>
    )
  }

  return (
    <div className="course">
      <div className="course__head">
        <h2 className="course__title">내 코스</h2>
        <p className="course__count">
          {live.length}곳
          {ended.length > 0 && <span className="course__ended"> · 종료 {ended.length}</span>}
        </p>
      </div>

      {groups.map((g) => (
        <section key={g.district} className="course__group">
          <h3 className="course__district">
            {DISTRICT_LABELS[g.district]} <span className="course__n">{g.events.length}</span>
          </h3>
          <div className="rows">
            {g.events.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                today={today}
                variant="row"
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ))}

      {ended.length > 0 && (
        <section className="course__group course__group--ended">
          <h3 className="course__district">종료됨</h3>
          <ul className="course__endedlist">
            {ended.map((ev) => (
              <li key={ev.id} className="course__endeditem">
                <span>
                  {ev.subject} · {ev.place.name}
                </span>
                <button
                  type="button"
                  className="course__remove"
                  onClick={() => onToggleSave(ev)}
                  aria-label={`${ev.subject} 코스에서 빼기`}
                >
                  빼기
                </button>
              </li>
            ))}
          </ul>
          <p className="course__endednote">
            기간이 끝난 곳입니다. 목록에서 자동으로 지우지 않아요.
          </p>
        </section>
      )}
    </div>
  )
}
