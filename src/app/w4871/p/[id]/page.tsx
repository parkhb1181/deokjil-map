import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { CompanionPost, PostComment } from '@/types'
import sample from '@/data/posts.sample.json'
import PostDetail from './PostDetail'

/**
 * 모집글 상세.
 *
 * 아직 API 가 없어 목데이터 한 건을 읽는다. 붙으면 이 파일에서
 * fetch 로 바꾸고 PostDetail 은 그대로 둔다. 화면이 받는 모양을
 * types.ts 에 먼저 못박아 둔 이유다.
 *
 * 비회원도 볼 수 있다 (Q-04 노출함). 그래서 검색에도 걸려야 하는데,
 * 지금은 가짜 데이터라 색인을 막아 둔다.
 */
const DATA = sample as unknown as {
  host_id: string
  post: CompanionPost
  comments: PostComment[]
}

export const metadata: Metadata = {
  title: '동행 구해요 · 덕모임',
  robots: { index: false, follow: false },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {

  const { id } = await params
  if (id !== DATA.post.id) notFound()

  return (
    <PostDetail post={DATA.post} comments={DATA.comments} hostId={DATA.host_id} />
  )
}
