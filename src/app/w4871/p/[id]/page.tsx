import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { CompanionPost, PostComment } from '@/types'
import sample from '@/data/posts.sample.json'
import { stripBlinded } from '@/lib/comment-perm'
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
 *
 * **가려진 댓글의 본문은 여기서 뗀다** (AD-07). 화면에서 떼면 늦다.
 * PostDetail 은 클라이언트 컴포넌트라 넘긴 props 가 HTML 안에 통째로
 * 실려 나가고, 자리에는 「신고로 가려진 댓글입니다」 가 뜨는데 페이지
 * 소스에는 원문이 그대로 남는다.
 *
 * **비밀 댓글은 여기서 못 뗀다.** 누가 볼 수 있는지가 보는 사람에
 * 따라 갈리는데, 지금은 그 사람을 화면의 개발용 토글이 정한다. 서버는
 * 누가 볼지 모르니 다 실어 보내고 화면이 거른다. 그래서 **와이어프레임
 * 에서는 비밀 댓글 본문이 페이지 소스에 남는다.** 로그인이 붙으면
 * 이 파일이 fetch 로 바뀌면서 없어진다. 목데이터라 지금은 감수한다.
 */
const DATA = sample as unknown as {
  hostId: string
  post: CompanionPost
  comments: PostComment[]
}

/* 보는 사람과 무관하게 떼는 것은 여기서 한 번만 한다 */
const COMMENTS = stripBlinded(DATA.comments)

/**
 * 댓글 수를 여기서 센다 (CM-12).
 *
 * 목데이터에 숫자가 박혀 있었는데, 댓글을 고칠 때마다 그 숫자를 같이
 * 안 고치면 어긋난다. 실제로 블라인드 댓글을 넣으면서 손으로 6 을
 * 적었다. 계약이 "저장하지 않고 조회 시 센다" 인 이유가 이것이다.
 *
 * 세는 규칙도 계약 그대로다. 비밀 포함, 삭제·블라인드 제외, 대댓글 포함.
 */
const POST = {
  ...DATA.post,
  commentCount: DATA.comments.filter((c) => c.status === 'ACTIVE').length,
}

export const metadata: Metadata = {
  title: '동행 구해요 · 덕모임',
  robots: { index: false, follow: false },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {

  const { id } = await params
  if (id !== DATA.post.id) notFound()

  return (
    <PostDetail post={POST} comments={COMMENTS} hostId={DATA.hostId} />
  )
}
