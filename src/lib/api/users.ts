import type { LastSeen, Page, Sanction } from '@/types'
import { apiGet, apiSend } from './http'

/**
 * 회원 (AU).
 *
 * 응답 모양은 위키 `화면-계약/회원-신고-백오피스.md` 1장이다.
 */

export interface PublicUser {
  id: string
  nickname: string
  imageUrl: string | null
  bio: string | null
  /** 구간 값이다. 원본 시각은 안 내려온다 (AU-09 · 도메인 7.2) */
  lastSeen: LastSeen
}

/** 프로필에 딸려 보이는 모집글. 붙은 행사에서 온 조인 값이 섞인다 */
export interface UserPost {
  id: string
  title: string
  status: 'OPEN' | 'CLOSED'
  closedReason: 'MANUAL' | 'MEET_TIME_PASSED' | null
  meetAt: string
  /** 행사를 안 고른 글은 null 이다. 행사 쪽과 같은 region.code 문자열 */
  district: string | null
  imageUrl: string | null
  commentCount: number
}

export function getUser(id: string): Promise<PublicUser> {
  return apiGet<PublicUser>(`/api/v1/users/${encodeURIComponent(id)}`)
}

/**
 * 남의 모집글.
 *
 * **`me/posts` 와 합치지 않는다.** 응답이 다르다 — 남의 프로필에서는
 * 공개된 것만 보이고 내 내역에서는 내가 쓴 전부가 보인다. 경로를
 * 합치면 그 분기가 한 핸들러 안으로 들어온다 (API 설계 2-2).
 */
export function listUserPosts(id: string, cursor?: string | null): Promise<Page<UserPost>> {
  return apiGet<Page<UserPost>>(`/api/v1/users/${encodeURIComponent(id)}/posts`, { cursor })
}

/** 내 모집글. 안 읽은 댓글 수가 더 붙는다 */
export interface MyPost extends UserPost {
  newComments: number
}

export interface MyComment {
  id: string
  postId: string
  postTitle: string
  /** 내가 쓴 것이라 비밀이어도 본문이 온다 (CM-16) */
  content: string
  secret: boolean
  createdAt: string
  replied: boolean
}

export function listMyPosts(token: string, cursor?: string | null): Promise<Page<MyPost>> {
  return apiGet<Page<MyPost>>('/api/v1/users/me/posts', { cursor }, token)
}

export function listMyComments(token: string, cursor?: string | null): Promise<Page<MyComment>> {
  return apiGet<Page<MyComment>>('/api/v1/users/me/comments', { cursor }, token)
}

/** 가입 정보 (AU-05). 닉네임과 출생연도. 성별은 받지 않는다 */
export interface SignupInfo {
  nickname: string
  birthYear: number
}

export function submitSignup(body: SignupInfo, token: string): Promise<null> {
  return apiSend<null>('POST', '/api/v1/users/me/signup-info', body, token)
}

/** 프로필 수정 (AU-08). **출생연도는 잠긴다** */
export interface ProfilePatch {
  nickname?: string
  bio?: string | null
  imageUrl?: string | null
}

export function editProfile(body: ProfilePatch, token: string): Promise<PublicUser | null> {
  return apiSend<PublicUser>('PATCH', '/api/v1/users/me', body, token)
}

/**
 * 내 제재 상태 (AU-12).
 *
 * 화면 전반이 이 값을 본다. 경고는 배너로 두고 쓰기를 열어두지만,
 * 나이 확인 · 정지 · 영구는 쓰기를 막고 안내로 덮는다.
 * `reason` 은 본인에게 그대로 보여준다 (AD-04).
 */
export function getMySanction(token: string): Promise<Sanction | null> {
  return apiGet<Sanction | null>('/api/v1/users/me/sanction', undefined, token)
}
