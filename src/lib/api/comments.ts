import type { CommentAction, CommentState, PostAuthor, Page } from '@/types'
import { apiGet, apiSend } from './http'

/**
 * 댓글 (CM).
 *
 * 응답 모양은 위키 `화면-계약/모집글-댓글.md` 2장, 판정 근거는
 * 도메인 7.1 가시성 매트릭스다.
 *
 * ─────────────────────────────────────────────────────────
 * **`content` 는 옵셔널이 아니라 「없을 수 있다」 이다.**
 *
 * 권한이 없으면 서버가 키를 통째로 뺀다. `null` 이 아니다 (CM-05 · I-07).
 * 화면은 키가 있는지만 보고 자리표시자를 그린다. 클라이언트가 가리면
 * 페이지 소스에 원문이 남는데, 실제로 그 사고를 한 번 겪었다.
 */
export interface CommentNode {
  id: string
  parentId: string | null
  secret: boolean
  status: CommentState
  /** 권한이 없으면 이 키가 아예 없다 */
  content?: string
  createdAt: string
  availableActions: CommentAction[]
  author: PostAuthor
  /** 대댓글. 깊이 1단계 고정이라 이 안은 항상 비어 있다 (CM-02) */
  replies: CommentNode[]
}

/**
 * 목록. **루트 댓글 기준 커서다** (CM-07).
 *
 * 대댓글은 부모와 함께 온다. 페이지 경계에서 대댓글만 다음 장으로
 * 넘어가면 고아가 된다.
 *
 * 비회원도 부를 수 있다 (CM-20). 공개 댓글 본문은 오고 비밀은 안 온다.
 */
export function listComments(
  postId: string,
  cursor?: string | null,
  token?: string | null,
): Promise<Page<CommentNode>> {
  /* 토큰은 헤더로 간다. 누가 보느냐로 본문이 갈리므로 캐시도 안 탄다 */
  return apiGet<Page<CommentNode>>(
    `/api/v1/posts/${encodeURIComponent(postId)}/comments`,
    { cursor },
    token,
  )
}

export interface NewComment {
  content: string
  /** 주면 대댓글. 루트에만 붙는다 */
  parentId?: string | null
  secret: boolean
}

export function writeComment(
  postId: string,
  body: NewComment,
  token: string,
): Promise<CommentNode | null> {
  return apiSend<CommentNode>(
    'POST',
    `/api/v1/posts/${encodeURIComponent(postId)}/comments`,
    body,
    token,
  )
}

/**
 * 수정 (CM-09). 작성자 본인만.
 *
 * **`secret` 을 보내지 않는다.** 비밀 여부는 작성할 때만 정하고
 * 나중에 못 바꾼다. 공개로 쓴 것을 비밀로 바꾸면 이미 읽은 사람이
 * 있고, 비밀을 공개로 바꾸면 연락처가 드러난다.
 */
export function editComment(id: string, content: string, token: string): Promise<CommentNode | null> {
  return apiSend<CommentNode>('PATCH', `/api/v1/comments/${encodeURIComponent(id)}`, { content }, token)
}

/**
 * 삭제 (CM-10). 작성자 또는 방장. 소프트 삭제다.
 *
 * 하위 대댓글이 있으면 자리표시자로 남고 없으면 목록에서 빠진다
 * (CM-11). 그 판정은 서버가 한다.
 */
export function deleteComment(id: string, token: string): Promise<null> {
  return apiSend<null>('DELETE', `/api/v1/comments/${encodeURIComponent(id)}`, undefined, token)
}
