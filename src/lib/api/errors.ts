import { ApiFailure } from './http'

/**
 * 서버 에러를 화면이 쓸 수 있는 것으로 옮긴다.
 *
 * ─────────────────────────────────────────────────────────
 * **왜 이 파일이 따로 있나.**
 *
 * 에러 처리를 부르는 자리마다 쓰면 같은 코드에 다른 문장이 붙는다.
 * `NICKNAME_DUPLICATED` 가 가입에서는 "이미 쓰고 있는 닉네임이에요",
 * 프로필 수정에서는 "중복된 닉네임입니다" 가 되는 식이다. 사용자는
 * 같은 일을 당했는데 화면마다 다른 말을 듣는다.
 *
 * 한 곳에 모으면 문장이 하나고, 새 코드가 생겼을 때 빠뜨린 자리도
 * 여기만 보면 안다.
 *
 * ─────────────────────────────────────────────────────────
 * **`fieldErrors` 없이 간다.**
 *
 * 백엔드가 응답 봉투를 `{code, message}` 둘로 가기로 했고 (PR #16),
 * 그래도 되는 이유는 **에러 코드가 이미 칸을 특정하기 때문이다.**
 * `UNDER_MINIMUM_AGE` 는 출생연도, `POST_CAPACITY_OUT_OF_RANGE` 는
 * 정원이다. 코드 하나에 칸 하나가 붙으니 따로 알려줄 것이 없다.
 *
 * 그래서 아래 표가 `code → 어느 칸 · 무슨 문장` 을 들고 있다.
 * 계약이 바뀌면 이 표만 고친다.
 *
 * 계약: 위키 02-설계-아키텍처/API-설계.md 4장
 */

/**
 * **`field` 는 계약의 필드 이름이다.** 화면의 변수 이름이 아니다.
 *
 * 서버가 어느 칸을 가리키는지는 계약 어휘로 말하는 것이 맞다. 화면마다
 * 변수 이름이 다르면 그 매핑은 화면이 한다.
 *
 * 지금 갈리는 곳은 가입 화면 하나다 — `nickname` · `birthYear` 를
 * 거기서는 `nick` · `birth` 로 들고 있다. 오류를 키로 모아두는 객체가
 * 없고 변수 둘로 나뉘어 있어 충돌하지 않는다. 모집글 폼은 계약과
 * 같은 이름을 쓴다 (`title` · `content` · `capacity` · `meetAt`).
 */

/** 화면이 오류를 붙일 자리 */
export type ErrorSlot =
  /** 폼의 특정 칸. 그 칸에 빨간 줄이 간다 */
  | { at: 'field'; field: string; text: string }
  /** 칸을 특정할 수 없다. 화면 위쪽 띠로 알린다 */
  | { at: 'banner'; text: string }
  /** 화면을 다시 읽어야 한다. 남이 그 사이에 바꿨다 */
  | { at: 'reload'; text: string }
  /** 로그인이 필요하다 */
  | { at: 'login'; text: string }
  /** 가입 정보를 안 넣었다 */
  | { at: 'signup'; text: string }
  /** 제재 안내 화면으로 덮는다. 사유는 서버 message 를 그대로 쓴다 */
  | { at: 'sanction'; text: string }

type Rule =
  | { field: string; text: string }
  | { at: Exclude<ErrorSlot['at'], 'field' | 'sanction'>; text: string }
  /**
   * 제재만 문장을 표에 두지 않는다. 서버가 보낸 사유를 그대로 쓰기
   * 때문이다 (AD-04 · AU-12). 표에 빈 문자열을 넣어두면 「문구가
   * 없다」 로 읽힌다.
   */
  | { at: 'sanction' }

/**
 * 코드별 처리.
 *
 * **문장을 서버 `message` 로 대체하지 않는다.** 서버 문장은 개발자가
 * 읽는 말이고 여기 있는 것은 사용자가 읽는 말이다. 딱 하나
 * `USER_SANCTIONED` 만 예외인데, 제재 사유는 본인에게 보여주기로
 * 정한 정보라 서버가 보낸 것을 그대로 쓴다 (AD-04 · AU-12).
 */
const RULES: Record<string, Rule> = {
  /* 인증 (AuthErrorCode) */
  INVALID_REFRESH_TOKEN: { at: 'login', text: '다시 로그인해주세요' },
  EXPIRED_ACCESS_TOKEN: { at: 'login', text: '다시 로그인해주세요' },

  /* 회원 (UserErrorCode) */
  NICKNAME_DUPLICATED: { field: 'nickname', text: '이미 쓰고 있는 닉네임이에요' },
  SIGNUP_INFO_REQUIRED: { at: 'signup', text: '닉네임과 출생연도를 먼저 입력해주세요' },
  UNDER_MINIMUM_AGE: { field: 'birthYear', text: '가입할 수 있는 나이가 아니에요' },
  USER_SANCTIONED: { at: 'sanction' },
  USER_NOT_FOUND: { at: 'banner', text: '없는 사용자예요' },

  /* 모집글 (PostErrorCode) */
  POST_NOT_FOUND: { at: 'banner', text: '없는 모집글이에요' },
  POST_ALREADY_CLOSED: { at: 'reload', text: '모집이 끝난 글이에요' },
  POST_NOT_HOST: { at: 'banner', text: '방장만 할 수 있어요' },
  POST_CAPACITY_OUT_OF_RANGE: { field: 'capacity', text: '2명에서 6명까지 모을 수 있어요' },
  MEET_AT_AFTER_EVENT_END: { field: 'meetAt', text: '행사가 끝난 뒤로는 잡을 수 없어요' },

  /* 댓글 (CommentErrorCode) */
  COMMENT_NOT_FOUND: { at: 'reload', text: '이미 지워진 댓글이에요' },
  COMMENT_DEPTH_EXCEEDED: { at: 'banner', text: '답글에는 답글을 달 수 없어요' },
  COMMENT_SECRET_NOT_CHANGEABLE: { at: 'banner', text: '비밀 여부는 나중에 바꿀 수 없어요' },
  COMMENT_NOT_AUTHOR: { at: 'banner', text: '내가 쓴 댓글만 고칠 수 있어요' },

  /* 신고 (ReportErrorCode) */
  REPORT_DUPLICATED: { at: 'banner', text: '이미 신고한 건이에요' },
  INVALID_REPORT_REASON: { field: 'reason', text: '신고 사유를 골라주세요' },

  /* 공통 */
  INVALID_INPUT: { at: 'banner', text: '입력한 내용을 다시 확인해주세요' },
  NETWORK: { at: 'banner', text: '연결이 불안정해요. 잠시 뒤 다시 시도해주세요' },
}

/**
 * 어디에도 안 걸리는 것.
 *
 * **서버 문장을 그대로 띄우지 않는다.** 스택이나 내부 식별자가 섞여
 * 나오면 사용자에게 아무 뜻도 없고, 우리 구조를 그대로 노출한다.
 */
const FALLBACK = '잠시 문제가 생겼어요. 다시 시도해주세요'

export function slotFor(e: unknown): ErrorSlot {
  if (!(e instanceof ApiFailure)) {
    /* fetch 밖에서 난 것. 코드 버그일 가능성이 높다 */
    return { at: 'banner', text: FALLBACK }
  }

  const rule = RULES[e.code]

  if (!rule) {
    /*
     * 모르는 코드다. 서버가 새 코드를 냈거나 우리가 표를 안 고쳤다.
     *
     * 상태 코드로만 갈래를 잡는다. 401 은 로그인, 그 밖은 띠다.
     * **틀린 칸을 짚느니 칸을 안 짚는다** — 엉뚱한 칸에 빨간 줄이
     * 가면 사용자가 멀쩡한 값을 고치게 된다.
     */
    if (e.httpStatus === 401) return { at: 'login', text: '다시 로그인해주세요' }
    return { at: 'banner', text: FALLBACK }
  }

  if ('field' in rule) return { at: 'field', field: rule.field, text: rule.text }

  /* 제재 사유만 서버 문장을 쓴다. 본인에게 보여주기로 정한 값이다 */
  if (rule.at === 'sanction') return { at: 'sanction', text: e.message || '이용이 제한되었어요' }

  return { at: rule.at, text: rule.text }
}

/**
 * 폼이 쓰기 좋은 모양.
 *
 * 칸에 붙는 오류면 `{ 칸이름: 문장 }`, 아니면 `null` 이다. 화면은
 * 이걸 자기 검증 결과와 합쳐 같은 자리에 그린다. 서버가 막은 것과
 * 화면이 막은 것이 다르게 보이면 사용자는 두 번 배워야 한다.
 */
export function fieldErrorOf(e: unknown): Record<string, string> | null {
  const slot = slotFor(e)
  return slot.at === 'field' ? { [slot.field]: slot.text } : null
}

/** 표에 있는 코드인가. 새 코드가 들어왔는지 확인하는 자리 */
export function isKnownCode(code: string): boolean {
  return code in RULES
}
