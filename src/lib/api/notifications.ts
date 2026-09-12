import type { Page } from '@/types'
import { apiGet, apiSend } from './http'
import { contractError, guards, type Guards } from './wire'

/**
 * 알림 (NT-08 ~ NT-10). 위키 「2-10. 알림」.
 *
 * **전부 로그인이 필요하다.** 알림함은 본인 것뿐이라 비회원 경로가 없다.
 * 부르는 쪽이 `authed()` 로 감싼다.
 *
 * ─────────────────────────────────────────────────────────
 * **문구가 안 온다.** 서버는 `kind` 와 참조 ID 만 준다 — 문안 한 줄
 * 고치는 데 배포가 들지 않게 하려는 결정이다 (API 설계 2-10). 그래서
 * 「누가」 와 「어느 글」 은 여기 없다. 글 제목은 화면이 `fetchPost` 로
 * 따로 채운다 (Alerts.tsx). 상대 닉네임은 지금 계약에 실을 자리가
 * 없어 안 보인다 — 서버에 `actor` 를 더해 달라고 할 지점이다.
 */

const SUBJECT = '알림'
const HINT = '위키 02-설계-아키텍처/API-설계.md 의 「2-10. 알림 (Notification)」 을 보고 맞춘다.'

function fail(field: string, why: string): never {
  throw contractError(SUBJECT, HINT, field, why)
}

const { num, bool, str }: Guards = guards(SUBJECT, HINT)

/** 지금 둘이다. 채팅 종류는 NT-07 이 더한다 — 그때 여기와 Alerts 의 문구 표를 같이 늘린다 */
export type NotificationKind = 'POST_COMMENTED' | 'COMMENT_REPLIED'
const KINDS: readonly NotificationKind[] = ['POST_COMMENTED', 'COMMENT_REPLIED']

export interface Notification {
  id: string
  kind: NotificationKind
  /** 눌렀을 때 갈 모집글 */
  postId: string
  /** 그 글에서 가리킬 댓글. 지금은 항상 오지만 계약상 nullable 로 둔다 */
  commentId: string | null
  read: boolean
  /** KST 오프셋이 붙은 ISO. `when.ts` 의 parts 가 그대로 읽는다 */
  createdAt: string
}

interface Wire {
  id?: unknown
  kind?: unknown
  postId?: unknown
  commentId?: unknown
  read?: unknown
  createdAt?: unknown
}

function toNotification(raw: unknown): Notification {
  if (!raw || typeof raw !== 'object') fail('item', '객체가 아닙니다')
  const w = raw as Wire
  const kind = str(w.kind, 'kind')
  if (!(KINDS as readonly string[]).includes(kind)) fail('kind', `모르는 값 ${kind}`)
  return {
    /* 숫자 ID 는 문자열로 든다. 화면의 다른 ID 와 같은 규칙이다 (posts.ts) */
    id: String(num(w.id, 'id')),
    kind: kind as NotificationKind,
    postId: String(num(w.postId, 'postId')),
    commentId: w.commentId === null || w.commentId === undefined ? null : String(num(w.commentId, 'commentId')),
    read: bool(w.read, 'read'),
    createdAt: str(w.createdAt, 'createdAt'),
  }
}

const PAGE_SIZE = 20

/** 내 알림함 한 장. 최신순, 읽은 것도 온다 */
export async function fetchNotifications(
  token: string,
  opts: { cursor?: string | null; size?: number } = {},
): Promise<Page<Notification>> {
  const page = await apiGet<Page<unknown>>(
    '/api/v1/notifications',
    { size: opts.size ?? PAGE_SIZE, cursor: opts.cursor ?? null },
    token,
  )
  if (!Array.isArray(page.items)) fail('items', '배열이 아닙니다')
  return {
    items: page.items.map(toNotification),
    nextCursor: page.nextCursor ?? null,
    hasNext: Boolean(page.hasNext),
  }
}

/**
 * 하나 읽음 (NT-09). 이미 읽은 것을 다시 불러도 성공이다.
 * 남의 것과 없는 것은 같은 404 (`NOTIFICATION_NOT_FOUND`).
 */
export async function markRead(id: string, token: string): Promise<void> {
  await apiSend<void>('POST', `/api/v1/notifications/${encodeURIComponent(id)}/read`, undefined, token)
}

/** 전부 읽음 (NT-09). 읽을 것이 없어도 성공이다 */
export async function markAllRead(token: string): Promise<void> {
  await apiSend<void>('POST', '/api/v1/notifications/read', undefined, token)
}

/** 배지 숫자 (NT-10). 목록에 끼어 오지 않고 따로 부른다 */
export async function fetchUnreadCount(token: string): Promise<number> {
  const raw = await apiGet<{ unreadCount?: unknown }>('/api/v1/notifications/unread-count', undefined, token)
  return num(raw?.unreadCount, 'unreadCount')
}
