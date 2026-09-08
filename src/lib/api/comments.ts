import type { CommentAction, CommentState, PostAuthor, PostComment } from '@/types'
import { apiGet, apiSend } from './http'
import { PAGE_SIZE } from './config'
import { contractError, guards, type Guards } from './wire'

/**
 * 댓글 (API 설계 2-5).
 *
 * ─────────────────────────────────────────────────────────
 * **본문은 있으면 보이는 것이고 없으면 안 보이는 것이다.**
 *
 * 비밀 댓글에 권한이 없으면 서버가 `content` 키를 **통째로 뺀다.** null
 * 이 아니라 키가 없다 (API 컨벤션 「필드 표기 규칙」 마지막 줄). 그래서
 * 여기서 없는 본문을 빈 문자열로 채우면 안 된다 — 화면이 「본문이 비었다」
 * 와 「볼 권한이 없다」 를 구분하지 못하게 된다.
 *
 * 화면이 `comment-perm.ts` 로 직접 판정하던 것은 API 가 붙으면 지운다.
 * 그 파일 머리말이 그렇게 적어두었다.
 *
 * ─────────────────────────────────────────────────────────
 * **커서는 루트 댓글 기준이다.**
 *
 * 대댓글은 `replies` 로 부모에 담겨 온다. 대댓글까지 세면 페이지 경계에서
 * 부모와 자식이 갈린다 (CM-07). 그래서 「20건」 은 루트 20개고 화면에
 * 뿌려지는 줄 수는 그보다 많다.
 */

const SUBJECT = '댓글'
const HINT = '위키 02-설계-아키텍처/API-설계.md 의 「2-5. 댓글 (Companion)」 를 보고 맞춘다.'

/* 함수 선언이라야 never 가 흐름 분석에 쓰인다 (wire.ts) */
function fail(field: string, why: string): never {
  throw contractError(SUBJECT, HINT, field, why)
}

const { str, bool, strOrNull }: Guards = guards(SUBJECT, HINT)

interface Wire {
  [k: string]: unknown
}

function toAuthor(v: unknown, at: string): PostAuthor {
  if (v === null || typeof v !== 'object') fail(at, '객체가 아니다')
  const a = v as Wire
  return {
    id: str(a.id, `${at}.id`),
    nickname: str(a.nickname, `${at}.nickname`),
    profileImageUrl: strOrNull(a.profileImageUrl, `${at}.profileImageUrl`),
    lastSeen: a.lastSeen === undefined ? undefined : (str(a.lastSeen, `${at}.lastSeen`) as never),
  }
}

/**
 * 한 줄.
 *
 * `replies` 는 재귀로 보이지만 깊이가 1단계로 고정이라 한 번만 내려간다
 * (CM-02 · I-06). 루트가 아닌 것에 `replies` 가 오면 계약 위반이므로
 * 그대로 옮기고 화면이 안 그리게 둔다 — 여기서 던지면 목록 전체가 죽는다.
 */
export function toComment(raw: unknown): PostComment {
  if (raw === null || typeof raw !== 'object') fail('comment', '객체가 아니다')
  const w = raw as Wire

  const out: PostComment = {
    id: str(w.id, 'id'),
    parentId: strOrNull(w.parentId, 'parentId'),
    author: toAuthor(w.author, 'author'),
    secret: bool(w.secret, 'secret'),
    status: str(w.status, 'status') as CommentState,
    createdAt: str(w.createdAt, 'createdAt'),
    /* 서버가 채운다. 화면은 이 배열에 없는 버튼을 그리지 않는다 (CM-18) */
    availableActions: Array.isArray(w.availableActions)
      ? (w.availableActions as CommentAction[])
      : fail('availableActions', '배열이 아니다'),
  }

  /* 키가 있을 때만 넣는다. 없는 것과 빈 것을 화면이 구분해야 한다 (위 설명) */
  if ('content' in w && w.content !== null && w.content !== undefined) {
    out.content = str(w.content, 'content')
  }

  return out
}

/** 대댓글까지 평탄하게 편 목록. 화면이 parentId 로 묶어 그린다 */
function flatten(raw: unknown): PostComment[] {
  const root = toComment(raw)
  const w = raw as Wire
  const replies = Array.isArray(w.replies) ? w.replies : []
  return [root, ...replies.map(toComment)]
}

interface Page<T> {
  items: T[]
  nextCursor: string | null
  hasNext: boolean
}

/**
 * 한 장.
 *
 * **비회원도 부를 수 있다** (CM-20). 토큰을 주면 비밀 댓글 본문과
 * `availableActions` 가 그 사람 기준으로 채워진다.
 */
export async function fetchComments(
  postId: string,
  opts: { cursor?: string | null; size?: number; token?: string | null } = {},
): Promise<{ items: PostComment[]; nextCursor: string | null; hasNext: boolean }> {
  const page = await apiGet<Page<unknown>>(
    `/api/v1/posts/${encodeURIComponent(postId)}/comments`,
    { size: opts.size ?? PAGE_SIZE, cursor: opts.cursor ?? null },
    opts.token,
  )
  return {
    items: page.items.flatMap(flatten),
    nextCursor: page.nextCursor,
    hasNext: page.hasNext,
  }
}

/* ── 쓰기 ────────────────────────────────────────────────── */

/**
 * 작성 (CM-01 ~ CM-03).
 *
 * **작성자를 본문으로 보내지 않는다.** 서버가 토큰에서 읽는다 — 그것이
 * 남의 이름으로 쓰는 것을 막는 유일한 장치다.
 *
 * 응답은 조회와 모양이 다르다. `author` 와 `availableActions` 가 없다 —
 * 그 둘은 보는 사람에 따라 달라지는 판정을 거쳐야 나오고, 판정 지점을
 * 한 곳으로 모으려고 작성 응답에서는 조립하지 않는다. **화면은 쓴 뒤에
 * 목록을 다시 읽는다.**
 */
export interface CommentWrite {
  content: string
  /** 주면 대댓글. 루트 댓글에만 붙는다 (CM-02) */
  parentId?: string | null
  /** 작성할 때만 정한다. 수정으로 못 바꾼다 (CM-09) */
  secret: boolean
}

/** 방금 쓴 댓글. 조회 응답과 모양이 다르다 (위 설명) */
export interface WrittenComment {
  id: string
  parentId: string | null
  secret: boolean
  status: CommentState
  content: string
  createdAt: string
}

export async function writeComment(
  postId: string,
  body: CommentWrite,
  token: string,
): Promise<WrittenComment> {
  const raw = await apiSend<unknown>(
    'POST',
    `/api/v1/posts/${encodeURIComponent(postId)}/comments`,
    body,
    token,
  )
  if (raw === null || typeof raw !== 'object') fail('comment', '객체가 아니다')
  const w = raw as Wire
  return {
    id: str(w.id, 'id'),
    parentId: strOrNull(w.parentId, 'parentId'),
    secret: bool(w.secret, 'secret'),
    status: str(w.status, 'status') as CommentState,
    content: str(w.content, 'content'),
    createdAt: str(w.createdAt, 'createdAt'),
  }
}

/** 수정 (CM-09). 작성자 본인만. `secret` 은 못 바꾼다 */
export async function editComment(
  commentId: string,
  content: string,
  token: string,
): Promise<void> {
  await apiSend<unknown>('PATCH', `/api/v1/comments/${encodeURIComponent(commentId)}`, { content }, token)
}

/**
 * 삭제 (CM-10 · CM-11). 작성자 또는 방장.
 *
 * 소프트 삭제라 아래 대댓글이 있으면 자리표시자로 남는다. 그래서 지운
 * 뒤에도 목록을 다시 읽어야 한다 — 사라질지 자리가 남을지는 서버가 안다.
 */
export async function deleteComment(commentId: string, token: string): Promise<void> {
  await apiSend<unknown>('DELETE', `/api/v1/comments/${encodeURIComponent(commentId)}`, undefined, token)
}
