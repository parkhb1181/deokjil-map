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

export type EventKind = 'birthday_cafe' | 'popup'

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
  open_hours?: string
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
 * 모집글 상태.
 *
 * 명세의 OPEN·FULL·CLOSED·CANCELED 네 개가 아니라 둘이다.
 * 신청·수락을 두지 않기로 해서 정원이 차서 자동으로 마감되는 경로가
 * 없다. 방장이 완료를 누르는 것뿐이다.
 */
export type PostState = 'open' | 'done'

export interface PostAuthor {
  id: string
  nickname: string
  image_url?: string | null
  /** 완료한 동행 횟수. 처음이면 0 */
  done_count?: number
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
  /**
   * 만남 장소. 글쓴이는 텍스트만 입력한다 (Q-03 좌표 입력 안 함).
   * 아래 좌표는 사람이 찍는 것이 아니라 **서버가 이 문자열을
   * 지오코딩해서 채운다.** 실패하면 null 이고 지도를 그리지 않는다.
   */
  meet_place: string
  meet_lat?: number | null
  meet_lng?: number | null
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
  /** 대댓글의 부모. 깊이는 1단계로 고정이라 이 아래는 없다 */
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
