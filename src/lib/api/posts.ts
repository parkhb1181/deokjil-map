import type { ClosedReason, CompanionPost, MeetPoint, PostAuthor, PostState } from '@/types'
import { apiGet, apiSend } from './http'
import { PAGE_SIZE } from './config'
import { contractError, guards, type Guards } from './wire'

/**
 * 모집글 (API 설계 2-4).
 *
 * ─────────────────────────────────────────────────────────
 * **목록과 상세가 같은 모양이 아니다.**
 *
 * 목록은 본문 대신 `excerpt` 를 싣는다. 카드에 두 줄만 보이는데 20건치
 * 본문을 통째로 내리면 응답이 커진다. 그래서 타입을 둘로 나눈다 —
 * 목록에서 상세용 필드를 읽으려다 `undefined` 를 만나는 일이 없게.
 *
 * ─────────────────────────────────────────────────────────
 * **`closesAt` 은 서버가 주지 않는다.**
 *
 * 응답에 그런 칸이 없다. 마감 시각을 따로 받는 입력이 화면에 없어서
 * 마감이 곧 만남 시각이기 때문이다 (SPEC-CONFLICTS 5번. 위키 I-04 가
 * `meetAt ≤ 행사 종료시각` 만 남기면서 정리됐다). 화면은 「… 마감」 을
 * 그리므로 여기서 `meetAt` 을 그대로 넣는다.
 *
 * **채워 넣는 것을 여기서만 한다.** 화면마다 `post.closesAt ?? post.meetAt`
 * 을 쓰면 한 곳을 빠뜨렸을 때 그 화면만 빈칸이 된다.
 */

const SUBJECT = '모집글'
const HINT = '위키 02-설계-아키텍처/API-설계.md 의 「2-4. 모집글 (Companion)」 를 보고 맞춘다.'

/* 함수 선언이라야 never 가 흐름 분석에 쓰인다 (wire.ts) */
function fail(field: string, why: string): never {
  throw contractError(SUBJECT, HINT, field, why)
}

const { str, num, strOrNull }: Guards = guards(SUBJECT, HINT)

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

function toMeetPoint(v: unknown): MeetPoint {
  if (v === null || typeof v !== 'object') fail('meetPoint', '객체가 아니다')
  const m = v as Wire
  return {
    /* 장소명만 `place` 다. 좌표는 행사 Place 와 같은 이름을 쓴다 (API 설계 5장) */
    place: str(m.place, 'meetPoint.place'),
    lat: num(m.lat, 'meetPoint.lat'),
    lng: num(m.lng, 'meetPoint.lng'),
  }
}

/** 목록과 상세가 함께 쓰는 부분 */
function common(w: Wire) {
  const meetAt = str(w.meetAt, 'meetAt')
  return {
    id: str(w.id, 'id'),
    /* 행사를 안 고른 글은 셋 다 null 이다 (API 설계 2-4) */
    eventId: strOrNull(w.eventId, 'eventId'),
    eventTitle: strOrNull(w.eventTitle, 'eventTitle'),
    eventImageUrl: strOrNull(w.eventImageUrl, 'eventImageUrl'),
    title: str(w.title, 'title'),
    status: str(w.status, 'status') as PostState,
    closedReason: (w.closedReason as ClosedReason | null) ?? null,
    /* 정원 미표시가 null 이다. 0 이 아니다 (I-03) */
    capacity: w.capacity === null || w.capacity === undefined ? null : num(w.capacity, 'capacity'),
    meetAt,
    closesAt: meetAt,
    meetPoint: toMeetPoint(w.meetPoint),
    author: toAuthor(w.author, 'author'),
    commentCount: num(w.commentCount, 'commentCount'),
  }
}

/** 목록 한 줄. 본문 대신 `excerpt` 가 온다 */
export type PostListItem = Omit<CompanionPost, 'content' | 'createdAt'> & { excerpt: string }

export function toPostListItem(raw: unknown): PostListItem {
  if (raw === null || typeof raw !== 'object') fail('post', '객체가 아니다')
  const w = raw as Wire
  return { ...common(w), excerpt: str(w.excerpt ?? '', 'excerpt') }
}

export function toPost(raw: unknown): CompanionPost {
  if (raw === null || typeof raw !== 'object') fail('post', '객체가 아니다')
  const w = raw as Wire
  return {
    ...common(w),
    content: str(w.content ?? '', 'content'),
    createdAt: str(w.createdAt, 'createdAt'),
  }
}

/* ── 읽기 ────────────────────────────────────────────────── */

interface Page<T> {
  items: T[]
  nextCursor: string | null
  hasNext: boolean
}

/**
 * 목록 한 장.
 *
 * **전량을 받지 않는다.** 행사와 달리 모집글은 스크롤로 이어 받는다 —
 * 정적 페이지에 굽지 않기 때문이다 (API 설계 2-3 「모집글·댓글은 ISR
 * 대상이 아니다」). 댓글이 실시간이라 정적화하면 안 된다.
 *
 * @param status 생략하면 전체. `OPEN` 하나만 받는다 (PO-08)
 */
export async function fetchPosts(opts: {
  cursor?: string | null
  status?: 'OPEN'
  size?: number
}): Promise<PostsPage> {
  return toPage(
    await apiGet<Page<unknown>>('/api/v1/posts', {
      size: opts.size ?? PAGE_SIZE,
      cursor: opts.cursor ?? null,
      status: opts.status ?? null,
    }),
  )
}

/** 상세 한 건. **비인증 요청에도 본문이 온다** (PO-11) */
export async function fetchPost(id: string, token?: string | null): Promise<CompanionPost> {
  return toPost(await apiGet<unknown>(`/api/v1/posts/${encodeURIComponent(id)}`, undefined, token))
}

/* ── 쓰기 ────────────────────────────────────────────────── */

/** 작성 요청 (PO-01 · PO-02 · PO-03 · PO-05) */
export interface PostWrite {
  title: string
  /** 행사를 안 고르면 생략한다. 그러면 서버가 meetAt 을 행사와 대조하지 않는다 */
  eventId?: string | null
  /** ISO-8601 + KST 오프셋 */
  meetAt: string
  meetPoint: MeetPoint
  content?: string
  /** 없으면 정원 미표시. 값이 있으면 2~6 (I-03) */
  capacity?: number | null
}

/**
 * 방금 쓴 글.
 *
 * **조회 응답과 모양이 다르다.** `author` 와 `commentCount` 가 없다 —
 * 댓글 작성 응답이 `author` · `availableActions` 를 빼는 것과 같은
 * 이유로, 보는 사람에 따라 갈리는 판정을 작성 경로에서 조립하지 않는다.
 *
 * 한때 이걸 `toPost` 로 받다가 **성공한 요청에서 예외가 났다.** 글은
 * 저장됐는데 화면에는 실패로 떴다. 로컬 연동 시험에서 잡았다.
 * 지금은 화면이 `id` 만 쓰므로 그것만 확실히 한다.
 */
export interface WrittenPost {
  id: string
  title: string
  status: PostState
  meetAt: string
  createdAt: string
}

function toWrittenPost(raw: unknown): WrittenPost {
  if (raw === null || typeof raw !== 'object') fail('post', '객체가 아니다')
  const w = raw as Wire
  return {
    id: str(w.id, 'id'),
    title: str(w.title, 'title'),
    status: str(w.status, 'status') as PostState,
    meetAt: str(w.meetAt, 'meetAt'),
    createdAt: str(w.createdAt, 'createdAt'),
  }
}

export async function createPost(body: PostWrite, token: string): Promise<WrittenPost> {
  return toWrittenPost(await apiSend<unknown>('POST', '/api/v1/posts', body, token))
}

/**
 * 수정 (PO-06). `OPEN` 에서만 통하고 `CLOSED` 면 409 다.
 *
 * ─────────────────────────────────────────────────────────
 * **`PATCH` 인데 전체를 보낸다.**
 *
 * 메서드 이름만 보면 바꿀 칸만 보내면 될 것 같지만, 서버는 작성과 같은
 * 검증을 건다. 제목만 보내면 「만남시각을 입력해 주세요」 400 이 온다
 * (2026-09-08 실측).
 *
 * 그래서 타입을 `Partial` 이 아니라 `PostWrite` 그대로 둔다. 부분만 받게
 * 두면 부르는 쪽이 「바뀐 칸만 보내면 되겠지」 하고 짜게 되고, 그 실수는
 * 컴파일에서 안 잡히고 사용자가 저장을 누르는 순간에만 드러난다.
 *
 * 수정 화면이 모든 칸을 이미 채워 두고 있어서(`NewPost` 의 `draft`)
 * 전체를 보내는 데 드는 비용은 없다.
 */
export async function updatePost(
  id: string,
  body: PostWrite,
  token: string,
): Promise<WrittenPost> {
  return toWrittenPost(
    await apiSend<unknown>('PATCH', `/api/v1/posts/${encodeURIComponent(id)}`, body, token),
  )
}

/**
 * 마감 (PO-07).
 *
 * **상태를 PATCH 로 넘기지 않는다.** 전이 규칙이 한 경로에만 있어야
 * 배치(PO-14)와 같은 코드를 지난다 (도메인 3.1).
 *
 * 2026-09-08 에 서버에 들어왔다. 응답은 {id, status, closedReason} 인데
 * 화면이 목록을 다시 읽으므로 쓰지 않는다.
 */
export async function closePost(id: string, token: string): Promise<void> {
  await apiSend<unknown>('POST', `/api/v1/posts/${encodeURIComponent(id)}/close`, undefined, token)
}

/* ── 사람이 쓴 글 ────────────────────────────────────────── */

/**
 * 내 활동 · 공개 프로필의 모집글 탭 (AU-09 · AU-10).
 *
 * ─────────────────────────────────────────────────────────
 * **목록과 같은 봉투에 같은 항목이 온다.**
 *
 * `items` · `nextCursor` · `hasNext` 셋이고 한 줄의 모양이 `/posts` 의
 * 카드와 같다. 그래서 매퍼를 새로 만들지 않고 `toPostListItem` 을 그대로
 * 쓴다 — 서버가 일부러 그렇게 맞춰 줬다(「프론트가 모집글 카드 파서를
 * 하나만 쓴다」). 여기서 한 벌 더 만들면 그 배려가 사라진다.
 *
 * **`status` 필터가 없다.** 목록(PO-08)에는 「모집중만」 이 있지만 프로필
 * 탭에는 없다. 마감된 글도 내역에 남아야 한다.
 *
 * 둘의 차이는 **누구를 묻느냐** 하나뿐이다. 내 것은 토큰에서 꺼내고 남의
 * 것은 주소에서 꺼낸다. 회원번호를 요청에 실어 보내는 경로를 서버가 아예
 * 안 만들었다 — 남의 내역을 내 것처럼 부를 자리를 없앤 것이다.
 */
interface PostsPage {
  items: PostListItem[]
  nextCursor: string | null
  hasNext: boolean
}

function toPage(page: Page<unknown>): PostsPage {
  return {
    items: page.items.map(toPostListItem),
    nextCursor: page.nextCursor,
    hasNext: page.hasNext,
  }
}

/** 내가 쓴 글. 작성 최신순이고 마감된 것도 온다 (AU-10) */
export async function fetchMyPosts(
  token: string,
  opts: { cursor?: string | null; size?: number } = {},
): Promise<PostsPage> {
  return toPage(
    await apiGet<Page<unknown>>(
      '/api/v1/users/me/posts',
      { size: opts.size ?? PAGE_SIZE, cursor: opts.cursor ?? null },
      token,
    ),
  )
}

/**
 * 그 사람이 쓴 글 (AU-09).
 *
 * **없는 회원번호로 물어도 200 에 빈 페이지다.** 404 가 아니다 — 없는
 * 회원과 글이 없는 회원의 응답을 서버가 일부러 같게 뒀다. 화면은 프로필
 * 단건(`fetchPublicProfile`)의 404 로 「없는 사람」 을 판단한다.
 */
export async function fetchUserPosts(
  userId: string,
  opts: { cursor?: string | null; size?: number } = {},
): Promise<PostsPage> {
  return toPage(
    await apiGet<Page<unknown>>(`/api/v1/users/${encodeURIComponent(userId)}/posts`, {
      size: opts.size ?? PAGE_SIZE,
      cursor: opts.cursor ?? null,
    }),
  )
}
