import type { LastSeen, Sanction } from '@/types'
import { apiGet } from './http'
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
