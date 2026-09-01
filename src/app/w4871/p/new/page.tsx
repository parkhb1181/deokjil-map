import type { Metadata } from 'next'
import { ALL_EVENTS } from '@/lib/events-source'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'
import type { PickableEvent } from '@/components/ui/EventPicker'
import NewPost from './NewPost'

/** 로그인한 사람만 오는 화면이라 검색에 걸릴 이유가 없다 */
export const metadata: Metadata = {
  title: '모집글 쓰기 · 덕모임',
  robots: { index: false, follow: false },
}

/* 고르기 목록에 필요한 값만 잘라서 넘긴다. events.json 은 160KB 라
   통째로 클라이언트에 실으면 쓰기 화면 하나가 그만큼 무거워진다.
   여기서 자르면 빌드타임에 한 번만 돈다 */
const PICKABLE: PickableEvent[] = ALL_EVENTS.map((e) => ({
  id: e.id,
  subject: e.subject,
  /* 원문에 행사명이 없는 건이 있다. 이벤트 상세와 같은 폴백을 쓴다 */
  title: e.title ?? `${e.subject} ${EVENT_KIND_LABELS[e.kind]}`,
  place: e.place.name,
  district: DISTRICT_LABELS[e.place.district],
  endsOn: e.ends_on,
  imageUrl: e.image_url ?? null,
}))

export default function Page() {

  return <NewPost events={PICKABLE} />
}
