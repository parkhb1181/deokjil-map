import { apiSend } from './http'

/**
 * 신고 (API 설계 2-6).
 *
 * **엔드포인트가 하나다.** 화면은 유저·모집글·댓글 셋이지만 계약은
 * `targetType` 만 다른 하나다 (SF-07).
 *
 * ─────────────────────────────────────────────────────────
 * **사유 목록을 클라이언트가 갖는다** (결정 D-6).
 *
 * 대상 3종 × 사유 3~4개이고 거의 바뀌지 않는다. 신고 시트를 열 때마다
 * 왕복이 붙는 게 더 아깝다는 판단이다. 그래서 아래 표가 화면이 그릴
 * 목록이자 서버가 검증할 값 집합이다.
 *
 * **서버도 같은 검증을 한다.** 값 자체뿐 아니라 대상과의 조합까지 본다.
 * `USER` 전용 사유를 `COMMENT` 로 보내면 `REPORT_REASON_INVALID` 400 이다.
 * 화면에 무엇이 떴든 API 는 직접 호출될 수 있기 때문이다.
 */

export type ReportTarget = 'USER' | 'POST' | 'COMMENT'

export type ReportReason =
  | 'ADVERTISEMENT'
  | 'INAPPROPRIATE'
  | 'ABUSE'
  | 'NO_SHOW'
  | 'AGE_SUSPICION'
  | 'FALSE_INFO'
  | 'OFF_TOPIC'

/**
 * 대상별 사유. **공통 셋이 앞이고 대상별이 뒤에 붙는다.**
 *
 * 순서가 화면 순서다. 위키 API 설계 2-6 의 조합표와 1:1 이라 그쪽이
 * 바뀌면 여기도 바뀐다.
 *
 * **`AGE_SUSPICION` 을 `UNDERAGE` 로 쓰지 않는다.** 화면 문구가
 * 「만 14세 미만으로 보입니다」 가 아니라 「나이를 속인 것 같아요」 인
 * 이유 — 신고자에게 남의 나이를 판정시키지 않는다 — 가 코드명에도
 * 남아야 한다.
 *
 * **사칭 사유를 두지 않는다** (2026-09-05). 1차에 신원 확인 수단이 없어
 * 조치할 수 없는 신고만 쌓인다. 주최자 사칭은 모집글 내용이라
 * `POST` 의 `FALSE_INFO` 로 받는다.
 */
export const REPORT_REASONS: Record<ReportTarget, ReportReason[]> = {
  USER: ['ADVERTISEMENT', 'INAPPROPRIATE', 'ABUSE', 'NO_SHOW', 'AGE_SUSPICION'],
  POST: ['ADVERTISEMENT', 'INAPPROPRIATE', 'ABUSE', 'FALSE_INFO', 'OFF_TOPIC'],
  COMMENT: ['ADVERTISEMENT', 'INAPPROPRIATE', 'ABUSE', 'FALSE_INFO'],
}

/** 화면 문구. 코드가 아니라 이 문장을 사용자에게 보인다 */
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  ADVERTISEMENT: '광고 · 홍보',
  INAPPROPRIATE: '부적절한 내용',
  ABUSE: '욕설 · 비방',
  NO_SHOW: '약속을 지키지 않음',
  AGE_SUSPICION: '나이를 속인 것 같아요',
  FALSE_INFO: '허위 정보',
  OFF_TOPIC: '동행과 무관한 글',
}

export interface ReportWrite {
  targetType: ReportTarget
  targetId: string
  reason: ReportReason
  /** 자유 서술. 없어도 된다 */
  detail?: string
}

/**
 * 접수 (SF-01 · SF-02 · CM-14).
 *
 * 같은 대상을 같은 사람이 다시 신고하면 409 다 (`REPORT_DUPLICATED`).
 * 화면은 그것을 오류가 아니라 「이미 신고한 건이에요」 로 보여준다.
 */
export async function submitReport(body: ReportWrite, token: string): Promise<void> {
  await apiSend<unknown>('POST', '/api/v1/reports', body, token)
}
