import type { Metadata } from 'next'
import sample from '@/data/posts-list.sample.json'
import PostList, { type ListItem } from './PostList'

/**
 * 모집글 목록.
 *
 * 아직 API 가 없어 목데이터를 읽는다. 붙으면 이 파일만 fetch 로
 * 바꾸고 PostList 는 그대로 둔다.
 *
 * 비회원도 볼 수 있으므로 (Q-04) 나중에는 검색에도 걸려야 한다.
 * 지금은 가짜 데이터라 색인을 막아 둔다.
 */
export const metadata: Metadata = {
  title: '동행 구해요 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {

  return <PostList posts={(sample as unknown as { posts: ListItem[] }).posts} />
}
