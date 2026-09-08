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

/**
 * 대상 종류. **계약은 대문자다** (API 컨벤션 「Enum은 대문자 스네이크」).
 *
 * 화면은 `ReportSheet` 가 소문자(`'user' | 'post' | 'comment'`)로 받는다.
 * 그쪽이 프롭 이름이라 부르는 자리가 여럿이고, 계약 어휘를 화면까지
 * 밀어 넣는 대신 보내기 직전 한 곳에서 옮긴다.
 */
export type ReportTarget = 'USER' | 'POST' | 'COMMENT'

/**
 * 사유 목록과 대상별 조합표는 `components/ui/ReportSheet.tsx` 가 갖는다.
 *
 * **여기로 옮기지 않는다.** 그리는 쪽과 값 집합이 한 파일에 있어야
 * 목록에 없는 값을 화면이 만들 수 없다. 클라이언트가 목록을 갖기로 한
 * 결정(D-6) 자체가 「신고 시트를 열 때마다 왕복하지 않는다」 는 뜻이라,
 * 시트가 주인인 것이 맞다.
 *
 * 한때 이 파일에도 같은 표를 두었다가 지웠다 — 둘이 갈리면 화면에
 * 뜬 사유를 서버가 400 으로 막는데 어느 쪽이 틀렸는지 알 수 없다.
 */
export type { ReportReason } from '@/components/ui/ReportSheet'

export interface ReportWrite {
  targetType: ReportTarget
  targetId: string
  reason: string
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
