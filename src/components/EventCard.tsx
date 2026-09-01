'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { EventItem } from '@/types'
import {
  DISTRICT_LABELS,
  EVENT_KIND_LABELS,
  daysLeft,
  periodLabel,
  shortPerks,
  shortRange,
} from '@/lib/filters'
import { initialFor, swatchFor } from '@/lib/visual'
import { useSave } from './SaveContext'

interface Props {
  event: EventItem
  today: string
  /** tile = 가로 스크롤용 고정 폭, row = 세로 목록용 전체 폭 */
  variant: 'tile' | 'row'
  onOpen: (id: string) => void
}

/**
 * 카드 내부는 행 높이를 고정해 카드끼리 줄이 맞도록 한다.
 * 굿즈 배지는 margin-top:auto로 항상 바닥에 붙는다.
 *
 * 대표 이미지는 있으면 쓰고, 없거나 로드에 실패하면 대상명 기반 색 블록으로 폴백한다.
 * 수집한 URL은 원본이 지워지면 그대로 깨지므로 폴백이 예외가 아니라 상시 경로다.
 */
export default function EventCard({ event, today, variant, onOpen }: Props) {
  const [imageFailed, setImageFailed] = useState(false)
  const save = useSave()
  const saved = save.isSaved(event.id)

  const left = daysLeft(event, today)
  const urgent = left >= 0 && left <= 1
  const showImage = Boolean(event.image_url) && !imageFailed
  const sw = swatchFor(event)
  const perks = shortPerks(event)

  return (
    /* 루트가 button 이면 안에 담기 버튼을 넣을 수 없다. 중첩 버튼은 스펙 위반이고
       실제로 클릭이 어느 쪽으로 갈지 브라우저마다 다르다.
       그래서 카드를 div 로 두고, 상세 열기는 카드 전체를 덮는 오버레이 버튼이 받는다.
       레이아웃 CSS 는 그대로 .card 에 남아 손댈 것이 없다 */
    <div className={`card card--${variant}`}>
      {showImage ? (
        <div className="card__visual card__visual--photo">
          {/* 원본이 장당 수 MB 라 그대로 물리면 목록이 무너진다.
              카드 크기로 줄여 받는다. 수집원이 원본을 내리면 폴백 색 블록으로 넘어간다 */}
          <Image
            src={event.image_url!}
            alt=""
            fill
            sizes="240px"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <div
          className="card__visual"
          style={{ background: `linear-gradient(135deg, ${sw.from}, ${sw.to})`, color: sw.ink }}
          aria-hidden
        >
          {initialFor(event)}
        </div>
      )}

      <div className="card__body">
        <div className="card__head">
          <span className={`badge badge--${event.kind}`}>{EVENT_KIND_LABELS[event.kind]}</span>
          <span className={`period ${urgent ? 'period--urgent' : ''}`}>
            {periodLabel(event, today)}
          </span>
        </div>

        <strong className="card__subject">{event.subject}</strong>

        <div className="card__place">
          <span className="card__district">{DISTRICT_LABELS[event.place.district]}</span>
          {event.place.name}
        </div>

        <div className="card__meta">
          {event.open_hours ?? shortRange(event)}
          {/* 특전은 이 카테고리에서 갈지 말지를 가르는 정보다. 상세까지 숨기지 않는다 */}
          {perks && <span className="card__perks">{perks}</span>}
        </div>

        <div className="card__foot">
          {event.goods.length > 0 && (
            <span className="card__goods">굿즈 {event.goods.length}품목</span>
          )}
        </div>
      </div>

      <button
        type="button"
        className="card__open"
        onClick={() => onOpen(event.id)}
        aria-label={`${event.subject} ${EVENT_KIND_LABELS[event.kind]} 상세 보기`}
      />

      {/* 담기는 상세를 열지 않고도 눌러야 한다. 상세를 거치게 하면
          지표 3(담기 발생률)이 지표 2(상세 진입률)에 갇힌다 */}
      <button
        type="button"
        className={`card__save ${saved ? 'card__save--on' : ''}`}
        aria-pressed={saved}
        aria-label={`${event.subject} ${saved ? '즐겨찾기에서 빼기' : '즐겨찾기에 담기'}`}
        onClick={() => save.toggle(event)}
      >
        {saved ? '♥' : '♡'}
      </button>
    </div>
  )
}
