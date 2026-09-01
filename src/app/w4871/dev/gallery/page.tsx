import type { Metadata } from 'next'
import { ALL_EVENTS } from '@/lib/events-source'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'
import type { PickableEvent } from '@/components/ui/EventPicker'
import Gallery from './Gallery'
import './gallery.css'

/** 내부용 화면이다. 검색에 걸리면 안 된다 */
export const metadata: Metadata = {
  title: '공용 조각 · 덕모임',
  robots: { index: false, follow: false },
}

/* 행사 고르기에 넘길 값. 쓰기 화면(p/new/page.tsx)과 같은 모양으로
   자른다. 갤러리는 조각이 실제로 어떻게 도는지 보는 자리라
   가짜 배열을 만들어 넣으면 보는 의미가 없다.
   60건이면 "40개 넘으면 검색하라" 는 줄까지 눌러볼 수 있다 */
const PICKABLE: PickableEvent[] = ALL_EVENTS.slice(0, 60).map((e) => ({
  id: e.id,
  subject: e.subject,
  title: e.title ?? `${e.subject} ${EVENT_KIND_LABELS[e.kind]}`,
  place: e.place.name,
  district: DISTRICT_LABELS[e.place.district],
  endsOn: e.ends_on,
  imageUrl: e.image_url ?? null,
}))

export default function Page() {

  return <Gallery events={PICKABLE} />
}
