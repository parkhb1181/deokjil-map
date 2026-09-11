import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { CompanionPost, PostComment } from '@/types'
import sample from '@/data/posts.sample.json'
import { stripBlinded } from '@/lib/comment-perm'
import { USE_API } from '@/lib/api/config'
import { fetchPost } from '@/lib/api/posts'
import { fetchComments } from '@/lib/api/comments'
import { ApiFailure } from '@/lib/api/http'
import PostDetail from './PostDetail'
import { FIXTURE_ON, fixturePost, isFixtureId, isHiddenPostId } from '@/lib/fixture-posts'

/**
 * 모집글 상세.
 *
 * **API 주소가 있으면 서버에서 받아 오고, 없으면 목데이터 한 건을
 * 읽는다.** `PostDetail` 은 어느 쪽인지 모른다.
 *
 * 목록과 같은 이유로 정적으로 굽지 않는다 (`../page.tsx`).
 *
 * ─────────────────────────────────────────────────────────
 * **비밀 댓글이 API 경로에서는 새지 않는다.**
 *
 * 목데이터 경로에서는 서버가 누가 볼지 모르니 다 실어 보내고 화면이
 * 거른다. `PostDetail` 이 클라이언트 컴포넌트라 넘긴 props 가 HTML 에
 * 통째로 실려서, 자리에는 「비밀 댓글」 이 뜨는데 페이지 소스에는 원문이
 * 남는다. 목데이터라 감수하던 것이다.
 *
 * API 경로에는 그 문제가 없다. 서버가 권한을 보고 `content` 키를 아예
 * 빼고 준다 (`lib/api/comments.ts`). 화면에 안 오는 것이 아니라 응답에
 * 없다.
 *
 * **다만 지금은 토큰 없이 받는다.** 서버 컴포넌트에는 세션이 없다 —
 * 토큰이 `localStorage` 에 있어서 브라우저만 안다. 그래서 이 첫 응답은
 * 늘 비회원 기준이고, 로그인한 사람에게 보여야 할 비밀 댓글 본문과
 * `availableActions` 가 비어 있다. **화면이 뜬 뒤 브라우저가 자기
 * 토큰으로 다시 받아야 채워진다.** 그 배선은 `PostDetail` 쪽 일이라
 * 여기서는 하지 않는다.
 *
 * 가려진 댓글(AD-07)은 API 경로에서도 서버가 본문을 빼므로 `stripBlinded`
 * 를 다시 부르지 않는다. 목데이터 경로에서만 필요하다.
 */
const DATA = sample as unknown as {
  hostId: string
  post: CompanionPost
  comments: PostComment[]
}

/* 보는 사람과 무관하게 떼는 것은 여기서 한 번만 한다 (목데이터 경로) */
const COMMENTS = stripBlinded(DATA.comments)

/**
 * 댓글 수를 여기서 센다 (CM-12).
 *
 * 목데이터에 숫자가 박혀 있었는데, 댓글을 고칠 때마다 그 숫자를 같이
 * 안 고치면 어긋난다. 실제로 블라인드 댓글을 넣으면서 손으로 6 을
 * 적었다. 계약이 "저장하지 않고 조회 시 센다" 인 이유가 이것이다.
 *
 * 세는 규칙도 계약 그대로다. 비밀 포함, 삭제·블라인드 제외, 대댓글 포함.
 *
 * **API 경로에서는 서버가 센 값을 그대로 쓴다.** 화면이 다시 세면 안
 * 된다 — 커서 페이지네이션이라 첫 장만 받은 상태에서 세면 20건으로 잘린
 * 숫자가 나온다.
 */
const POST = {
  ...DATA.post,
  commentCount: DATA.comments.filter((c) => c.status === 'ACTIVE').length,
}

export const metadata: Metadata = {
  title: '동행 모집 · 덕모임',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!USE_API) {
    if (id !== DATA.post.id) notFound()
    return <PostDetail post={POST} comments={COMMENTS} hostId={DATA.hostId} />
  }

  /*
   * 고정 완료글은 서버에 없다. 접두어로 먼저 갈라 서버에 묻지 않는다 —
   * 물으면 404 가 오고, 그건 「없는 글」 로 보여 주소를 의심하게 한다.
   * 방장이 될 수 있는 사람이 없어 hostId 는 아무와도 안 맞고, 그래서
   * 비밀 댓글 본문이 누구에게도 없다. 신고는 없는 글이라 막는다
   */
  if (isFixtureId(id)) {
    const hit = FIXTURE_ON ? fixturePost(id) : null
    if (!hit) notFound()
    return <PostDetail post={hit.post} comments={hit.comments} hostId={hit.post.author.id} noReport />
  }

  /* 목록에서 뺀 글은 주소로 들어와도 없는 것으로 본다. 한쪽만 막으면 링크가 남는다 */
  if (isHiddenPostId(id)) notFound()

  /*
   * **글과 댓글을 동시에 부른다.**
   *
   * 차례로 기다렸더니 상세가 뜨기까지 1.4초가 걸렸다 (2026-09-11 실측,
   * 서버 응답 자체는 둘 합쳐 250ms). 이 함수는 Vercel 이 미국에서
   * 돌리고 API 는 서울에 있어서 왕복 하나가 200ms 안팎이다. 둘을 차례로
   * 기다리면 그 왕복이 두 번 쌓인다.
   *
   * 댓글 약속은 미리 붙잡아 둔다. 글이 404 로 먼저 던져 `notFound()` 로
   * 나가면 댓글 쪽 거부가 아무도 안 받은 채 남아 경고가 뜬다.
   */
  const postP = fetchPost(id)
  const commentsP = fetchComments(id)
  commentsP.catch(() => undefined)

  let post: CompanionPost
  try {
    post = await postP
  } catch (e) {
    /*
     * 없는 글이면 404 화면으로 보낸다. 다른 실패는 그대로 던져 에러
     * 화면이 뜨게 둔다 — 서버가 죽은 것을 「없는 글」 로 보여주면
     * 사용자가 주소를 의심하며 시간을 쓴다.
     */
    if (e instanceof ApiFailure && e.httpStatus === 404) notFound()
    throw e
  }

  /* 첫 장만 받는다. 이어지는 장은 화면이 부른다 (목록과 같은 이유) */
  const comments = await commentsP

  return <PostDetail post={post} comments={comments.items} hostId={post.author.id} />
}
