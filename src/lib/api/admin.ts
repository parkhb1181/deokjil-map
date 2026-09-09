import type { ReportReason } from '@/components/ui/ReportSheet'
import type { AuditKind, SanctionKind } from '@/types'
import { apiGet, apiSend } from './http'
import { contractError, guards, type Guards } from './wire'

/**
 * 백오피스 (API 설계 2-7).
 *
 * ─────────────────────────────────────────────────────────
 * **관리자인지는 여기서 판정하지 않는다.**
 *
 * 화면이 정하면 그 상태를 뒤집는 것으로 그냥 뚫린다. `/users/me` 에도
 * 관리자 칸이 없다 — admin 토큰으로 불러도 같은 몸이 온다. 판정자는
 * 서버 하나뿐이고, 이 파일의 아무 호출이나 403 을 주면 관리자가 아니다
 * (ADR 0003 「인가는 AdminAccount」).
 *
 * ─────────────────────────────────────────────────────────
 * **제재 목록을 받는 경로가 없다.**
 *
 * 서버에 있는 것은 주는 것(`POST`)과 푸는 것(`DELETE`) 둘뿐이고 「지금
 * 제재 중인 사람」 을 묻는 경로가 없다. 감사 로그로 되짚을 수는 있지만
 * 그건 「제재했다」 와 「풀었다」 를 화면이 짝지어 현재 상태를 재구성하는
 * 일이라, 한 줄만 놓쳐도 안 걸린 사람을 걸린 것으로 보여준다. 만들지
 * 않는다. 제재 탭은 그 경로가 생길 때까지 목데이터로 둔다.
 *
 * 푸는 것도 같이 막힌다 — `sanctionId` 를 목록 없이는 알 수 없다.
 */

const SUBJECT = '백오피스'
const HINT = '위키 02-설계-아키텍처/API-설계.md 의 「2-7. 백오피스 (Admin)」 를 보고 맞춘다.'

/* 함수 선언이라야 never 가 흐름 분석에 쓰인다 (wire.ts) */
function fail(field: string, why: string): never {
  throw contractError(SUBJECT, HINT, field, why)
}

const { str, bool, strOrNull }: Guards = guards(SUBJECT, HINT)

interface Wire {
  [k: string]: unknown
}

interface Page<T> {
  items: T[]
  nextCursor: string | null
  hasNext: boolean
}

/* ── 신고 큐 (AD-02 · AD-03) ─────────────────────────────── */

export type ReportStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED'

/**
 * 무엇으로 종결했는가 (2026-09-09 확정).
 *
 * **enum 과 자유 메모 둘로 갈라져 있다.** 문자열 하나면 「제재 없이 끝난
 * 신고가 몇 건인가」 를 셀 수 없고, enum 하나면 관리자가 판단 맥락을
 * 남길 자리가 없다. 세는 축이 이것이고 문장은 `memo` 가 진다.
 */
export type ReportResult = 'NO_ACTION' | 'COMMENT_BLINDED' | 'USER_SANCTIONED'

export type ReportTargetType = 'USER' | 'POST' | 'COMMENT'

export interface AdminReport {
  id: string
  targetType: ReportTargetType
  /**
   * 신고당한 것의 식별자.
   *
   * **회원번호가 아니다.** `targetType` 이 무엇이냐에 따라 회원·모집글·댓글
   * 중 하나를 가리킨다. 제재는 사람에게 주는 것이라, 글이나 댓글 신고에서
   * 제재하려면 작성자를 따로 알아내야 한다 (`Admin.tsx` 의 `whoTo`).
   */
  targetId: string
  /** 「누가 신고당했나」 축으로 맞춘 표시명. 댓글은 작성자 닉네임이다 */
  subject: string
  reason: ReportReason
  /** 신고자가 적은 상세. 안 적을 수 있다 */
  detail: string | null
  reporter: string
  createdAt: string
  status: ReportStatus
  /** 처리한 뒤에만 있다 */
  result: ReportResult | null
  memo: string | null
  /** 비밀 댓글 신고. 본문을 열면 기록이 남는다 (AD-05) */
  secret: boolean
}

function toReport(raw: unknown): AdminReport {
  if (raw === null || typeof raw !== 'object') fail('report', '객체가 아니다')
  const w = raw as Wire
  return {
    id: str(w.id, 'id'),
    targetType: str(w.targetType, 'targetType') as ReportTargetType,
    targetId: str(w.targetId, 'targetId'),
    subject: str(w.subject, 'subject'),
    reason: str(w.reason, 'reason') as ReportReason,
    detail: strOrNull(w.detail, 'detail'),
    reporter: str(w.reporter, 'reporter'),
    createdAt: str(w.createdAt, 'createdAt'),
    status: str(w.status, 'status') as ReportStatus,
    result: strOrNull(w.result, 'result') as ReportResult | null,
    memo: strOrNull(w.memo, 'memo'),
    secret: bool(w.secret, 'secret'),
  }
}

/**
 * 신고 목록. 최신순이고 상태로 거를 수 있다.
 *
 * **거르기를 서버에 맡긴다.** 화면에서 「처리 안 된 것만」 을 걸러도 다음
 * 장을 받을 때 이미 걸러진 20건이 아니라 전체 20건 중 남은 것만 오므로,
 * 페이지가 넘어갈수록 한 화면에 보이는 건수가 들쭉날쭉해진다.
 */
export async function fetchReports(
  token: string,
  opts: { status?: ReportStatus; cursor?: string | null; size?: number } = {},
): Promise<{ items: AdminReport[]; nextCursor: string | null; hasNext: boolean }> {
  const page = await apiGet<Page<unknown>>(
    '/api/v1/admin/reports',
    { status: opts.status ?? null, cursor: opts.cursor ?? null, size: opts.size ?? 50 },
    token,
  )
  return {
    items: page.items.map(toReport),
    nextCursor: page.nextCursor,
    hasNext: page.hasNext,
  }
}

/**
 * 신고를 옮긴다 (AD-03).
 *
 * `PENDING → PROCESSING → RESOLVED` 이고 직행도 된다. **되돌리는 전이는
 * 없다** — 종결한 신고는 다시 열지 않는다. 이미 종결된 건에 또 보내면
 * 409 다.
 *
 * `result` 는 `RESOLVED` 일 때만 쓰인다. 「맡기」 처럼 상태만 옮기는
 * 호출에서는 안 보낸다.
 */
export async function handleReport(
  id: string,
  body: { status: ReportStatus; result?: ReportResult; memo?: string },
  token: string,
): Promise<void> {
  await apiSend<unknown>('PATCH', `/api/v1/admin/reports/${encodeURIComponent(id)}`, body, token)
}

/* ── 제재 (AD-04) ────────────────────────────────────────── */

/**
 * 제재를 준다.
 *
 * **사유가 본인에게 그대로 보인다.** 비워 보낼 수 없다 (`@NotBlank`).
 * 화면이 「사유 미기재」 같은 것을 대신 채워 보내면 제재를 받은 사람이
 * 그 글자를 읽게 되므로, 빈 사유는 저장 버튼에서 막는다.
 *
 * `until` 은 기간 정지에서만 준다. 나머지 셋에 실어 보내도 서버가 안 쓴다.
 *
 * **계정 파기(purge)가 없다.** 화면에 그 수위가 있지만 서버에는 `BANNED`
 * 까지뿐이고 계정을 지우는 경로가 없다. 영구 정지로 대신 보내면 「지웠다」
 * 고 적힌 화면과 남아 있는 계정이 어긋나므로, API 를 켠 동안 그 수위를
 * 아예 안 보여준다.
 */
export async function sanctionUser(
  userId: string,
  body: { kind: Exclude<SanctionKind, 'NONE'>; reason: string; until?: string },
  token: string,
): Promise<string> {
  const r = await apiSend<{ sanctionId?: unknown }>(
    'POST',
    `/api/v1/admin/users/${encodeURIComponent(userId)}/sanctions`,
    body,
    token,
  )
  return str(r?.sanctionId, 'sanctionId')
}

/**
 * 제재를 푼다.
 *
 * **부르는 자리가 아직 없다.** `sanctionId` 를 알아야 하는데 제재 목록
 * 조회 경로가 없어서, 방금 준 제재를 되무르는 것 말고는 id 를 손에 쥘
 * 방법이 없다. 목록이 생기면 해제 시트가 이걸 부른다. 그때까지 화면은
 * 목데이터로 돈다.
 */
export async function releaseSanction(
  userId: string,
  sanctionId: string,
  token: string,
): Promise<void> {
  await apiSend<unknown>(
    'DELETE',
    `/api/v1/admin/users/${encodeURIComponent(userId)}/sanctions/${encodeURIComponent(sanctionId)}`,
    undefined,
    token,
  )
}

/* ── 댓글 (CM-17 · AD-07) ────────────────────────────────── */

export interface AdminComment {
  id: string
  postId: string
  parentId: string | null
  secret: boolean
  status: 'ACTIVE' | 'DELETED' | 'BLINDED'
  content: string
  createdAt: string
  author: { id: string; nickname: string }
}

function toAdminComment(raw: unknown): AdminComment {
  if (raw === null || typeof raw !== 'object') fail('comment', '객체가 아니다')
  const w = raw as Wire
  const a = w.author
  if (a === null || typeof a !== 'object') fail('author', '객체가 아니다')
  const au = a as Wire
  return {
    id: str(w.id, 'id'),
    postId: str(w.postId, 'postId'),
    parentId: strOrNull(w.parentId, 'parentId'),
    secret: bool(w.secret, 'secret'),
    status: str(w.status, 'status') as AdminComment['status'],
    content: str(w.content, 'content'),
    createdAt: str(w.createdAt, 'createdAt'),
    author: { id: str(au.id, 'author.id'), nickname: str(au.nickname, 'author.nickname') },
  }
}

/**
 * 댓글 본문을 연다 (CM-17).
 *
 * ─────────────────────────────────────────────────────────
 * **부르는 것 자체가 기록에 남는다.**
 *
 * 비밀이든 아니든 호출마다 감사 로그에 `SECRET_READ` 가 쌓인다. 서버가
 * 그렇게 정해 뒀고, 덜 남기는 쪽의 실수는 되돌릴 수 없기 때문이다.
 *
 * **그래서 작성자를 알아내려고 부르면 안 된다.** 제재 대상을 찾자고
 * 이걸 호출하면 열어보지도 않은 본문을 열어본 것으로 장부에 오른다.
 * 운영자가 「본문 보기」 를 눌렀을 때만 부른다.
 *
 * @param reportId 어느 신고를 처리하다 열었는지. 기록의 detail 에 들어간다
 */
export async function readComment(
  commentId: string,
  token: string,
  reportId?: string,
): Promise<AdminComment> {
  return toAdminComment(
    await apiGet<unknown>(
      `/api/v1/admin/comments/${encodeURIComponent(commentId)}`,
      reportId ? { reportId } : undefined,
      token,
    ),
  )
}

/**
 * 댓글을 가린다 (AD-07).
 *
 * 본문이 응답에서 사라지고 자리만 남는다 — 아래 대댓글이 고아가 되지
 * 않게. **되돌리는 경로가 없다.** 잘못 가린 것도 기록으로 남으니 그걸
 * 근거로 처리한다.
 */
export async function blindComment(commentId: string, token: string): Promise<void> {
  await apiSend<unknown>(
    'POST',
    `/api/v1/admin/comments/${encodeURIComponent(commentId)}/blind`,
    undefined,
    token,
  )
}

/* ── 감사 로그 (AD-05) ───────────────────────────────────── */

export interface AuditRow {
  id: string
  at: string
  /** 누가. 서버가 세션에서 채운다 */
  actor: string
  kind: AuditKind
  targetType: 'USER' | 'COMMENT'
  targetId: string
  detail: string
}

function toAuditRow(raw: unknown): AuditRow {
  if (raw === null || typeof raw !== 'object') fail('auditLog', '객체가 아니다')
  const w = raw as Wire
  return {
    id: str(w.id, 'id'),
    at: str(w.at, 'at'),
    actor: str(w.actor, 'actor'),
    kind: str(w.kind, 'kind') as AuditKind,
    targetType: str(w.targetType, 'targetType') as AuditRow['targetType'],
    targetId: str(w.targetId, 'targetId'),
    detail: str(w.detail, 'detail'),
  }
}

/**
 * 감사 로그. 최신순이고 덧붙이기만 한다 (I-13).
 *
 * **대상이 이름이 아니라 번호로 온다.** 서버는 `targetType` 과 `targetId`
 * 를 주고 닉네임을 붙여 주지 않는다. 이름을 채우려면 줄마다 회원 조회를
 * 한 번씩 더 해야 하는데, 기록은 스무 줄씩 오는 목록이라 그러면 요청이
 * 스무 배가 된다. 화면은 「회원 12」 처럼 번호로 적는다 — 감사 로그는
 * 훑어보는 것이 아니라 특정 건을 되짚는 목록이다.
 */
export async function fetchAuditLogs(
  token: string,
  opts: { cursor?: string | null; size?: number } = {},
): Promise<{ items: AuditRow[]; nextCursor: string | null; hasNext: boolean }> {
  const page = await apiGet<Page<unknown>>(
    '/api/v1/admin/audit-logs',
    { cursor: opts.cursor ?? null, size: opts.size ?? 50 },
    token,
  )
  return {
    items: page.items.map(toAuditRow),
    nextCursor: page.nextCursor,
    hasNext: page.hasNext,
  }
}
