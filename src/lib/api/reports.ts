import { apiSend } from './http'

/**
 * 신고 (SF-01 · SF-02 · SF-07 · CM-14).
 *
 * 시트는 하나를 쓰고 대상만 바뀐다. 사유 목록이 대상마다 다른데,
 * 그 목록은 화면(`ui/ReportSheet`)이 들고 있고 서버는 값만 검증한다.
 * 어긋나면 `INVALID_REPORT_REASON` 이다.
 */
export type ReportTargetType = 'USER' | 'POST' | 'COMMENT'

export interface NewReport {
  targetType: ReportTargetType
  targetId: string
  reason: string
  detail?: string
}

/**
 * 접수.
 *
 * **같은 대상 중복은 409 다** (SF-01). 화면은 그걸 오류로 띄우지 말고
 * 「이미 신고한 건이에요」 로 알린다 — 신고한 사람 입장에서는 실패가
 * 아니라 이미 된 것이다.
 */
export function report(body: NewReport, token: string): Promise<null> {
  return apiSend<null>('POST', '/api/v1/reports', body, token)
}
