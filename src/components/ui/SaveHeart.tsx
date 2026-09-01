'use client'

/**
 * 담기 하트. 이벤트 상세(/e/[id])용.
 *
 * 지도 앱은 SaveContext 로 담기 상태를 React 상태에 들고 있는데,
 * 이 화면은 그 밖에 있는 정적 페이지라 그 맥락이 없다. 그래서
 * **같은 localStorage 키를 직접 읽고 쓴다.** 화면을 오가면 서로
 * 반영된다. 담아둔 목록은 지도 앱의 「즐겨찾기」 탭에서 본다.
 *
 * 검색으로 이 페이지에 바로 들어온 사람이 이 서비스에서 처음
 * 만나는 행동이 담기다. 여기 하트가 없으면 담으려고 홈으로 돌아가
 * 같은 행사를 다시 찾아야 한다.
 *
 * 서버에서는 localStorage 를 읽을 수 없어 첫 렌더가 늘 빈 하트다.
 * useEffect 에서 채우므로 잠깐 깜빡인다. 담긴 것을 안 담긴 것으로
 * 잘못 그리는 편이, 서버와 클라이언트가 다르게 그려 하이드레이션이
 * 어긋나는 것보다 낫다.
 */
import { useEffect, useState } from 'react'
import { loadCourse, persistCourse } from '@/lib/course'
import { track } from '@/lib/analytics'
import type { EventItem } from '@/types'

export function SaveHeart({ event }: { event: EventItem }) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSaved(loadCourse().includes(event.id))
  }, [event.id])

  const toggle = () => {
    const prev = loadCourse()
    const has = prev.includes(event.id)
    const next = has ? prev.filter((x) => x !== event.id) : [...prev, event.id]
    persistCourse(next)
    setSaved(!has)
    /* 지도 앱의 담기와 같은 이벤트를 쏜다. 화면이 달라도 같은 행동이라
       나눠 세면 지표 3이 두 갈래로 갈린다 (poc-plan 7번) */
    track('save_course', {
      event_id: event.id,
      kind: event.kind,
      district: event.place.district,
      action: has ? 'remove' : 'add',
      count: next.length,
    })
  }

  return (
    <button
      type="button"
      className={`shrt${saved ? ' shrt--on' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? '즐겨찾기에서 빼기' : '즐겨찾기에 담기'}
      onClick={toggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <path
          d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20z"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
