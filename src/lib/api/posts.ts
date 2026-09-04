import type { CompanionPost, MeetPoint, Page } from '@/types'
import { apiGet, apiSend } from './http'
import { PAGE_SIZE } from './config'

/**
 * 모집글 (PO).
 *
 * 응답 모양은 위키 `02-설계-아키텍처/화면-계약/모집글-댓글.md` 1장이다.
 * **행사와 달리 정본이 백엔드다.** 여기 적힌 타입이 API 설계와 어긋나면
 * API 설계가 이긴다.
 *
 * 화면은 아직 목데이터를 본다. 이 파일은 서버가 뜨는 날 `page.tsx` 에서
 * 부르기만 하면 되도록 미리 깔아둔 것이다.
 */

/** 목록 항목. 상세에서 `content` 대신 `excerpt` 가 오고 몇 개가 빠진다 */
export interface PostListItem {
  id: string
  eventId: string | null
  eventTitle: string | null
  imageUrl: string | null
  title: string
  excerpt: string
  status: CompanionPost['status']
  closedReason: CompanionPost['closedReason']
  capacity: number | null
  meetAt: string
  meetPoint: MeetPoint
  author: CompanionPost['author']
  commentCount: number
}

export interface PostListQuery {
  /** 안 주면 `OPEN` 만. 「전체」 탭이 `ALL` 이다 */
  status?: 'OPEN' | 'ALL'
  cursor?: string | null
  size?: number
}

export function listPosts(q: PostListQuery = {}): Promise<Page<PostListItem>> {
  return apiGet<Page<PostListItem>>('/api/v1/posts', {
    status: q.status === 'ALL' ? undefined : (q.status ?? 'OPEN'),
    cursor: q.cursor,
    size: q.size ?? PAGE_SIZE,
  })
}

/**
 * 상세.
 *
 * **비인증 요청에도 본문이 온다** (PO-11). 토큰을 안 붙여도 200 이다.
 * 공유 링크로 들어온 사람이 로그인 없이 읽을 수 있어야 한다.
 */
export function getPost(id: string): Promise<CompanionPost> {
  return apiGet<CompanionPost>(`/api/v1/posts/${encodeURIComponent(id)}`)
}

/** 작성·수정이 보내는 것. 화면 폼과 1:1 이다 */
export interface PostBody {
  title: string
  content: string
  eventId: string | null
  capacity: number | null
  meetAt: string
  meetPoint: MeetPoint
}

export function createPost(body: PostBody, token: string): Promise<CompanionPost | null> {
  return apiSend<CompanionPost>('POST', '/api/v1/posts', body, token)
}

/**
 * 수정 (PO-06). **`OPEN` 일 때만 된다.** 아니면 409 다.
 *
 * 화면도 `CLOSED` 면 수정 버튼을 안 그리고 주소로 들어와도 막지만,
 * 그 사이에 마감 배치가 돌 수 있어 여기서 409 를 받는 일이 실제로
 * 생긴다. `POST_ALREADY_CLOSED` 가 「다시 읽어라」 로 매핑돼 있다.
 */
export function editPost(id: string, body: PostBody, token: string): Promise<CompanionPost | null> {
  return apiSend<CompanionPost>('PATCH', `/api/v1/posts/${encodeURIComponent(id)}`, body, token)
}

/**
 * 모집 완료 (PO-07). `closedReason = MANUAL` 로 닫힌다.
 *
 * 상태를 `PATCH` 로 넘기지 않고 전용 경로를 쓴다. 전이 규칙이 한
 * 경로에만 있어야 마감 배치와 같은 코드를 지난다 (도메인 3.1).
 *
 * **방장 취소는 1차에 없다.** 그래서 사유를 받지 않는다.
 */
export function closePost(id: string, token: string): Promise<null> {
  return apiSend<null>('POST', `/api/v1/posts/${encodeURIComponent(id)}/close`, undefined, token)
}
