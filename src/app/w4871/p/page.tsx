import type { Metadata } from 'next'
import sample from '@/data/posts-list.sample.json'
import { USE_API } from '@/lib/api/config'
import { fetchPosts } from '@/lib/api/posts'
import PostList from './PostList'
import { toListItem, type ListItem } from '@/lib/list-item'
import { FIXTURE_ON, fixtureListItems } from '@/lib/fixture-posts'

/**
 * 모집글 목록.
 *
 * **API 주소가 있으면 서버에서 받아 오고, 없으면 목데이터를 읽는다.**
 * `PostList` 는 어느 쪽인지 모른다 — 이 파일만 갈라진다.
 *
 * ─────────────────────────────────────────────────────────
 * **행사와 달리 정적으로 굽지 않는다.**
 *
 * 행사는 ISR 로 구워 두고 재검증 때만 갱신하는데, 모집글은 그러면 안
 * 된다. 댓글 수가 실시간이고 마감이 배치로 바뀐다 (API 설계 2-3
 * 「모집글·댓글은 ISR 대상이 아니다」). 그래서 요청마다 새로 받는다.
 *
 * 목데이터 경로에서는 `force-dynamic` 이 의미가 없지만 조건부로 걸 수
 * 없어 그냥 둔다. 정적 JSON 이라 매 요청에 다시 읽어도 비용이 없다.
 *
 * 비회원도 볼 수 있으므로 (Q-04) 나중에는 검색에도 걸려야 한다.
 * 지금은 색인을 막아 둔다 — API 가 붙어도 모집글 목록을 색인할지는
 * 따로 정할 일이라 여기서 같이 풀지 않는다.
 */
export const metadata: Metadata = {
  title: '동행 모집 · 덕모임',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'


export default async function Page() {
  if (!USE_API) {
    return <PostList posts={(sample as unknown as { posts: ListItem[] }).posts} />
  }

  /*
   * 첫 장만 받는다. 이어지는 장은 화면이 스크롤할 때 부른다 —
   * 여기서 전량을 받으면 글이 늘어날수록 첫 응답이 느려진다.
   * 행사가 전량인 것은 상세 페이지를 그 배열로 굽기 때문이고,
   * 모집글에는 그 사정이 없다.
   */
  const page = await fetchPosts({})

  /*
   * 완료글 고정 데이터는 첫 장 앞에만 붙는다. 전부 지난 글이라 서버
   * 정렬(만남시각 오름차순)에서도 앞자리다. 커서는 서버 글 기준이라
   * 이어지는 장에 다시 나오지 않는다. 왜 있는지는 lib/fixture-posts 에
   */
  const items = page.items.map(toListItem)
  const posts = FIXTURE_ON ? [...fixtureListItems(), ...items] : items

  return <PostList posts={posts} nextCursor={page.nextCursor} />
}
