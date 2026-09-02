'use client'

import { useEffect, useState } from 'react'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS, daysLeft, periodLabel } from '@/lib/filters'
import { initialFor, swatchFor } from '@/lib/visual'
import DetailMap from './DetailMap'

interface Props {
  event: EventItem
  today: string
  onClose: () => void
  /** 원문 링크 클릭. 신뢰도의 대리 지표라 반드시 계측한다 (poc-plan 지표 표) */
  onOpenSource: (event: EventItem) => void
}

const TRUST_LABELS: Record<EventItem['trust'], string> = {
  official: '공식 채널',
  partner: '제휴 등록',
  user: '사용자 제보',
  parsed: '공지 기반 정리',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="drow">
      <dt className="drow__label">{label}</dt>
      <dd className="drow__value">{value}</dd>
    </div>
  )
}

export default function EventDetail({ event, today, onClose, onOpenSource }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  /* 사진은 우리가 복제해 두지 않고 수집원 서버 주소를 그대로 물고 있다.
     그쪽이 내리거나 막으면 깨진 그림이 뜬다. 카드(EventCard)와 같은 처리를
     상세에도 둔다. 불리언 하나로 두면 다음에 연 행사의 멀쩡한 사진까지
     가려지므로 어느 행사에서 죽었는지를 기억한다 */
  const [failedId, setFailedId] = useState<string | null>(null)
  const showImage = Boolean(event.imageUrl) && failedId !== event.id

  // 주최자·운영사가 직접 올린 곳인지. 리스팅 사이트로 떨어진 경우와 구분한다
  const official = /instagram\.com|x\.com|twitter\.com/.test(event.sourceUrl)

  const sw = swatchFor(event)
  const left = daysLeft(event, today)
  const urgent = left >= 0 && left <= 1

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`${event.subject} 상세`}>
      <div className="sheet__bar">
        <button type="button" className="sheet__back" onClick={onClose} aria-label="닫기">
          ‹ 뒤로
        </button>
      </div>

      <div className="sheet__body">
        {showImage ? (
          <div className="sheet__visual sheet__visual--photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.imageUrl}
              alt=""
              decoding="async"
              onError={() => setFailedId(event.id)}
            />
          </div>
        ) : (
          <div
            className="sheet__visual"
            style={{ background: `linear-gradient(135deg, ${sw.from}, ${sw.to})`, color: sw.ink }}
            aria-hidden
          >
            {initialFor(event)}
          </div>
        )}

        <div className="sheet__head">
          <div className="sheet__badges">
            <span className={`badge badge--${event.kind}`}>{EVENT_KIND_LABELS[event.kind]}</span>
            <span className={`period ${urgent ? 'period--urgent' : ''}`}>
              {periodLabel(event, today)}
            </span>
          </div>
          <h2 className="sheet__title">{event.subject}</h2>
          {event.title && event.title !== event.subject && (
            <p className="sheet__original">{event.title}</p>
          )}
          <p className="sheet__place">
            <span className="card__district">{DISTRICT_LABELS[event.place.district]}</span>
            {event.place.name}
          </p>
          <p className="sheet__address">{event.place.address}</p>
        </div>

        <dl className="dlist">
          <Row label="기간" value={`${event.startsOn} ~ ${event.endsOn}`} />
          {event.openHours && <Row label="운영시간" value={event.openHours} />}
          {event.perks && <Row label="특전" value={event.perks} />}
          {event.conditions && <Row label="조건" value={event.conditions} />}
          <Row label="정보 출처" value={TRUST_LABELS[event.trust]} />
        </dl>

        {event.goods.length > 0 && (
          <section className="goods">
            <h3 className="goods__title">굿즈 {event.goods.length}품목</h3>
            <p className="goods__note">
              공식 라인업 기준입니다. 실시간 재고는 준비 중이에요.
            </p>
            <ul className="goods__list">
              {event.goods
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((g) => (
                  <li key={g.id} className="goods__item">
                    <span>{g.name}</span>
                    {/* 랜덤 품목은 "품절" 개념이 아니라 "지금 뭐가 나오나"가 관심사다 */}
                    {g.isRandom && <span className="goods__random">랜덤</span>}
                  </li>
                ))}
            </ul>
          </section>
        )}

        {/* 위치는 사실 정보라 원문 링크(행동)보다 앞에 둔다.
            "어디인지" 를 보고 나서 "원문을 확인할지" 를 정한다 */}
        <DetailMap event={event} />

        {/* 원문 링크는 필수 노출이다 (poc-plan 1번 정합성 교란 방어).
            주최자·운영사의 공식 게시물일 때만 주요 동선으로 올린다 */}
        <a
          className={`sourcelink ${official ? '' : 'sourcelink--weak'}`}
          href={event.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpenSource(event)}
        >
          {official ? '공식 공지 보기 ↗' : '정보 원문 보기 ↗'}
        </a>

        {event.reservationUrl && (
          <a
            className="sourcelink sourcelink--sub"
            href={event.reservationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            사전예약 하기 ↗
          </a>
        )}

        <p className="sheet__disclaimer">
          주최자 공지를 정리한 정보입니다. 변경될 수 있으니 방문 전 원문을 확인해주세요.
        </p>
      </div>
    </div>
  )
}
