/**
 * poc-plan.md 5.1 스키마를 그대로 옮긴 타입.
 *
 * 필드명·값 집합을 전체 구상(bridge-plan-full.md 7번)의 Postgres 스키마와 일치시킨다.
 * PoC에서 안 쓰는 필드(trust, subjectType)도 남기는 이유는,
 * 승격 시 매핑 없이 그대로 넘기기 위함이다.
 */

/** 구역. 커버 범위가 늘면 여기에 추가한다 */
export type District =
  // 세부 구역, 팬덤 동선의 단위라 구(區)보다 앞선다
  | 'hongdae'   // 홍대
  | 'hapjeong'  // 합정
  | 'seongsu'   // 성수
  | 'gangnam'   // 강남
  | 'konkuk'    // 건대
  // 구 단위, 세부 구역에 안 걸리는 나머지를 담는다
  | 'yongsan'   // 용산 (아이파크몰 등)
  | 'jamsil'    // 잠실 (롯데월드몰 등)
  | 'yeouido'   // 여의도 (더현대 서울 등)
  | 'jongno'    // 종로
  | 'myeongdong' // 명동 · 중구
  | 'etc'       // 그 외 서울

export type PlaceKind = 'cafe' | 'popup_venue'

/** 생카는 이미 버추얼·애니 캐릭터·배우로 확장됐다. 아이돌에 묶지 않는다 */
export type SubjectType = 'idol' | 'virtual' | 'character' | 'actor'

export type EventKind = 'birthday_cafe' | 'popup' | 'concert'

/**
 * 데이터 출처 등급.
 * official  기획사·유통사 공식 채널
 * partner   제휴 카페·주최자 직접 등록
 * user      사용자 제보
 * parsed    안내 이미지·텍스트 자동 파싱
 */
export type Trust = 'official' | 'partner' | 'user' | 'parsed'

export interface Place {
  name: string
  address: string
  lat: number
  lng: number
  district: District
  kind: PlaceKind
}

/** 팝업 굿즈 품목 마스터. 생카는 빈 배열 */
export interface Goods {
  id: string
  name: string
  /** 랜덤 품목은 "품절" 개념이 아니라 "지금 뭐가 나오나"가 관심사다 */
  isRandom: boolean
  sortOrder: number
}

export interface EventItem {
  id: string
  place: Place
  /** 아이돌·버추얼·캐릭터·배우. 화이트리스트를 두지 않는다 */
  subject: string
  subjectType: SubjectType
  kind: EventKind
  /** YYYY-MM-DD. 사전순 비교가 곧 날짜 비교가 된다 */
  startsOn: string
  endsOn: string
  /**
   * 운영 시간. '12:00~20:00' 처럼 이미 다듬은 문자열이다.
   * 생카·팝업은 기간 안에서 매일 같은 시간에 연다.
   */
  openHours?: string
  /**
   * 공연 시작 시각 'HH:mm'. **콘서트만 갖는다.**
   *
   * 생카·팝업은 기간 중 아무 때나 가면 되지만 콘서트는 그 시각에
   * 못 가면 끝이다. openHours 로 대신할 수 없다. 저건 "언제부터
   * 언제까지 열려 있나" 고 이건 "몇 시에 시작하나" 다.
   *
   * 콘서트는 startsOn 과 endsOn 이 같은 날이다.
   */
  startsAt?: string
  /** 선착 n명, 컵홀더 등 */
  perks?: string
  /** 음료 1잔 주문 등 */
  conditions?: string
  /**
   * 원제. subject 가 아티스트명으로 정규화되므로 원래 행사명을 따로 남긴다.
   * (예: subject "키스오브라이프" / title "아임도넛 X 키스오브라이프 팝업 @홍대")
   */
  title?: string
  /**
   * 대표 이미지. 주최자·운영사가 공개한 안내 이미지의 URL.
   * 없거나 로드에 실패하면 대상명 기반 색 블록으로 폴백한다(EventCard 참조).
   * 원문 링크(sourceUrl)를 항상 함께 노출해 출처를 밝힌다.
   */
  imageUrl?: string
  /**
   * 원문 링크. 출처 표기 필수, 화면에서 반드시 노출한다.
   * 가능하면 주최자·운영사의 공식 게시물을 가리킨다.
   */
  sourceUrl: string
  /** 리스팅 출처. sourceUrl 이 공식 원문일 때 우리가 참고한 곳을 함께 밝힌다 */
  listingUrl?: string
  /** 사전예약 링크 */
  reservationUrl?: string
  trust: Trust
  goods: Goods[]
}

/* ── 동행 모집 ─────────────────────────────────────────────

   **여기부터는 camelCase 다.** 위쪽 EventItem 은 snake_case 인데
   일부러 갈라두었다.

   EventItem 은 크롤러가 찍어내는 값이고 bridge-plan-full 7번의
   Postgres 컬럼명에 맞춰둔 것이라(파일 머리말) 프론트가 혼자 못 바꾼다.
   반면 아래 타입들은 아직 API 가 없어 우리가 이름을 정한다.
   도메인 모델링 문서가 meetAt · parentId 로 적고 있어 그쪽에 맞춘다.

   경계는 「밖에서 들어온 것」 대 「우리가 만든 계약」 이다.
   ─────────────────────────────────────────────────────────
   1차 MVP. 아직 API 가 없어 화면이 목데이터를 읽지만, 이 타입이
   그대로 백엔드에 넘길 응답 명세다. 필드를 늘리거나 이름을 바꾸면
   양쪽이 어긋나므로 여기를 먼저 고치고 넘긴다.
   ------------------------------------------------------- */

/**
 * 모집글 상태.
 *
 *   OPEN      모집중
 *   CLOSED    닫혔다. 왜 닫혔는지는 closedReason 이 말한다
 *   CANCELED  방장이 취소했다. 사유가 필수다
 *
 * **끝난 까닭을 상태가 아니라 closedReason 으로 나눈다.** 한때
 * done · ended 두 상태로 두었는데, 그러면 닫히는 경로가 늘 때마다
 * 상태가 하나씩 늘어난다. 상태는 "무엇을 할 수 있나" 를 정하고,
 * 까닭은 "왜 그렇게 됐나" 를 말한다. 둘은 다른 축이다.
 *
 * CLOSED 와 CANCELED 는 종착이다. 재개방은 없고 취소는 되돌릴 수 없다.
 */
export type PostState = 'OPEN' | 'CLOSED' | 'CANCELED'

/**
 * 닫힌 까닭. CLOSED 일 때만 있다.
 *
 *   MANUAL    방장이 「모집 완료」 를 눌렀다
 *   DEADLINE  마감 시각이 지나 배치가 닫았다
 *
 * DEADLINE 은 서버가 판정한다. 화면이 판정하지 않는다. 기기 시계가
 * 제각각이고, 누가 열어봐야만 상태가 바뀌는 구조가 된다.
 */
export type ClosedReason = 'MANUAL' | 'DEADLINE'

/**
 * 더 못 들어가는 글인가.
 *
 * 화면 대부분은 왜 닫혔는지를 구분할 필요가 없다. 회색으로 눌러
 * 목록에서 지나치게 하면 되고, 구분이 필요한 자리는 배지 글자와
 * 안내 문구뿐이다. 자리마다 조건을 적으면 상태가 하나 더 늘 때
 * 고칠 곳을 반드시 빠뜨린다.
 */
export function isClosed(state: PostState): boolean {
  return state !== 'OPEN'
}

export interface PostAuthor {
  id: string
  nickname: string
  imageUrl?: string | null
  /** 완료한 동행 횟수. 처음이면 0 */
  doneCount?: number
}

/**
 * 만남 지점. 도메인 문서의 `MeetPoint` 값 객체다.
 *
 * 세 필드를 흩어 두었더니(meet_place · meet_lat · meet_lng) 셋이 한
 * 덩어리라는 것이 타입에 안 보였다. 좌표만 있고 이름이 없는 상태가
 * 성립하는 것처럼 읽힌다.
 *
 * **글과 핀을 둘 다 받는다.** 글은 "성수역 3번 출구" 고 핀은 "여기
 * 어디쯤" 이다. 핀만 있으면 도착해서도 서로 못 찾고, 글만 있으면
 * 처음 가는 동네에서 그게 어디인지 모른다.
 *
 * 핀은 선택이다. 안 찍으면 서버가 place 를 지오코딩해 좌표를 채운다.
 * 지오코딩도 실패하면 좌표가 없고 그때는 지도를 안 그린다.
 */
export interface MeetPoint {
  /** 글쓴이가 적은 장소. 이 값은 늘 있다 */
  place: string
  lat?: number | null
  lng?: number | null
}

export interface CompanionPost {
  id: string
  /** 이벤트에 붙지 않은 글도 있다 */
  eventId: string | null
  eventTitle?: string | null
  /**
   * 붙은 이벤트의 대표 이미지. 우리가 복제해 두는 것이 아니라
   * 원본 서버 주소를 그대로 들고 있는다. 포스터는 저작물이라
   * 재게시하지 않는다 (CLAUDE.md).
   */
  eventImageUrl?: string | null
  title: string
  body: string
  state: PostState
  /** CLOSED 일 때만 온다. 왜 닫혔는지 */
  closedReason?: ClosedReason | null
  /** CANCELED 일 때만 온다. 방장이 적는다. 사유는 필수다 */
  cancelReason?: string | null
  /** 방장 포함 인원. 표시만 하고 자동 마감은 없다 */
  capacity: number | null
  /** 'YYYY-MM-DDTHH:mm'. Date 로 왕복하지 않는다 */
  meetAt: string
  meetPoint: MeetPoint
  closesAt: string
  createdAt: string
  author: PostAuthor
  commentCount: number
}

/**
 * 댓글.
 *
 * 채팅이 없어 사람 구하는 일이 전부 여기서 일어난다. 비밀 댓글이
 * 연락처를 주고받는 유일한 통로다.
 */
export interface PostComment {
  id: string
  /**
   * 대댓글의 부모. **깊이는 1단계로 고정이라 이 아래는 없다.**
   *
   * 회의에서 뎁스 무제한 얘기가 나왔는데 1차는 1단계다. 무제한이
   * 되면 비밀 댓글 권한이 재귀가 된다. 「부모 댓글 작성자가 본다」가
   * 조상 전체인지 직계 부모만인지를 먼저 정해야 하고, 채팅이 없어
   * 연락처가 오가는 자리라 거기서 틀리면 유출이다.
   */
  parentId: string | null
  author: PostAuthor
  /**
   * 비밀 댓글인데 볼 권한이 없으면 **서버가 이 필드를 빼고 보낸다.**
   * 화면에서 가리는 게 아니다. 클라이언트가 가리면 응답에 본문이
   * 남아 있어 개발자 도구로 그냥 보인다.
   */
  body?: string | null
  secret: boolean
  /**
   * 댓글 상태 (AD-07).
   *
   * `deleted: boolean` 이었는데 축으로 바꿨다. 블라인드가 들어오면서
   * 상태가 셋이 됐기 때문이다. 불리언 둘로 두면 (지워졌고 동시에
   * 블라인드됨) 이라는 없는 상태가 표현 가능해지고, 화면이 그때
   * 무엇을 그릴지 아무도 정하지 않는다.
   *
   * 셋 다 아래 대댓글이 고아가 되지 않게 자리는 남긴다. 다른 것은
   * 자리에 적히는 문장뿐이다. 지운 것과 가려진 것은 한 일도 다르고
   * 한 사람도 다르다. 본인이 지운 것을 「신고로 가려졌다」 고 적으면
   * 읽는 쪽이 그 사람을 오해한다.
   */
  state: CommentState
  createdAt: string
}

/**
 * 댓글 상태.
 *
 *   ACTIVE   보통
 *   BLINDED  신고 처리 결과로 운영자가 가렸다. 본문을 서버가 빼고 보낸다
 *   DELETED  본인이 지웠다
 */
export type CommentState = 'ACTIVE' | 'BLINDED' | 'DELETED'

/** 자리표시자로 바뀐 댓글. 본문 자리에 문장 하나만 남는다 */
export function isPlaceholder(state: CommentState): boolean {
  return state !== 'ACTIVE'
}

/**
 * 보는 사람.
 *
 * 로그인이 아직 없어 화면이 이 값을 받아 분기한다. 인증이 붙으면
 * 서버 세션에서 채운다.
 */
export type ViewerRole = 'guest' | 'member' | 'host'

/**
 * 계정에 걸린 제한. 도메인 문서 6장의 [제재] 축이다.
 *
 *   NONE       아무것도 없다
 *   WARNED     경고. **막지 않는다.** 다음에 같은 일이 있으면 정지된다는 예고다
 *   AGE_HOLD   나이 확인 대기. 쓰기만 막고 읽기는 열어둔다
 *   SUSPENDED  기간 정지. until 까지 쓰기가 막힌다
 *   BANNED     영구 정지
 *
 * 가입 축(PENDING_SIGNUP_INFO · ACTIVE · WITHDRAWN)과 독립이다.
 * 가입을 마친 사람도 정지될 수 있고, 정지된 사람도 계정은 살아 있다.
 *
 * **AGE_HOLD 는 벌이 아니다.** 만 14세 미만이라는 구체적인 신고가 들어와
 * 본인에게 확인을 요청했는데 답이 없을 때 거는 상태다 (처리방침 제10조).
 * 답이 오면 풀고, 끝까지 없으면 계정을 파기한다.
 *
 * 이걸 같은 축에 둔 이유는 하나다. **"지금 쓸 수 있나" 를 묻는 자리가
 * 여러 곳이라 판정이 한 필드에서 나와야 한다.** 나이 확인만 따로 필드를
 * 두면 게이트마다 두 가지를 다 봐야 하고, 언젠가 한쪽을 빠뜨린다.
 * 다만 사용자에게 「제재」 라고 말하지 않는다. 문구가 다르다.
 */
export type SanctionKind = 'NONE' | 'WARNED' | 'AGE_HOLD' | 'SUSPENDED' | 'BANNED'

/**
 * 지금 글·댓글을 쓸 수 있는가.
 *
 * 게이트가 모집글 목록의 글쓰기, 모집글 상세의 댓글칸, 프로필의 마이메뉴
 * 이렇게 흩어져 있다. 각자 kind 를 비교하면 새 상태가 생길 때마다 세 군데를
 * 고쳐야 하고, 한 곳을 놓치면 막아야 할 사람이 그 길로 쓴다.
 *
 * 경고는 통과시킨다. 막을 거면 정지를 주면 된다.
 *
 * **화면 판정일 뿐이다.** 실제로 막는 것은 서버다. 화면에서만 막으면
 * API 를 직접 부르면 그만이다 (AU-07 과 같은 이유).
 */
export function canWrite(s?: Sanction | null): boolean {
  return !s || s.kind === 'NONE' || s.kind === 'WARNED'
}

/** 읽는 것까지 막히는가. 정지·영구만 화면을 통째로 가린다 (AD-04) */
export function isBlocked(s?: Sanction | null): boolean {
  return !!s && (s.kind === 'SUSPENDED' || s.kind === 'BANNED')
}

/**
 * 본인에게 보여주는 제재 내용.
 *
 * **사유를 반드시 같이 보낸다.** 백오피스 제재 시트의 사유 칸에
 * 「본인에게 보이는 문구입니다」 라고 적어두었는데 정작 보여줄 자리가
 * 없었다. 무엇을 잘못했는지 모르면 고칠 수가 없고, 이의를 제기할
 * 근거도 없다.
 */
export interface Sanction {
  kind: SanctionKind
  /** 운영자가 적은 사유. 본인에게 그대로 보인다 */
  reason: string
  /** 'YYYY-MM-DDTHH:mm'. SUSPENDED 일 때만 있다 */
  until?: string | null
  issuedAt: string
}

export interface Viewer {
  role: ViewerRole
  /** 비회원이면 null */
  userId: string | null
  /** 제재. 없으면 NONE 으로 본다 */
  sanction?: Sanction | null
}

/* ── 감사 로그 (AD-05) ─────────────────────────────────────
   운영자가 한 일을 남기는 기록. **덧붙이기만 한다.**

   왜 필요한가. 이 서비스에서 운영자가 할 수 있는 일 중 둘이 특히
   무겁다. 남의 계정을 정지·파기하는 것과 **비밀 댓글을 열어보는
   것**이다. 채팅이 없어 비밀 댓글이 연락처가 오가는 유일한 통로라,
   그걸 열람하는 것은 남의 연락처를 보는 일이다.

   개인정보 처리방침 제8조에 「열람 사실은 수정·삭제할 수 없는
   기록으로 남습니다」 라고 이미 공개했다. 그 약속을 지키는 자리다.

   고치거나 지우는 함수를 두지 않는다. 있으면 언젠가 쓴다. */

export type AuditKind =
  /** 제재를 주었다 */
  | 'SANCTION'
  /** 제재를 풀었다 */
  | 'RELEASE'
  /** 신고를 처리했다 */
  | 'REPORT'
  /** 댓글을 가렸다 */
  | 'BLIND'
  /** 비밀 댓글 본문을 열어봤다 */
  | 'SECRET_READ'
  /** 계정을 파기했다 */
  | 'PURGE'

export interface AuditEntry {
  id: string
  /** 'YYYY-MM-DDTHH:mm' */
  at: string
  /** 한 사람. 인증이 붙으면 서버가 세션에서 채운다 (AD-06) */
  actor: string
  kind: AuditKind
  /** 무엇에 대해 한 일인지. 닉네임이거나 댓글 요약 */
  target: string
  /** 남길 말. 수위·사유·처리 결과 */
  detail: string
}
