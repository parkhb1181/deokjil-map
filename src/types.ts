/**
 * poc-plan.md 5.1 스키마를 그대로 옮긴 타입.
 *
 * 필드명·값 집합을 전체 구상(bridge-plan-full.md 7번)의 Postgres 스키마와 일치시킨다.
 * PoC에서 안 쓰는 필드(trust, subject_type)도 남기는 이유는,
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
  is_random: boolean
  sort_order: number
}

export interface EventItem {
  id: string
  place: Place
  /** 아이돌·버추얼·캐릭터·배우. 화이트리스트를 두지 않는다 */
  subject: string
  subject_type: SubjectType
  kind: EventKind
  /** YYYY-MM-DD. 사전순 비교가 곧 날짜 비교가 된다 */
  starts_on: string
  ends_on: string
  /**
   * 운영 시간. '12:00~20:00' 처럼 이미 다듬은 문자열이다.
   * 생카·팝업은 기간 안에서 매일 같은 시간에 연다.
   */
  open_hours?: string
  /**
   * 공연 시작 시각 'HH:mm'. **콘서트만 갖는다.**
   *
   * 생카·팝업은 기간 중 아무 때나 가면 되지만 콘서트는 그 시각에
   * 못 가면 끝이다. open_hours 로 대신할 수 없다. 저건 "언제부터
   * 언제까지 열려 있나" 고 이건 "몇 시에 시작하나" 다.
   *
   * 콘서트는 starts_on 과 ends_on 이 같은 날이다.
   */
  starts_at?: string
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
   * 원문 링크(source_url)를 항상 함께 노출해 출처를 밝힌다.
   */
  image_url?: string
  /**
   * 원문 링크. 출처 표기 필수, 화면에서 반드시 노출한다.
   * 가능하면 주최자·운영사의 공식 게시물을 가리킨다.
   */
  source_url: string
  /** 리스팅 출처. source_url 이 공식 원문일 때 우리가 참고한 곳을 함께 밝힌다 */
  listing_url?: string
  /** 사전예약 링크 */
  reservation_url?: string
  trust: Trust
  goods: Goods[]
}

/* ── 동행 모집 ─────────────────────────────────────────────
   1차 MVP. 아직 API 가 없어 화면이 목데이터를 읽지만, 이 타입이
   그대로 백엔드에 넘길 응답 명세다. 필드를 늘리거나 이름을 바꾸면
   양쪽이 어긋나므로 여기를 먼저 고치고 넘긴다.
   ------------------------------------------------------- */

/**
 * 모집글 상태. 셋이다.
 *
 *   open   모집중
 *   done   모집 완료. **방장이 눌렀다**
 *   ended  행사가 끝났다. **시간이 지나서 그렇게 됐다**
 *
 * done 과 ended 를 나누는 이유는 끝난 까닭이 다르기 때문이다. 하나로
 * 묶으면 목록에서 "사람을 다 구해서 닫힌 글" 과 "아무도 안 와서
 * 지나간 글" 이 같아 보인다.
 *
 * **ended 는 서버가 판정한다.** 붙은 행사의 종료 시각이 지나면
 * ended 다. 날짜만 있는 행사(생카·팝업)는 그 날 24시가 종료 시각이다.
 * 행사에 안 붙은 글은 만나는 날(meet_at)이 기준이다.
 *
 * 화면이 판정하지 않는다. 기기 시계가 제각각이고, 누가 열어봐야만
 * 상태가 바뀌는 구조가 된다.
 *
 * 명세의 OPEN·FULL·CLOSED·CANCELED 넷과는 여전히 다르다. 신청·수락을
 * 두지 않아 정원이 차서 자동 마감되는 경로(FULL)가 없다.
 */
export type PostState = 'open' | 'done' | 'ended'

/**
 * 끝난 글인가. 모집 완료든 행사 종료든 "더 못 들어가는 글" 이다.
 *
 * 화면 대부분은 둘을 구분할 필요가 없고(회색으로 눌러 지나치게
 * 한다), 구분이 필요한 자리는 배지 글자뿐이다. 자리마다 조건을
 * 적으면 상태가 하나 더 늘 때 고칠 곳을 반드시 빠뜨린다.
 */
export function isClosed(state: PostState): boolean {
  return state !== 'open'
}

export interface PostAuthor {
  id: string
  nickname: string
  image_url?: string | null
  /** 완료한 동행 횟수. 처음이면 0 */
  done_count?: number
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
  event_id: string | null
  event_title?: string | null
  /**
   * 붙은 이벤트의 대표 이미지. 우리가 복제해 두는 것이 아니라
   * 원본 서버 주소를 그대로 들고 있는다. 포스터는 저작물이라
   * 재게시하지 않는다 (CLAUDE.md).
   */
  event_image_url?: string | null
  title: string
  body: string
  state: PostState
  /** 방장 포함 인원. 표시만 하고 자동 마감은 없다 */
  capacity: number | null
  /** 'YYYY-MM-DDTHH:mm'. Date 로 왕복하지 않는다 */
  meet_at: string
  meet_point: MeetPoint
  closes_at: string
  created_at: string
  author: PostAuthor
  comment_count: number
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
  parent_id: string | null
  author: PostAuthor
  /**
   * 비밀 댓글인데 볼 권한이 없으면 **서버가 이 필드를 빼고 보낸다.**
   * 화면에서 가리는 게 아니다. 클라이언트가 가리면 응답에 본문이
   * 남아 있어 개발자 도구로 그냥 보인다.
   */
  body?: string | null
  secret: boolean
  /** 지운 댓글. 아래 대댓글이 고아가 되지 않게 자리만 남긴다 */
  deleted: boolean
  created_at: string
}

/**
 * 보는 사람.
 *
 * 로그인이 아직 없어 화면이 이 값을 받아 분기한다. 인증이 붙으면
 * 서버 세션에서 채운다.
 */
export type ViewerRole = 'guest' | 'member' | 'host'

export interface Viewer {
  role: ViewerRole
  /** 비회원이면 null */
  user_id: string | null
}
