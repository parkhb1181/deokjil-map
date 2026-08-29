'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS } from '@/lib/filters'
import { queryHref } from '@/lib/route'
import { track } from '@/lib/analytics'
import { swatchFor } from '@/lib/visual'

interface Props {
  events: EventItem[]
  today: string
}

interface Rank {
  subject: string
  count: number
  districts: string[]
  image?: string
  event: EventItem
}

const MAX = 10

/**
 * 홈 맨 위에 놓이는 순위 레일.
 *
 * 홈과 전체의 차이를 만드는 자리다. 전체는 "전부 훑기"고,
 * 홈은 "지금 뭐가 제일 크냐"에 먼저 답한다. 순위는 지어내지 않고
 * 진행 중인 건수를 그대로 센다.
 *
 * 누르면 그 대상만 걸린 목록으로 간다. 커뮤니티에 뿌리는 링크와
 * 같은 경로(#/q/이름)를 써서, 밖에서 들어온 사람과 안에서 누른 사람이
 * 똑같은 화면을 본다.
 */
export default function TopSubjects({ events, today }: Props) {
  const ranks = useMemo<Rank[]>(() => {
    const live = events.filter((e) => e.ends_on >= today)
    const bucket = new Map<string, EventItem[]>()
    for (const ev of live) {
      const key = ev.subject.trim()
      if (!key) continue
      const list = bucket.get(key)
      if (list) list.push(ev)
      else bucket.set(key, [ev])
    }
    return [...bucket.entries()]
      .map(([subject, list]) => {
        // 지역은 많이 열린 순으로 두 개까지. 세 개를 넘기면 한 줄을 넘겨 읽히지 않는다
        const byDistrict = new Map<string, number>()
        for (const ev of list) {
          byDistrict.set(ev.place.district, (byDistrict.get(ev.place.district) ?? 0) + 1)
        }
        const districts = [...byDistrict.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([d]) => DISTRICT_LABELS[d as keyof typeof DISTRICT_LABELS] ?? d)
        return {
          subject,
          count: list.length,
          districts,
          image: list.find((e) => e.image_url)?.image_url,
          event: list[0],
        }
      })
      .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject, 'ko'))
      .slice(0, MAX)
  }, [events, today])

  // 한 명뿐이면 순위가 아니다. 줄 세울 게 있을 때만 내보낸다
  if (ranks.length < 3) return null

  const go = (r: Rank, i: number) => {
    track('rank_open', { query: r.subject, rank: i + 1, count: r.count })
    window.location.hash = queryHref(r.subject).slice(1)
  }

  return (
    <section className="rank">
      <div className="rank__head">
        <h2 className="rank__title">지금 제일 많이 열려요</h2>
        <p className="rank__note">진행 중인 행사 기준</p>
      </div>

      <ol className="rank__rail">
        {ranks.map((r, i) => {
          const sw = swatchFor(r.event)
          return (
            <li key={r.subject} className="rank__item">
              <button type="button" className="rank__card" onClick={() => go(r, i)}>
                <span
                  className="rank__photo"
                  style={{ background: `linear-gradient(135deg, ${sw.from}, ${sw.to})` }}
                >
                  {r.image && (
                    <Image src={r.image} alt="" fill sizes="260px" priority={i < 2} />
                  )}
                </span>

                <span className="rank__num">{i + 1}</span>

                <span className="rank__info">
                  <strong className="rank__name">{r.subject}</strong>
                  <span className="rank__sub">
                    {r.count}곳
                    {r.districts.length > 0 && ` · ${r.districts.join('·')}`}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
