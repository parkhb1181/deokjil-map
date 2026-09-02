'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS } from '@/lib/filters'
import { queryHref } from '@/lib/route'
import { track } from '@/lib/analytics'

interface Props {
  events: EventItem[]
  today: string
}

interface Rank {
  subject: string
  count: number
  districts: string[]
  place: string
  image?: string
}

const MAX = 10

/**
 * 대상 순위.
 *
 * 목록의 1차 축이다. 지역은 191건 중 134건이 홍대라 눌러도 거의 안 걸러지는 반면,
 * 대상은 29 / 22 / 13 / 11 로 잘 갈린다. 직접 경쟁하는 두 서비스도 지역이 아니라
 * 대상과 큐레이션을 앞에 둔다.
 *
 * 1위만 크게 내고 나머지는 작게 흘린다. 열 칸을 같은 크기로 두면 순위로 안 읽힌다.
 * 누르면 커뮤니티에 뿌리는 링크와 같은 경로(#/q/이름)로 가서,
 * 밖에서 들어온 사람과 안에서 누른 사람이 똑같은 화면을 본다.
 */
export default function TopSubjects({ events, today }: Props) {
  const ranks = useMemo<Rank[]>(() => {
    const live = events.filter((e) => e.endsOn >= today)
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
        const byDistrict = new Map<string, number>()
        for (const ev of list) {
          byDistrict.set(ev.place.district, (byDistrict.get(ev.place.district) ?? 0) + 1)
        }
        return {
          subject,
          count: list.length,
          // 지역은 많이 열린 순으로 두 개까지. 셋을 넘기면 한 줄을 넘겨 안 읽힌다
          districts: [...byDistrict.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([d]) => DISTRICT_LABELS[d as keyof typeof DISTRICT_LABELS] ?? d),
          place: list[0].place.name,
          image: list.find((e) => e.imageUrl)?.imageUrl,
        }
      })
      .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject, 'ko'))
      .slice(0, MAX)
  }, [events, today])

  /* 사진은 수집원 서버 주소를 그대로 물고 있어 그쪽이 내리거나 막으면
     깨진 그림이 뜬다. .rank__hero·.rank__card 가 이미 어두운 바탕을
     깔고 있어 사진만 빼면 순위 카드는 그대로 읽힌다 */
  const [failed, setFailed] = useState<Record<string, true>>({})
  const die = (subject: string) => setFailed((f) => ({ ...f, [subject]: true }))

  // 한 명뿐이면 순위가 아니다. 줄 세울 게 있을 때만 내보낸다
  if (ranks.length < 3) return null

  const total = events.filter((e) => e.endsOn >= today).length
  const [top, ...rest] = ranks

  const go = (r: Rank, i: number) => {
    track('rank_open', { query: r.subject, rank: i + 1, count: r.count })
    window.location.hash = queryHref(r.subject).slice(1)
  }

  return (
    <section className="rank">
      <div className="rank__head">
        <h2 className="rank__title">지금 제일 많이 열려요</h2>
        <p className="rank__note">진행 중 {total}곳</p>
      </div>

      <button type="button" className="rank__hero" onClick={() => go(top, 0)}>
        <span className="rank__photo">
          {top.image && !failed[top.subject] && (
            <Image
              src={top.image}
              alt=""
              fill
              sizes="420px"
              priority
              onError={() => die(top.subject)}
            />
          )}
        </span>
        <span className="rank__badge">1위</span>
        <span className="rank__info">
          <strong className="rank__name">{top.subject}</strong>
          <span className="rank__sub">
            {top.count}곳
            {top.districts.length > 0 && ` · ${top.districts.join('·')}`}
          </span>
          <span className="rank__more">
            {top.place} 외 {top.count - 1}곳 보기
          </span>
        </span>
      </button>

      <ol className="rank__rail">
        {rest.map((r, i) => (
          <li key={r.subject} className="rank__item">
            <button type="button" className="rank__card" onClick={() => go(r, i + 1)}>
              <span className="rank__photo">
                {r.image && !failed[r.subject] && (
                  <Image src={r.image} alt="" fill sizes="120px" onError={() => die(r.subject)} />
                )}
              </span>
              <span className="rank__num">{i + 2}</span>
              <span className="rank__cardinfo">
                <strong className="rank__cardname">{r.subject}</strong>
                <span className="rank__cardsub">{r.count}곳</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
