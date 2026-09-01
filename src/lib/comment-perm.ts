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
 * 판정에 쓰는 입력은 셋뿐이다.
 *   보는 사람 · 방장 · 댓글 작성자
 *
 * 한때 넷이었다. 답글을 1차에서 빼면서 「부모 댓글 작성자」 줄이
 * 사라졌다. 댓글이 평평해져서 부모라는 것이 없다.
 *
 * 신청·수락도 두지 않기로 해서 확정 멤버가 없다. 명세의 권한
 * 매트릭스에서 두 줄이 빠진 모습이다.
 */
export function canSeeSecret(
  comment: PostComment,
  viewer: Viewer,
  hostId: string,
): boolean {
  if (!comment.secret) return true
  if (!viewer.user_id) return false

  /* 내가 쓴 것 */
  if (comment.author.id === viewer.user_id) return true

  /* 방장. 사람을 고르려면 다 봐야 한다 */
  if (viewer.user_id === hostId) return true

  return false
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
  return comments.map((c) => {
    if (canSeeSecret(c, viewer, hostId)) return c
    const { body, ...rest } = c
    return rest
  })
}

/**
 * 시간순으로 세운다.
 *
 * 전에는 루트 아래 대댓글을 붙이는 threaded 였다. 답글을 1차에서
 * 빼면서 계층이 없어져 그냥 시간순이다. 함수를 지우지 않고 남긴
 * 것은 부르는 쪽이 정렬을 각자 하기 시작하면 화면마다 순서가
 * 달라지기 때문이다.
 */
export function inOrder(comments: PostComment[]): PostComment[] {
  return [...comments].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
}
