'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, periodLabel, shortRange } from '@/lib/filters'
import { posterSrc } from '@/lib/poster'

interface Props {
  events: EventItem[]
  today: string
  onOpen: (id: string) => void
  /** 종류 필터를 콘서트로 옮긴다. 목록 전체가 콘서트로 바뀐다 */
  onSeeAll: () => void
}

/** 한 줄에 흘릴 최대 개수. 넘는 것은 「모두 보기」 로 보낸다 */
const MAX = 8

/**
 * 콘서트.
 *
 * ─────────────────────────────────────────────────────────
 * **왜 따로 두나.**
 *
 * 콘서트가 열넷 있는데 첫 화면에서 만날 길이 없었다. 목록 기본 정렬이
 * 마감 임박 순이라 오늘 끝나는 생카가 위를 다 차지하고, 콘서트는
 * **48번째 카드**에서 처음 나온다 (2026-09-09 실측). 위 순위 블록도
 * 생카만 세므로 거기에도 안 나온다. 그래서 「콘서트가 아예 없다」 로
 * 읽힌다.
 *
 * 정렬을 고치는 방법도 있었는데 그건 안 한다. 마감 임박 순은 「놓치면
 * 끝나는 것부터」 라는 뜻이고, 그건 생카의 사정이라 맞다. 콘서트를
 * 그 줄에 억지로 끼우면 오늘 마감인 생카가 뒤로 밀린다.
 *
 * **콘서트는 다른 축이다.** 생카는 오늘 갈 곳을 찾는 것이고 콘서트는
 * 예매를 해야 해서 미리 봐야 한다. 마감이 아니라 시작이 기준이다.
 * 그래서 시작이 빠른 순으로 따로 세운다.
 *
 * **포스터는 작게 왼쪽에 둔다.** 콘서트 포스터도 세로(4:5)라 카드 위에
 * 가로로 깔면 위아래가 잘려 아티스트명과 날짜가 날아간다 (순위 블록에
 * 적어둔 것과 같은 실측이다). 옆에 세워 두면 안 잘리고, 바로 위 순위
 * 블록이 이미 사진을 크게 쓰고 있어서 여기까지 크게 가면 첫 화면이
 * 사진 두 덩어리가 된다.
 *
 * **필터가 걸리면 사라진다.** 좁히기 시작한 사람은 이미 자기가 찾을
 * 것을 알고 있다. 홍대를 걸어둔 화면에 잠실 콘서트가 남아 있으면
 * 필터가 안 먹은 것으로 읽힌다. 조건은 부르는 쪽(BrowseView)에 있다.
 */
export default function UpcomingConcerts({ events, today, onOpen, onSeeAll }: Props) {
  const live = useMemo(
    () =>
      events
        .filter((e) => e.kind === 'CONCERT' && e.endsOn >= today)
        /* 시작이 빠른 순. 같은 날 시작이면 id 로 고정해 새로고침마다
           순서가 바뀌지 않게 한다 */
        .sort((a, b) =>
          a.startsOn !== b.startsOn ? (a.startsOn < b.startsOn ? -1 : 1) : a.id < b.id ? -1 : 1,
        ),
    [events, today],
  )

  /* 포스터가 죽은 주소면 사진칸만 비운다. 카드는 글자만으로 읽힌다.
     순위 블록이 같은 처리를 한다 (TopSubjects.tsx) */
  const [failed, setFailed] = useState<Record<string, true>>({})

  /* 없으면 자리도 안 만든다. 크롤이 콘서트를 못 받아온 날 빈 제목만
     남으면 고장으로 보인다 */
  if (live.length === 0) return null

  return (
    <section className="upnext">
      <div className="upnext__head">
        <h2 className="upnext__title">콘서트</h2>
        {/* 「모두 보기」 는 종류 필터를 옮기는 것이다. 다른 화면으로
            보내지 않는다 — 돌아올 길을 따로 만들어야 하고, 콘서트만
            보고 싶은 사람이 쓰려던 것이 원래 그 필터다 */}
        <button type="button" className="upnext__all" onClick={onSeeAll}>
          모두 보기
        </button>
      </div>

      <div className="upnext__row">
        {live.slice(0, MAX).map((ev) => {
          const src = posterSrc(ev.imageUrl)
          return (
            <button key={ev.id} type="button" className="upnext__card" onClick={() => onOpen(ev.id)}>
              <span className="upnext__thumb">
                {src && !failed[ev.id] && (
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="56px"
                    onError={() => setFailed((f) => ({ ...f, [ev.id]: true }))}
                  />
                )}
              </span>

              <span className="upnext__body">
                <span className="upnext__when">{periodLabel(ev, today)}</span>
                <strong className="upnext__name">{ev.subject}</strong>
                <span className="upnext__place">
                  <span className="upnext__district">{DISTRICT_LABELS[ev.place.district]}</span>
                  {ev.place.name}
                </span>
                <span className="upnext__date">{shortRange(ev)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
