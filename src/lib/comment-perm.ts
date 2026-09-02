import type { PostComment, Viewer } from '@/types'

/**
 * 비밀 댓글을 볼 수 있는가.
 *
 * **이 판정의 주인은 서버다.** 권한이 없으면 응답에서 body 를 통째로
 * 빼고 보낸다. 화면이 가리는 방식이면 응답에 본문이 남아 개발자
 * 도구로 그냥 읽힌다. 채팅이 없어 여기로 연락처가 오가므로 그건
 * 곧 연락처 유출이다.
 *
 * 그럼 이 함수는 왜 있나. 아직 API 가 없어 목데이터를 화면에서
 * 걸러야 하고, 판정 규칙을 한 곳에 적어 백엔드와 맞추기 위해서다.
 * API 가 붙으면 이 함수는 지운다. 그때는 body 가 있으면 보이는
 * 것이고 없으면 안 보이는 것이다.
 *
 * 판정에 쓰는 입력은 넷뿐이다.
 *   보는 사람 · 방장 · 댓글 작성자 · 부모 댓글 작성자
 *
 * 신청·수락을 두지 않기로 해서 확정 멤버가 없다. 명세의 권한
 * 매트릭스에서 그 줄이 빠진 모습이다.
 */
export function canSeeSecret(
  comment: PostComment,
  parent: PostComment | null,
  viewer: Viewer,
  hostId: string,
): boolean {
  if (!comment.secret) return true
  if (!viewer.userId) return false

  /* 내가 쓴 것 */
  if (comment.author.id === viewer.userId) return true

  /* 방장. 사람을 고르려면 다 봐야 한다 */
  if (viewer.userId === hostId) return true

  /* 내 댓글에 달린 비밀 대댓글. 부모가 공개든 비밀이든 같다 */
  if (parent && parent.author.id === viewer.userId) return true

  return false
}

/**
 * 가려진 댓글의 본문을 뗀다 (AD-07).
 *
 * **이건 서버 쪽에서 부른다.** 아래 asServerWouldSend 와 달리 보는
 * 사람이 누구인지와 무관하기 때문이다. 가려진 댓글은 아무도 못 본다.
 *
 * 클라이언트 컴포넌트에 넘기기 전에 떼야 하는 이유가 있다. props 로
 * 넘긴 값은 HTML 안에 통째로 실려 나간다. 화면에서만 지우면 자리에는
 * 「신고로 가려진 댓글입니다」 가 뜨지만 페이지 소스에는 원문이
 * 그대로 남는다. 실제로 그랬고, 그건 가린 것이 아니다.
 */
export function stripBlinded(comments: PostComment[]): PostComment[] {
  return comments.map((c) => {
    if (c.state !== 'BLINDED') return c
    const { body, ...rest } = c
    return rest
  })
}

/**
 * 목데이터를 서버가 보낸 것처럼 만든다.
 *
 * 권한이 없는 비밀 댓글의 body 를 지운다. 화면은 body 가 있는지만
 * 보고 그리므로, API 가 붙어도 화면 코드는 그대로다.
 */
export function asServerWouldSend(
  comments: PostComment[],
  viewer: Viewer,
  hostId: string,
): PostComment[] {
  const byId = new Map(comments.map((c) => [c.id, c]))
  return comments.map((c) => {
    /* 가려진 댓글은 본문을 아무에게도 보내지 않는다 (AD-07).
       비밀 권한보다 먼저 본다. 순서를 뒤집으면 방장은 자기 글에
       달린 가려진 댓글의 본문을 그대로 받는다. 가린 이유가 대개
       그 본문 때문인데 그러면 가린 것이 아니다.

       화면에서 지우는 것이 아니라 응답에서 뺀다. 화면이 가리면
       개발자 도구로 그냥 읽힌다 */
    if (c.state === 'BLINDED') {
      const { body, ...rest } = c
      return rest
    }
    const parent = c.parentId ? byId.get(c.parentId) ?? null : null
    if (canSeeSecret(c, parent, viewer, hostId)) return c
    const { body, ...rest } = c
    return rest
  })
}

/**
 * 루트 댓글 아래 대댓글을 붙여 정렬한다.
 *
 * 루트는 시간순, 각 루트 아래 대댓글도 시간순. 페이지를 나눌 때
 * 루트 기준으로 잘라야 대댓글이 부모와 떨어지지 않는다.
 */
export function threaded(comments: PostComment[]): PostComment[] {
  const roots = comments.filter((c) => !c.parentId)
  const kids = new Map<string, PostComment[]>()
  for (const c of comments) {
    if (!c.parentId) continue
    const list = kids.get(c.parentId) ?? []
    list.push(c)
    kids.set(c.parentId, list)
  }
  const byTime = (a: PostComment, b: PostComment) =>
    a.createdAt < b.createdAt ? -1 : 1

  return roots.sort(byTime).flatMap((r) => [r, ...(kids.get(r.id) ?? []).sort(byTime)])
}
