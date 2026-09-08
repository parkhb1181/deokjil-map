import type { LastSeen, Sanction } from '@/types'
import { apiGet, apiSend } from './http'
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
  nickname: string
  profileImageUrl: string | null
  bio: string | null
  /** 가입 정보를 넣었는가. 안 넣었으면 쓰기가 막힌다 (AU-07) */
  signupCompleted: boolean
  /** 구간 값이다. 원본 시각은 어느 경로로도 안 나온다 (도메인 7.2) */
  lastSeen: LastSeen
  /** `kind` 가 `NONE` 이면 제재가 없다 */
  sanction: Sanction | null
}

export function toMe(raw: unknown): Me {
  if (raw === null || typeof raw !== 'object') fail('me', '객체가 아니다')
  const w = raw as WireMe

  return {
    id: str(w.id, 'id'),
    nickname: str(w.nickname, 'nickname'),
    profileImageUrl: strOrNull(w.profileImageUrl, 'profileImageUrl'),
    bio: strOrNull(w.bio, 'bio'),
    signupCompleted: bool(w.signupCompleted, 'signupCompleted'),
    lastSeen: str(w.lastSeen, 'lastSeen') as LastSeen,
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
