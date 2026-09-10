import type { LastSeen, Sanction } from '@/types'
import { ApiFailure, apiGet, apiSend } from './http'
import { contractError, guards, type Guards } from './wire'

/**
 * 회원 (API 설계 2-2).
 *
 * ─────────────────────────────────────────────────────────
 * **`/users/me` 는 한동안 매퍼 없이 캐스팅으로 받고 있었다.**
 *
 * 서버는 `id` 를 숫자로 준다. 그런데 `Viewer.userId` 는 `string | null`
 * 이고 `PostAuthor.id` 도 문자열이라, 캐스팅으로 받으면 숫자 1 이 그대로
 * 화면까지 흘러가 `viewer.userId === hostId` 가 항상 false 가 된다.
 * 컴파일도 통과하고 에러도 안 나서 「방장인데 버튼이 안 보인다」 로만
 * 드러난다. 2026-09-08 로컬 연동 시험에서 잡았다.
 *
 * 경계에서 문자열로 맞춘다. 이유는 `wire.ts` 에 적혀 있다.
 */

const SUBJECT = '회원'
const HINT = '위키 02-설계-아키텍처/API-설계.md 의 「2-2. 회원 (Identity)」 를 보고 맞춘다.'

/* 함수 선언이라야 never 가 흐름 분석에 쓰인다 (wire.ts) */
function fail(field: string, why: string): never {
  throw contractError(SUBJECT, HINT, field, why)
}

const { str, bool, strOrNull }: Guards = guards(SUBJECT, HINT)

/** 서버가 주는 그대로 */
interface WireMe {
  id?: unknown
  nickname?: unknown
  profileImageUrl?: unknown
  bio?: unknown
  signupCompleted?: unknown
  lastSeen?: unknown
  sanction?: unknown
}

/**
 * 내 정보.
 *
 * **관리자 여부가 없다.** 서버 응답에 그런 칸이 없고 계약에도 없다
 * (API 설계 2-2 의 응답 목록). 한때 `role?: 'USER' | 'ADMIN'` 을
 * 기대하고 있었는데 서버는 admin 토큰으로 불러도 같은 몸을 준다.
 *
 * **백오피스는 관리자 API 의 응답으로 판정한다.** `/api/v1/admin/**` 이
 * 403 이면 관리자가 아니다. 판정자가 서버 하나로 남아 ADR 0003 의
 * 「인가는 AdminAccount」 와 어긋나지 않고, 같은 사실을 두 곳에서
 * 관리하지 않게 된다.
 */
export interface Me {
  id: string
  /**
   * **가입을 마치기 전에는 없다.** 카카오로 로그인만 하고 닉네임을 아직
   * 안 정한 계정이 그렇다. `signupCompleted` 가 거짓인 동안만 비어 있다.
   */
  nickname: string | null
  profileImageUrl: string | null
  bio: string | null
  /** 가입 정보를 넣었는가. 안 넣었으면 쓰기가 막힌다 (AU-07) */
  signupCompleted: boolean
  /**
   * 구간 값이다. 원본 시각은 어느 경로로도 안 나온다 (도메인 7.2).
   *
   * **null 이 온다.** 접속이 관측된 적 없는 계정 — 로그인하고 토큰을 아직
   * 한 번도 재발급하지 않은 사람이다 (AU-03 이 재발급 시점에만 갱신한다).
   * 없는 것을 `LONG_AGO` 로 적으면 방금 가입한 사람이 한 달째 잠수한
   * 것으로 보이므로 서버가 일부러 비워 보낸다.
   */
  lastSeen: LastSeen | null
  /** `kind` 가 `NONE` 이면 제재가 없다 */
  sanction: Sanction | null
}

export function toMe(raw: unknown): Me {
  if (raw === null || typeof raw !== 'object') fail('me', '객체가 아니다')
  const w = raw as WireMe

  return {
    id: str(w.id, 'id'),
    /*
     * **둘 다 null 을 받는다.** 한동안 `str` 로 받고 있었는데, 그러면
     * 가입을 안 끝낸 계정과 접속이 관측된 적 없는 계정에서 예외가 난다.
     * 그 예외는 화면에 「불러오지 못했어요」 로 뜨는 것이 아니라 —
     * `useViewer` 가 실패를 비회원으로 떨어뜨리므로 — **로그인한 사람이
     * 모든 화면에서 비회원으로 보이는** 모양이 된다. 원인이 안 보인다.
     */
    nickname: strOrNull(w.nickname, 'nickname'),
    profileImageUrl: strOrNull(w.profileImageUrl, 'profileImageUrl'),
    bio: strOrNull(w.bio, 'bio'),
    signupCompleted: bool(w.signupCompleted, 'signupCompleted'),
    lastSeen: strOrNull(w.lastSeen, 'lastSeen') as LastSeen | null,
    /*
     * 제재는 모양을 그대로 받는다. 화면이 `kind` 로만 갈리고 나머지
     * 칸은 문구에 실어 보여주기만 한다. NONE 도 객체로 오므로 그대로
     * 둔다 — 없는 것과 「없다고 적힌 것」 을 화면이 같게 취급한다.
     */
    sanction: (w.sanction as Sanction | null) ?? null,
  }
}

/** 내 정보 한 건. 토큰이 필요하다 (AU-12) */
export async function fetchMe(token: string): Promise<Me> {
  return toMe(await apiGet<unknown>('/api/v1/users/me', undefined, token))
}

/* ── 가입 ────────────────────────────────────────────────── */

/**
 * 닉네임을 쓸 수 있나 (AU-06).
 *
 * **확정이 아니다.** 확인과 저장 사이에 남이 같은 이름을 채 갈 수 있다.
 * 최종 판정은 저장 시점의 유니크 제약이고, 걸리면 409 다 (I-01).
 * 그래서 이 결과를 믿고 저장을 건너뛰면 안 된다 — 화면이 미리 알려주는
 * 편의일 뿐이다.
 */
export async function checkNickname(nickname: string, token: string): Promise<boolean> {
  const r = await apiGet<{ available?: unknown }>(
    '/api/v1/users/nickname-availability',
    { nickname },
    /*
     * **토큰이 필요하다.** 공개 조회처럼 보이지만 `SecurityConfig` 가
     * `AUTH` 등급으로 묶어 두었다 (`/users/me` 와 같은 줄). 로그인 뒤
     * 가입 정보를 채우는 화면에서만 쓰이므로 그 편이 맞다 — 익명이
     * 회원 닉네임을 마음껏 캐물을 이유가 없다.
     *
     * 한동안 토큰 없이 불러 401 을 받았다. 화면에는 「다시 로그인해주세요」
     * 가 떠서, 방금 로그인한 사람이 확인 버튼만 누르면 로그인을 다시
     * 하라는 말을 들었다.
     */
    token,
  )
  return bool(r?.available, 'available')
}

/**
 * 가입 정보 입력 (AU-05).
 *
 * **한 번만 통한다.** 이미 넣은 사람이 다시 부르면 409 다 — 출생연도가
 * 가입 후 잠기기 때문이다 (AU-08).
 *
 * **연령대가 아니라 출생연도를 보낸다** (I-15). 판정은 서버가 한다.
 * 화면 검증만으로는 API 직접 호출을 막지 못한다.
 *
 * 응답 본문이 없다. **끝나면 토큰을 새로 받아야 쓰기가 열린다** —
 * 지금 들고 있는 액세스 토큰에는 `signupCompleted: false` 가 박혀 있어서,
 * 그대로 쓰면 서버 관문이 계속 403 을 준다 (AU-07).
 */
export async function completeSignup(
  body: { nickname: string; birthYear: number },
  token: string,
): Promise<void> {
  await apiSend<unknown>('PUT', '/api/v1/users/me/signup-info', body, token)
}

/* ── 프로필 ──────────────────────────────────────────────── */

/**
 * 남의 프로필 (AU-09).
 *
 * **비회원도 부를 수 있다.** 만나기 전에 상대를 확인하는 화면이라 로그인을
 * 요구하면 그 확인이 막힌다. 그래서 토큰을 받지 않는다.
 *
 * **모집글은 안 들어 있다.** 계약이 「건수가 늘면 프로필 조회가 같이
 * 무거워진다」 로 갈라 놨다. 글은 `fetchUserPosts` 가 따로 받는다.
 *
 * 탈퇴했거나 가입을 마치지 않은 회원이면 404 다.
 */
export interface PublicProfile {
  id: string
  nickname: string
  profileImageUrl: string | null
  bio: string | null
  /** `Me.lastSeen` 과 같은 이유로 null 이 온다 */
  lastSeen: LastSeen | null
}

export function toPublicProfile(raw: unknown): PublicProfile {
  if (raw === null || typeof raw !== 'object') fail('user', '객체가 아니다')
  const w = raw as Record<string, unknown>

  return {
    id: str(w.id, 'id'),
    /* 여기서는 닉네임이 늘 있다. 가입 미완료 회원은 404 라 응답이 없다 */
    nickname: str(w.nickname, 'nickname'),
    profileImageUrl: strOrNull(w.profileImageUrl, 'profileImageUrl'),
    bio: strOrNull(w.bio, 'bio'),
    lastSeen: strOrNull(w.lastSeen, 'lastSeen') as LastSeen | null,
  }
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile> {
  return toPublicProfile(await apiGet<unknown>(`/api/v1/users/${encodeURIComponent(userId)}`))
}

/**
 * 프로필 수정 (AU-08).
 *
 * ─────────────────────────────────────────────────────────
 * **여기는 진짜 부분 수정이다.**
 *
 * 모집글 수정(`updatePost`)이 `PATCH` 인데도 전체 본문을 요구해서 한 번
 * 데였는데, 이쪽은 이름 그대로 동작한다 — 안 보낸 칸은 안 바뀐다. 그래서
 * 타입도 `Partial` 로 둔다. 두 경로가 다르게 구는 것이라 각자 적어 둔다.
 *
 * **비우는 것과 안 보내는 것이 다르다.** `bio: ''` 는 한줄소개를 지우고,
 * `bio` 를 아예 안 보내면 그대로 둔다. 닉네임은 안 보낼 수는 있어도 빈
 * 문자열로 비울 수는 없다 — 이름 없는 회원이 생기기 때문이다.
 *
 * **사진과 출생연도는 여기서 못 바꾼다.** 사진은 업로드 경로가 따로 있고
 * (AU-08 의 S3 3단계), 출생연도는 가입 때 잠긴다 (AU-08). 계약에 칸 자체가
 * 없다 — 있으면 언젠가 열릴 것처럼 보인다.
 *
 * 응답 본문이 없다. 바뀐 값은 `/users/me` 로 다시 읽는다.
 */
export interface ProfileEdit {
  nickname?: string
  bio?: string
}

export async function updateProfile(body: ProfileEdit, token: string): Promise<void> {
  await apiSend<unknown>('PATCH', '/api/v1/users/me/profile', body, token)
}

/* ── 프로필 사진 (AU-08) ─────────────────────────────────── */

/**
 * 사진 올릴 자리를 받는다.
 *
 * ─────────────────────────────────────────────────────────
 * **세 번 부르고 가운데는 우리 서버가 아니다.**
 *
 *   ① 우리 서버에 「이런 파일을 올리겠다」 → 서명된 주소를 받는다
 *   ② 그 주소로 **S3 에 직접** 올린다. 우리 서버를 거치지 않는다
 *   ③ 우리 서버에 「다 올렸다」 → 서버가 실물을 확인하고 반영한다
 *
 * 바이트가 서버를 지나지 않게 하려고 이렇게 됐다. EC2 가 한 대라
 * 5MB 짜리가 흐르는 동안 이미지와 무관한 요청까지 느려진다.
 *
 * **③ 이 없으면 안 된다.** ① 은 클라이언트가 하는 「말」 이라 그것만
 * 믿으면 5MB 상한이 장식이 된다. 서버가 ③ 에서 실물을 다시 잰다.
 *
 * ① 만 받고 안 올려도 서버 상태는 안 변한다. 취소를 따로 부를 필요가 없다.
 */
export interface ImageSlot {
  uploadUrl: string
  objectKey: string
  /** 서명 수명. 300초다 */
  expiresInSeconds: number
}

export async function requestImageUpload(
  file: { type: string; size: number },
  token: string,
): Promise<ImageSlot> {
  const r = await apiSend<Record<string, unknown>>(
    'POST',
    '/api/v1/users/me/profile-image',
    { contentType: file.type, contentLength: file.size },
    token,
  )
  return {
    uploadUrl: str(r?.uploadUrl, 'uploadUrl'),
    objectKey: str(r?.objectKey, 'objectKey'),
    /* 숫자로 온다. 화면이 안 쓰지만 계약을 눈에 보이게 둔다 */
    expiresInSeconds: Number(r?.expiresInSeconds ?? 0),
  }
}

/**
 * S3 에 직접 올린다.
 *
 * **`apiSend` 를 안 쓴다.** 우리 서버가 아니라서 그렇다. 두 가지가 다르다.
 *
 * - **`Authorization` 을 붙이지 않는다.** 서명이 이미 주소의 쿼리에
 *   들어 있고, 헤더를 같이 보내면 S3 가 거부한다
 * - **`Content-Type` 이 서명에 포함된다.** ① 에서 말한 값과 한 글자라도
 *   다르면 `403 SignatureDoesNotMatch` 다
 *
 * 실패하면 S3 가 XML 을 돌려준다. 우리 에러 모양이 아니라 화면이 못 읽으므로
 * 여기서 우리 실패로 바꾼다.
 */
export async function putToStorage(uploadUrl: string, file: File): Promise<void> {
  let res: Response
  try {
    res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
      /*
       * **끊는 시각이 있어야 한다.** 우리 서버가 아니라 S3 로 직접
       * 보내는 요청이라 `apiSend` 의 타임아웃(http.ts)이 안 걸린다.
       *
       * 없으면 지하철에서 한 번 멈춘 요청이 영원히 안 끝나고, 화면은
       * 「사진을 올리는 중이에요」 에 걸린 채로 남는다. 더 나쁜 것은
       * 그 뒤다 — 올리는 중이면 다음 선택을 무시하도록 되어 있어서,
       * 사진을 다시 골라도 아무 일이 안 일어난다 (2026-09-10 신고).
       */
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    /*
     * 여기서 걸리면 대개 **버킷 CORS 에 이 주소가 없다.** ①③ 은 200 인데
     * ② 만 브라우저가 막는 모양이라, 서버 로그를 봐도 아무 일이 없다.
     */
    throw new ApiFailure(
      'PROFILE_IMAGE_UPLOAD_BLOCKED',
      '사진을 올리지 못했어요. 잠시 뒤 다시 시도해주세요',
      0,
    )
  }
  if (!res.ok) {
    throw new ApiFailure(
      'PROFILE_IMAGE_UPLOAD_FAILED',
      '사진을 올리지 못했어요. 다시 골라주세요',
      res.status,
    )
  }
}

/**
 * 다 올렸다고 알린다. 서버가 실물을 확인하고 프로필에 반영한다.
 *
 * 응답 본문이 없다. **바뀐 주소는 `/users/me` 로 다시 읽는다** — 여기서
 * 주소를 돌려주지 않는 것은, 확정 요청이 주소를 받으면 클라이언트가 임의
 * URL 을 박을 수 있게 되기 때문이다 (결정 D-2).
 */
export async function confirmImageUpload(objectKey: string, token: string): Promise<void> {
  await apiSend<unknown>('PUT', '/api/v1/users/me/profile-image', { objectKey }, token)
}

/**
 * 세 단계를 한 번에.
 *
 * 화면이 셋을 각자 부르면 순서와 실패 처리가 화면마다 갈린다. 특히 ②가
 * 실패했을 때 ③을 부르면 안 된다는 것을 매번 기억해야 한다.
 */
export async function uploadProfileImage(file: File, token: string): Promise<void> {
  const slot = await requestImageUpload(file, token)
  await putToStorage(slot.uploadUrl, file)
  await confirmImageUpload(slot.objectKey, token)
}
