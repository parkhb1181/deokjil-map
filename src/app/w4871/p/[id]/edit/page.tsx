import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { CompanionPost, EventItem } from '@/types'
import { isClosed } from '@/types'
import sample from '@/data/posts.sample.json'
import { getAllEvents } from '@/lib/events-source'
import { USE_API } from '@/lib/api/config'
import { fetchPost } from '@/lib/api/posts'
import { ApiFailure } from '@/lib/api/http'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'
import type { PickableEvent } from '@/components/ui/EventPicker'
import NewPost, { type PostDraft } from '../../new/NewPost'

/**
 * 모집글 수정 (PO-06).
 *
 * 쓰기와 **같은 폼 컴포넌트를 쓴다.** 묻는 것이 완전히 같아서다.
 * 두 벌로 두면 칸이 하나 늘 때마다 두 군데를 고쳐야 하고, 실제로는
 * 한쪽만 고치게 된다.
 *
 * **`OPEN` 일 때만 연다.** 계약이 `CLOSED` 글 수정을 409 로 막는다.
 * 화면에서도 막아야 눌러보고 나서 튕기지 않는다. 서버 판정이 정본이고
 * 여기는 먼저 알려주는 역할이다.
 *
 * **방장 본인인지는 서버가 본다.** 이 화면은 서버 컴포넌트라 세션이
 * 없어서 누가 여는지 모른다. 남의 글을 열어도 폼은 뜨지만 저장에서
 * 403 (POST_NOT_HOST) 이 온다. 화면에서 미리 막으려면 브라우저가
 * 자기 토큰으로 한 번 더 물어야 하는데, 주소를 직접 쳐야 닿는 자리라
 * 지금은 서버 판정에 맡긴다.
 */
export const metadata: Metadata = {
  title: '모집글 수정 · 덕모임',
  robots: { index: false, follow: false },
}

const DATA = sample as unknown as { hostId: string; post: CompanionPost }

const cut = (e: EventItem): PickableEvent => ({
  id: e.id,
  subject: e.subject,
  title: e.title ?? `${e.subject} ${EVENT_KIND_LABELS[e.kind]}`,
  place: e.place.name,
  district: DISTRICT_LABELS[e.place.district],
  endsOn: e.endsOn,
  imageUrl: e.imageUrl ?? null,
})

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let post: CompanionPost
  if (USE_API) {
    try {
      post = await fetchPost(id)
    } catch (e) {
      if (e instanceof ApiFailure && e.httpStatus === 404) notFound()
      throw e
    }
  } else {
    post = DATA.post
    if (id !== post.id) notFound()
  }

  /* 끝난 글은 고칠 수 없다. 주소를 직접 쳐도 마찬가지다 */
  if (isClosed(post.status)) notFound()

  const events = (await getAllEvents()).map(cut)

  /*
   * 폼이 쓰는 모양으로 옮긴다.
   *
   * 인원이 문자열인 것은 칩이 문자열을 다루기 때문이다. 안 정한 글은
   * 빈 문자열이라 아무 칩도 안 눌린 상태로 열린다.
   *
   * meetAt 은 `datetime-local` 이 받는 'YYYY-MM-DDTHH:mm' 로 자른다.
   * 저장된 값에는 '+09:00' 오프셋이 붙어 있어 그대로 넣으면 칸이 빈다.
   */
  const draft: PostDraft = {
    id: post.id,
    title: post.title,
    content: post.content,
    capacity: post.capacity === null ? '' : String(post.capacity),
    meetAt: post.meetAt.slice(0, 16),
    place: post.meetPoint.place,
    eventId: post.eventId,
    pin: { lat: post.meetPoint.lat, lng: post.meetPoint.lng },
  }

  return <NewPost events={events} draft={draft} />
}
