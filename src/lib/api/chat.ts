import type { LastSeen, Page } from '@/types'
import { apiGet, apiSend } from './http'
import { contractError, guards, type Guards } from './wire'

/**
 * 채팅 (CH-04 ~ CH-09 · CH-12 · CH-20). 위키 「2-11. 채팅」.
 *
 * **전부 로그인이 필요하다.** 방은 멤버만 보고, 비회원 경로가 없다.
 * 부르는 쪽이 `authed()` 로 감싼다.
 *
 * ─────────────────────────────────────────────────────────
 * **실시간이 아직 없다.** CH-10 (SSE) 이 서버에 없어서 화면이 몇 초마다
 * 다시 묻는다 (ChatRoom.tsx). 붙으면 그쪽만 바꾸면 되고 여기 함수는
 * 그대로다.
 *
 * **방 목록에 마지막 메시지와 안 읽은 수가 안 온다.** CH-05 · CH-13 이
 * 그것을 약속했는데 지금 응답은 방 이름·약속 시각·인원뿐이다. 목록 화면이
 * 그 두 줄을 비워 둔다 — 서버에 더해 달라고 할 지점이다.
 *
 * **방장이 누구인지 안 온다.** 방 상세의 멤버 목록에 표시가 없다. 화면은
 * 「방장」 뱃지를 못 달고, 나가기가 방장이라 막히면 서버의 409 를 그대로
 * 보여준다 (CHAT_ROOM_HOST_CANNOT_LEAVE).
 */

const SUBJECT = '채팅'
const HINT = '위키 02-설계-아키텍처/API-설계.md 의 「2-11. 채팅 (Chat)」 을 보고 맞춘다.'

function fail(field: string, why: string): never {
  throw contractError(SUBJECT, HINT, field, why)
}

const { str, num, bool, strOrNull }: Guards = guards(SUBJECT, HINT)

function obj(v: unknown, field: string): Record<string, unknown> {
  if (!v || typeof v !== 'object') fail(field, '객체가 아닙니다')
  return v as Record<string, unknown>
}

/* ── 형태 ─────────────────────────────────────────────── */

/** 방 목록의 한 줄 (CH-05) */
export interface ChatRoomSummary {
  roomId: string
  postId: string
  postTitle: string
  /** KST 오프셋 ISO */
  meetAt: string
  memberCount: number
}

export interface ChatMember {
  id: string
  nickname: string
  imageUrl: string | null
  lastSeen: LastSeen | null
}

/** 방 상세 (CH-06). 모집글 요약·멤버·지금 쓸 수 있는지 */
export interface ChatRoomDetail {
  roomId: string
  post: { id: string; title: string; meetAt: string }
  members: ChatMember[]
  /** 만남시각 기준 채팅 가능 구간 안인가 (CH-08). 아니면 읽기만 된다 */
  writable: boolean
}

export type ChatMessageStatus = 'ACTIVE' | 'DELETED'

/** 메시지 한 줄 (CH-09). 지운 것은 본문 키가 아예 없다 */
export interface ChatMsg {
  id: string
  sender: { id: string; nickname: string; imageUrl: string | null }
  /** DELETED 면 null */
  content: string | null
  status: ChatMessageStatus
  createdAt: string
}

const LAST_SEEN: readonly LastSeen[] = ['TODAY', 'WITHIN_3_DAYS', 'WITHIN_WEEK', 'WITHIN_MONTH', 'LONG_AGO']

function toMember(raw: unknown): ChatMember {
  const w = obj(raw, 'member')
  const seen = w.lastSeen === null || w.lastSeen === undefined ? null : str(w.lastSeen, 'member.lastSeen')
  if (seen !== null && !(LAST_SEEN as readonly string[]).includes(seen)) fail('member.lastSeen', `모르는 값 ${seen}`)
  return {
    id: str(w.userId, 'member.userId'),
    nickname: str(w.nickname, 'member.nickname'),
    imageUrl: strOrNull(w.profileImageUrl, 'member.profileImageUrl'),
    lastSeen: seen as LastSeen | null,
  }
}

function toSummary(raw: unknown): ChatRoomSummary {
  const w = obj(raw, 'room')
  return {
    roomId: str(w.roomId, 'roomId'),
    postId: str(w.postId, 'postId'),
    postTitle: str(w.postTitle, 'postTitle'),
    meetAt: str(w.meetAt, 'meetAt'),
    memberCount: num(w.memberCount, 'memberCount'),
  }
}

function toDetail(raw: unknown): ChatRoomDetail {
  const w = obj(raw, 'room')
  const p = obj(w.post, 'post')
  if (!Array.isArray(w.members)) fail('members', '배열이 아닙니다')
  return {
    roomId: str(w.roomId, 'roomId'),
    post: { id: str(p.postId, 'post.postId'), title: str(p.title, 'post.title'), meetAt: str(p.meetAt, 'post.meetAt') },
    members: w.members.map(toMember),
    writable: bool(w.writable, 'writable'),
  }
}

function toMsg(raw: unknown): ChatMsg {
  const w = obj(raw, 'message')
  const s = obj(w.sender, 'message.sender')
  const status = str(w.status, 'message.status')
  if (status !== 'ACTIVE' && status !== 'DELETED') fail('message.status', `모르는 값 ${status}`)
  return {
    id: str(w.messageId, 'message.messageId'),
    sender: {
      id: str(s.userId, 'sender.userId'),
      nickname: str(s.nickname, 'sender.nickname'),
      imageUrl: strOrNull(s.profileImageUrl, 'sender.profileImageUrl'),
    },
    /* 지운 메시지는 content 키가 없다 (CH-12). 없는 것과 빈 문자열을 가르지 않는다 */
    content: status === 'DELETED' ? null : strOrNull(w.content, 'message.content'),
    status,
    createdAt: str(w.createdAt, 'message.createdAt'),
  }
}

/* ── 읽기 ─────────────────────────────────────────────── */

/** 내가 속한 방 전부 (CH-05). 페이지가 없다 — 한 사람이 속한 방은 몇 개 안 된다 */
export async function fetchRooms(token: string): Promise<ChatRoomSummary[]> {
  const raw = await apiGet<unknown>('/api/v1/chat-rooms', undefined, token)
  if (!Array.isArray(raw)) fail('rooms', '배열이 아닙니다')
  return raw.map(toSummary)
}

/** 방 하나 (CH-06). 멤버가 아니면 403 CHAT_ROOM_ACCESS_DENIED */
export async function fetchRoom(roomId: string, token: string): Promise<ChatRoomDetail> {
  return toDetail(await apiGet<unknown>(`/api/v1/chat-rooms/${encodeURIComponent(roomId)}`, undefined, token))
}

const PAGE_SIZE = 30

/**
 * 메시지 한 장 (CH-09). **최신부터** 온다 — 화면이 뒤집어 그린다.
 * 커서는 이전 응답의 nextCursor 고, 없으면 맨 최근 장이다.
 */
export async function fetchMessages(
  roomId: string,
  token: string,
  opts: { cursor?: string | null; size?: number } = {},
): Promise<Page<ChatMsg>> {
  const page = await apiGet<Page<unknown>>(
    `/api/v1/chat-rooms/${encodeURIComponent(roomId)}/messages`,
    { size: opts.size ?? PAGE_SIZE, cursor: opts.cursor ?? null },
    token,
  )
  if (!Array.isArray(page.items)) fail('items', '배열이 아닙니다')
  return { items: page.items.map(toMsg), nextCursor: page.nextCursor ?? null, hasNext: Boolean(page.hasNext) }
}

/* ── 쓰기 ─────────────────────────────────────────────── */

/** 최대 글자수. 서버의 Message.MAX_CONTENT_LENGTH 와 같은 값이어야 한다 (CH-07) */
export const MESSAGE_MAX = 1000

export interface SentMessage {
  id: string
  roomId: string
  senderId: string
  content: string
  createdAt: string
}

/**
 * 보내기 (CH-07).
 *
 * **`clientMessageId` 는 화면이 만든다.** 같은 값으로 다시 보내면 서버가
 * 새로 저장하지 않고 먼저 것을 돌려준다 — 전송 중 연결이 끊겨 다시
 * 눌렀을 때 두 번 올라가지 않게 하는 장치다. 한 메시지에 하나, 다른
 * 메시지에 재사용하면 409 (CHAT_CLIENT_MESSAGE_ID_REUSED).
 */
export async function sendMessage(
  roomId: string,
  body: { clientMessageId: string; content: string },
  token: string,
): Promise<SentMessage> {
  const w = obj(
    await apiSend<unknown>('POST', `/api/v1/chat-rooms/${encodeURIComponent(roomId)}/messages`, body, token),
    'sent',
  )
  return {
    id: str(w.messageId, 'sent.messageId'),
    roomId: str(w.roomId, 'sent.roomId'),
    senderId: str(w.senderId, 'sent.senderId'),
    content: str(w.content, 'sent.content'),
    createdAt: str(w.createdAt, 'sent.createdAt'),
  }
}

/** 내가 보낸 것만 지운다 (CH-12). 자리표시자가 남는다 */
export async function deleteMessage(roomId: string, messageId: string, token: string): Promise<void> {
  await apiSend<void>(
    'DELETE',
    `/api/v1/chat-rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`,
    undefined,
    token,
  )
}

/** 스스로 나간다 (CH-04). 방장은 못 나간다 — 409 CHAT_ROOM_HOST_CANNOT_LEAVE. 나가면 다시 초대받지 못한다 */
export async function leaveRoom(roomId: string, token: string): Promise<void> {
  await apiSend<void>('DELETE', `/api/v1/chat-rooms/${encodeURIComponent(roomId)}/members/me`, undefined, token)
}

/**
 * 초대 (CH-02). 방장이 그 글에 댓글을 쓴 사람을 부른다.
 * 방은 글 하나에 하나라 (CH-01) 응답의 roomId 로 바로 들어간다.
 */
export async function inviteToRoom(
  postId: string,
  userId: string,
  token: string,
): Promise<{ roomId: string; memberCount: number }> {
  const w = obj(
    await apiSend<unknown>('POST', `/api/v1/posts/${encodeURIComponent(postId)}/chat-room/members`, { userId: Number(userId) }, token),
    'invite',
  )
  return { roomId: str(w.roomId, 'invite.roomId'), memberCount: num(w.memberCount, 'invite.memberCount') }
}
