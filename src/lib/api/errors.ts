import { ApiFailure } from './http'

/**
 * 서버 에러를 화면이 쓸 수 있는 것으로 옮긴다.
 *
 * ─────────────────────────────────────────────────────────
 * **왜 이 파일이 따로 있나.**
 *
 * 에러 처리를 부르는 자리마다 쓰면 같은 코드에 다른 문장이 붙는다.
 * `USER_NICKNAME_DUPLICATED` 가 가입에서는 "이미 쓰고 있는 닉네임이에요",
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
 * `USER_UNDER_MINIMUM_AGE` 는 출생연도, `POST_CAPACITY_OUT_OF_RANGE` 는
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
/*
 * 코드 이름은 계약이 정한다 — `{도메인}_{상황}` 대문자 스네이크다
 * (API 컨벤션). 한동안 앞의 도메인을 빼고 `EXPIRED_ACCESS_TOKEN` 처럼
 * 적고 있었다. 서버가 `AUTH_ACCESS_TOKEN_EXPIRED` 를 보내면 이 표가
 * 못 찾아서, 닉네임 중복이 입력칸 밑이 아니라 위쪽 띠로 뜬다.
 * 조용히 어긋나는 종류라 계약 표(API 설계 4장)와 글자를 맞춰 둔다.
 */
const RULES: Record<string, Rule> = {
  /* 인증 (AuthErrorCode) */
  AUTH_REFRESH_TOKEN_INVALID: { at: 'login', text: '다시 로그인해주세요' },
  AUTH_ACCESS_TOKEN_EXPIRED: { at: 'login', text: '다시 로그인해주세요' },
  /*
   * 카카오 교환 단계 (STAR-50). 둘을 가르는 이유는 실패 자리가 달라서다.
   * 인가코드는 일회용이라 CODE_INVALID 는 같은 코드로 다시 보내봐야
   * 소용없고 카카오 인가부터 다시 받아야 한다. UNAVAILABLE 은 인가코드가
   * 멀쩡한데 카카오가 느리거나 죽은 것이라 잠시 뒤 그대로 다시 하면 된다.
   * 「다시 로그인」 으로 뭉뚱그리면 후자에서 거짓 안내가 된다.
   */
  AUTH_KAKAO_CODE_INVALID: { at: 'login', text: '카카오 로그인이 안 됐어요. 다시 시도해주세요' },
  AUTH_KAKAO_UNAVAILABLE: { at: 'banner', text: '카카오 쪽이 느려요. 잠시 뒤 다시 시도해주세요' },
  /*
   * 만료와 갈라져 있다. 만료는 재발급으로 살아나는데 이쪽은 서명이
   * 깨졌거나 로그아웃으로 무효가 된 토큰이라 다시 받아야 한다.
   * 화면이 할 일은 같아서 문장도 같다 — 갈리는 것은 재발급을 시도할지다.
   */
  AUTH_ACCESS_TOKEN_INVALID: { at: 'login', text: '다시 로그인해주세요' },
  /*
   * 관문이 등급으로 막은 것이다 (SecurityConfig). 어느 자원인지 모르는
   * 자리라 도메인별 403(POST_NOT_HOST 등)보다 뭉뚱그린 문장이 된다.
   */
  AUTH_FORBIDDEN: { at: 'banner', text: '이 작업을 할 수 있는 권한이 없어요' },

  /* 회원 (UserErrorCode) */
  USER_NICKNAME_DUPLICATED: { field: 'nickname', text: '이미 쓰고 있는 닉네임이에요' },
  USER_SIGNUP_INFO_REQUIRED: { at: 'signup', text: '닉네임과 출생연도를 먼저 입력해주세요' },
  /* 가입 정보를 두 번 넣으려 할 때. 출생연도가 잠겨 있다 (AU-08) */
  USER_SIGNUP_INFO_ALREADY_SET: { at: 'reload', text: '이미 입력한 가입 정보예요' },
  USER_UNDER_MINIMUM_AGE: { field: 'birthYear', text: '가입할 수 있는 나이가 아니에요' },
  USER_SANCTIONED: { at: 'sanction' },
  USER_NOT_FOUND: { at: 'banner', text: '없는 사용자예요' },
  /*
   * 프로필 이미지 (AU-08). 셋 다 띠로 보낸다.
   *
   * 형식·크기는 성격상 사진 칸에 붙는 것이 맞지만, **사진에는 Field 가
   * 없다.** 아바타를 누르면 열리는 file input 하나뿐이라 field 를 지정해도
   * 그릴 자리가 없다. 없는 칸을 짚느니 띠로 보낸다 — slotFor 가 모르는
   * 코드를 다루는 것과 같은 판단이다.
   *
   * 업로드 화면이 붙으면서 사진 아래에 문장 자리를 만들면 앞의 둘을
   * field 로 옮긴다. 그때 이름은 계약을 따라 contentType · contentLength 다.
   *
   * 문장에 허용값을 그대로 적는다. "형식이 올바르지 않아요" 로는 무엇을
   * 다시 고르라는 것인지 알 수 없다.
   */
  USER_PROFILE_IMAGE_TYPE_NOT_ALLOWED: {
    at: 'banner',
    text: 'JPG · PNG · WEBP 만 올릴 수 있어요',
  },
  USER_PROFILE_IMAGE_TOO_LARGE: { at: 'banner', text: '사진은 5MB 까지 올릴 수 있어요' },
  /*
   * 확정(③)을 불렀는데 S3 에 그 객체가 없다. 서명이 만료됐거나(300초)
   * 업로드가 중간에 끊긴 것이라 **다시 고르면 된다.** 사용자가 뭘 잘못한
   * 것이 아니므로 그렇게 읽히지 않게 적는다
   */
  USER_PROFILE_IMAGE_NOT_UPLOADED: {
    at: 'banner',
    text: '사진이 다 올라가지 않았어요. 다시 골라주세요',
  },
  /*
   * **아래 둘은 서버가 낸 코드가 아니라 우리가 만든 것이다.**
   *
   * 사진 올리기의 두 번째 단계는 우리 서버가 아니라 S3 를 직접 부른다.
   * 거기서 실패하면 XML 이 오거나 아예 응답이 없어서 우리 에러 모양이
   * 아니고, 그대로 두면 화면이 「잠시 문제가 생겼어요」 로 뭉갠다.
   * `users.ts` 가 우리 실패로 바꿔 던지고 여기서 문구를 준다.
   *
   * BLOCKED 쪽이 특히 중요하다. **버킷 CORS 에 지금 주소가 없을 때**가
   * 그것인데, ①③ 은 200 이라 서버 로그에는 아무 일도 안 남는다. 프리뷰
   * 배포에서 이것부터 의심해야 한다.
   */
  PROFILE_IMAGE_UPLOAD_BLOCKED: {
    at: 'banner',
    text: '사진을 올리지 못했어요. 잠시 뒤 다시 시도해주세요',
  },
  PROFILE_IMAGE_UPLOAD_FAILED: {
    at: 'banner',
    text: '사진을 올리지 못했어요. 다시 골라주세요',
  },
  /**
   * 브라우저가 그 사진을 못 읽었다. 올리기 전에 512px jpeg 로 줄이는
   * 단계에서 난다 (`image-shrink.ts`).
   *
   * 안드로이드 크롬이 HEIC 을 디코딩 못 하는 조합이 대표적이다. 무엇을
   * 어떻게 하라고까지 말한다 — 「사진을 못 읽었어요」 만 쓰면 같은 사진을
   * 다시 고르게 된다.
   */
  PROFILE_IMAGE_UNREADABLE: {
    at: 'banner',
    text: '이 사진은 읽을 수 없어요. JPG 나 PNG 로 저장해서 올려주세요',
  },

  /* 행사 (EventErrorCode) */
  EVENT_NOT_FOUND: { at: 'banner', text: '없는 행사예요' },

  /* 모집글 (PostErrorCode) */
  POST_NOT_FOUND: { at: 'banner', text: '없는 모집글이에요' },
  POST_ALREADY_CLOSED: { at: 'reload', text: '모집이 끝난 글이에요' },
  POST_NOT_HOST: { at: 'banner', text: '방장만 할 수 있어요' },
  POST_CAPACITY_OUT_OF_RANGE: { field: 'capacity', text: '2명에서 6명까지 모을 수 있어요' },
  POST_MEET_AT_AFTER_EVENT_END: { field: 'meetAt', text: '행사가 끝난 뒤로는 잡을 수 없어요' },

  /* 댓글 (CommentErrorCode) */
  COMMENT_NOT_FOUND: { at: 'reload', text: '이미 지워진 댓글이에요' },
  COMMENT_DEPTH_EXCEEDED: { at: 'banner', text: '답글에는 답글을 달 수 없어요' },
  COMMENT_SECRET_NOT_CHANGEABLE: { at: 'banner', text: '비밀 여부는 나중에 바꿀 수 없어요' },
  COMMENT_NOT_AUTHOR: { at: 'banner', text: '내가 쓴 댓글만 고칠 수 있어요' },
  /* 삭제는 작성자 또는 방장이 한다 (CM-10). 그래서 이름과 문장이 따로다 */
  COMMENT_NOT_AUTHOR_OR_HOST: {
    at: 'banner',
    text: '내가 쓴 댓글이거나 내 모집글의 댓글만 지울 수 있어요',
  },

  /* 신고 (ReportErrorCode) */
  REPORT_DUPLICATED: { at: 'banner', text: '이미 신고한 건이에요' },
  REPORT_REASON_INVALID: { field: 'reason', text: '신고 사유를 골라주세요' },
  /* 백오피스에서 이미 종결한 신고를 다시 처리하려 할 때 (AD-03) */
  REPORT_ALREADY_HANDLED: { at: 'reload', text: '이미 처리된 신고예요' },
  REPORT_NOT_FOUND: { at: 'reload', text: '없는 신고예요' },
  /*
   * 허용하지 않는 전이다 — 「처리 중」 을 「미처리」 로 되돌리는 것이
   * 여기 걸린다. 종결이 종착이라 되돌리는 길을 안 열었다.
   */
  REPORT_TRANSITION_NOT_ALLOWED: { at: 'reload', text: '지금 상태에서는 할 수 없는 처리예요' },

  /*
   * 제재 (SanctionErrorCode).
   *
   * **운영자만 본다.** 그래서 문장이 다른 것들과 결이 다르다 — 사용자에게는
   * 무슨 일인지 부드럽게 말하지만, 운영자에게는 무엇이 막혔는지 그대로
   * 말하는 편이 다음 행동이 빠르다.
   *
   * 여기 없으면 전부 「잠시 문제가 생겼어요」 로 뭉개진다. 제재를 두 번
   * 주려다 그 문구를 받고 계속 다시 누르는 것을 실제로 봤다.
   */
  SANCTION_ALREADY_ACTIVE: { at: 'banner', text: '이미 제재 중인 회원이에요' },
  SANCTION_ALREADY_RELEASED: { at: 'reload', text: '이미 풀린 제재예요' },
  SANCTION_NOT_FOUND: { at: 'reload', text: '없는 제재예요' },
  SANCTION_REASON_REQUIRED: { field: 'reason', text: '사유를 적어주세요' },
  /* 기간 정지인데 종료 시각이 없거나, 아닌데 있을 때 */
  SANCTION_UNTIL_MISMATCH: { at: 'banner', text: '기간 정지는 종료 시각이 있어야 해요' },

  /* ── 알림 (NT-09). 남의 것과 없는 것이 같은 404 다 — 배치가 지웠을 수도 있다 */
  NOTIFICATION_NOT_FOUND: { at: 'reload', text: '이미 사라진 알림이에요' },

  /* 지워졌거나 가려진 댓글이다. 고치거나 답글을 달 수 없다 */
  COMMENT_NOT_ACTIVE: { at: 'reload', text: '이미 지워졌거나 가려진 댓글이에요' },

  /* 공통 (CommonErrorCode) */
  INVALID_INPUT: { at: 'banner', text: '입력한 내용을 다시 확인해주세요' },
  /*
   * 아래 둘은 사용자가 고칠 것이 없는 우리 잘못이다. 무엇이 잘못됐는지
   * 설명해봐야 할 수 있는 것이 없으므로 「다시 해보세요」 로 끝낸다.
   */
  ENDPOINT_NOT_FOUND: { at: 'banner', text: '잠시 문제가 생겼어요. 다시 시도해주세요' },
  INTERNAL_ERROR: { at: 'banner', text: '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해주세요' },
  NETWORK: { at: 'banner', text: '연결이 불안정해요. 잠시 뒤 다시 시도해주세요' },
  /*
   * 서버 주소가 안 채워졌다. 개발 중에만 나오고 배포에서는 안 나온다.
   * 「연결이 불안정해요」 로 뭉뚱그리면 무엇이 문제인지 알 수 없어
   * 네트워크를 의심하며 시간을 쓴다.
   */
  NO_API_BASE: { at: 'banner', text: '서버가 아직 연결되지 않았어요' },
  /*
   * 서버가 보낸 것이 아니라 우리가 먼저 끊은 것이다 (`lib/auth/authed.ts`).
   * 토큰이 아예 없는데 쓰기를 눌렀다. 만료(`AUTH_ACCESS_TOKEN_EXPIRED`)와
   * 문구가 갈린다 — 한 번도 로그인 안 한 사람에게 「다시 로그인」 은
   * 없던 로그인을 되찾으라는 말로 들린다.
   */
  NOT_SIGNED_IN: { at: 'login', text: '로그인이 필요해요' },
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
