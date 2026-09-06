'use client'

/**
 * 백오피스. **PC 화면이다.**
 *
 * 여기만 다른 화면과 규격이 다르다. 나머지는 휴대폰으로 쓰는 서비스지만
 * 이건 운영자가 책상에서 쓴다. 신고를 훑고 처리하는 일은 한 건씩
 * 스크롤하는 것보다 여러 건을 표로 늘어놓고 위에서 아래로 훑는 편이
 * 빠르다. 640px 컬럼에 카드를 쌓으면 네 건 보려고 화면을 세 번 넘긴다.
 *
 * 그래서 PageShell 을 쓰지 않는다. PageShell 은 뒤로가기와 --page-w
 * 컬럼을 주는데 여기는 둘 다 안 맞는다. 백오피스는 앱 안에서 들어오는
 * 화면이 아니라 주소를 쳐서 들어오는 화면이라 뒤로 갈 곳이 없다.
 *
 * 명세가 "의도적으로 최소한만 만든다. 화면 완성도에 시간을 쓰지
 * 않으며 권한 등급 체계도 1차에서는 만들지 않는다" 고 못박았다.
 * PC 로 바꾼 것도 예쁘게 하려는 게 아니라 표가 카드보다 빠르기 때문이다.
 *
 * 이벤트 수기 등록(AD-01)은 뺐다. 크롤러가 못 가져오는 행사는 모집글에서
 * 행사를 안 고르고 올리면 된다.
 *
 * **탭을 되살렸다.** 한때 할 일이 신고 하나라 없앴는데 셋이 됐다.
 *   신고 (AD-02 · AD-03 · AD-07)
 *   제재 (AD-04) — 주는 것만 있고 푸는 자리가 없었다
 *   기록 (AD-05) — 남긴다고 처리방침에 써놓고 볼 자리가 없었다
 */
import { useState } from 'react'
import { useViewer } from '@/lib/auth/useViewer'
import { USE_API } from '@/lib/api/config'
import { Button, Badge, Blank, Sheet } from '@/components/ui/Basics'
import { Field, Select, TextArea, Checkbox } from '@/components/ui/Field'
import type { AuditEntry, AuditKind, SanctionKind } from '@/types'
import { stamp, fullText as readable } from '@/lib/when'

/* ── 제재 수위 ─────────────────────────────────────────────
   가운데 둘이 나이 확인용이다. 처리방침 제10조를 화면으로 옮긴 것이고,
   **둘을 갈라둔 것이 핵심이다.**

     hold    글쓰기만 막고 본인에게 확인을 요청한다. 되돌릴 수 있다
     purge   계정과 글을 통째로 지운다. 되돌릴 수 없다

   신고가 들어왔다고 바로 지우면 그 자체가 남을 지우는 도구가 된다.
   그래서 확인 요청이 먼저고, 답이 없을 때만 파기로 간다. */

type Level = 'warn' | 'hold' | '7d' | 'forever' | 'purge'

const LEVELS: { key: Level; label: string }[] = [
  { key: 'warn', label: '경고' },
  { key: 'hold', label: '나이 확인 요청 (글쓰기 제한)' },
  { key: '7d', label: '7일 정지' },
  { key: 'forever', label: '영구 정지' },
  { key: 'purge', label: '계정 삭제 (연령 미달)' },
]

const LEVEL_KIND: Record<Level, SanctionKind> = {
  warn: 'WARNED',
  hold: 'AGE_HOLD',
  '7d': 'SUSPENDED',
  forever: 'BANNED',
  purge: 'BANNED',
}

const KIND_TEXT: Record<SanctionKind, string> = {
  NONE: '없음',
  WARNED: '경고',
  AGE_HOLD: '나이 확인',
  SUSPENDED: '기간 정지',
  BANNED: '영구 정지',
}

const AUDIT_TEXT: Record<AuditKind, string> = {
  SANCTION: '제재',
  RELEASE: '제재 해제',
  BLIND: '댓글 블라인드',
  SECRET_READ: '비밀 댓글 열람',
  PURGE: '계정 파기',
}

/* ── 목데이터 ───────────────────────────────────────────── */

/**
 * 신고 처리 상태 (AD-03, 2026-09-05 결정).
 *
 * boolean 이었다. 「처리 중」 이 없어서 **관리자 넷이 같은 건을 동시에
 * 붙잡았다** — 목록에서는 둘 다 미처리로 보이니 둘 다 손을 댄다.
 *
 * RESOLVED 는 종착이다. 처리한 신고는 다시 처리하지 않는다.
 */
export type ReportStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED'

const STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: '미처리',
  PROCESSING: '처리 중',
  RESOLVED: '처리됨',
}

type Report = {
  id: string
  target: '유저' | '모집글' | '댓글'
  subject: string
  reason: string
  detail: string
  reporter: string
  at: string
  status: ReportStatus
  /** 비밀 댓글 신고. 본문을 보려면 열람 기록을 남겨야 한다 (AD-05) */
  secret?: boolean
  /** 비밀 댓글 본문. 열기 전에는 화면에 안 뿌린다 */
  body?: string
  /** 어떻게 처리했는지. 처리한 뒤에만 있다 (AD-03) */
  result?: string
}

const REPORTS: Report[] = [
  {
    id: 'r1',
    target: '유저',
    subject: '조용한덕후',
    reason: '약속을 지키지 않음',
    detail: '만나기로 한 날 연락이 끊겼습니다.',
    reporter: '밤샘예매',
    at: '2026-08-31T09:12',
    status: 'PENDING',
  },
  {
    id: 'r2',
    target: '모집글',
    subject: '홍대 생카 세 군데 같이 도실 분',
    reason: '광고 · 홍보',
    detail: '본문에 쇼핑몰 링크가 있어요.',
    reporter: '남은대댓글',
    at: '2026-08-31T11:40',
    status: 'PENDING',
  },
  {
    /* 나이 신고. 신고자가 무엇을 보았는지 적게 되어 있어(ReportSheet)
       여기 사유 칸에 그 문장이 그대로 온다. 어려 보인다는 인상만 온
       신고는 「문제 없음」 으로 닫는다 (처리방침 제10조) */
    id: 'r4',
    target: '유저',
    subject: '남은대댓글',
    reason: '나이를 속인 것 같아요',
    detail: '댓글에 "저 중1인데 엄마가 안 된대요" 라고 적혀 있어요.',
    reporter: '조용한덕후',
    at: '2026-09-01T20:31',
    status: 'PENDING',
  },
  {
    /* 비밀 댓글 신고. 본문이 처음부터 보이면 안 된다. 채팅이 없어
       비밀 댓글이 연락처가 오가는 통로라, 여는 것 자체가 남의
       연락처를 보는 일이다 */
    id: 'r5',
    target: '댓글',
    subject: '비밀 댓글 (빅뱅 전시 같이 보실 분)',
    reason: '부적절한 내용',
    detail: '비밀 댓글로 불쾌한 말을 보냈어요.',
    reporter: '밤샘예매',
    at: '2026-09-01T22:10',
    status: 'PENDING',
    secret: true,
    body: '사진 보내주시면 제가 판단해서 연락드릴게요',
  },
  {
    id: 'r3',
    target: '댓글',
    subject: '카톡 아이디 night_ticket 입니다',
    reason: '부적절한 내용',
    detail: '',
    reporter: '덕질하는오리',
    at: '2026-08-30T22:05',
    status: 'RESOLVED',
    result: '문제 없음',
  },
]

type SanctionRow = {
  id: string
  user: string
  kind: SanctionKind
  reason: string
  issuedAt: string
  /** 기간 정지만 있다 */
  until?: string
}

const SANCTIONS: SanctionRow[] = [
  {
    id: 's1',
    user: '조용한덕후',
    kind: 'SUSPENDED',
    reason: '약속한 날에 연락 없이 나타나지 않았다는 신고가 세 건 접수되었습니다.',
    issuedAt: '2026-09-01T09:00',
    until: '2026-09-08T00:00',
  },
  {
    id: 's2',
    user: '남은대댓글',
    kind: 'AGE_HOLD',
    reason: '가입할 때 적으신 출생연도가 맞는지 확인하려고 합니다.',
    issuedAt: '2026-09-01T18:20',
  },
  {
    id: 's3',
    user: '광고봇계정',
    kind: 'BANNED',
    reason: '다른 이용자에게 반복적으로 불쾌한 메시지를 보냈습니다.',
    issuedAt: '2026-08-25T11:00',
  },
]

const AUDIT: AuditEntry[] = [
  {
    id: 'a3',
    at: '2026-09-01T18:20',
    actor: '운영자',
    kind: 'SANCTION',
    target: '남은대댓글',
    detail: '나이 확인 · 가입할 때 적으신 출생연도가 맞는지 확인하려고 합니다.',
  },
  {
    id: 'a2',
    at: '2026-09-01T09:00',
    actor: '운영자',
    kind: 'SECRET_READ',
    target: '비밀 댓글 c5 (잠실 콘서트 동행)',
    detail: '신고 r0 처리를 위해 본문 열람',
  },
  {
    id: 'a1',
    at: '2026-09-01T09:00',
    actor: '운영자',
    kind: 'SANCTION',
    target: '조용한덕후',
    detail: '기간 정지 7일 · 약속한 날에 연락 없이 나타나지 않았다는 신고가 세 건 접수되었습니다.',
  },
]

/* ── 도구 ──────────────────────────────────────────────── */

/* 시각은 lib/when 이 맡는다. 계약이 ISO-8601 로 못박아서
   화면마다 따로 쪼개면 포맷이 바뀔 때 전부 깨진다 */

type Tab = 'reports' | 'sanctions' | 'audit'

/* 명세 번호(AD-02 …)는 안 적는다. 우리 문서의 줄 번호라 쓰는
   사람에게는 아무 뜻이 없고, 문서가 바뀌면 화면이 거짓말을 한다 */
const TABS: { key: Tab; label: string }[] = [
  { key: 'reports', label: '신고' },
  { key: 'sanctions', label: '제재' },
  { key: 'audit', label: '기록' },
]

export default function Admin() {
  /* 인증이 붙기 전까지 개발용이다 (AD-06 · Q-13). 지금 이 화면을
     막는 것은 주소 끝의 숫자뿐인데 그건 보안이 아니라 자물쇠 그림이다.
     링크를 아는 사람은 그대로 들어온다.

     그래서 **막히는 화면이 어떻게 생겼는지만 먼저 만들어 둔다.**
     실제 판정은 서버가 한다. 화면이 판정하면 이 상태를 뒤집는 것으로
     그냥 뚫린다 */
  /*
   * 관리자인가 (AD-06).
   *
   * 로그인은 카카오 하나로 하고 역할만 얹는다 (2026-09-05 결정).
   * 서버가 /users/me 에 role 을 실어 주고 화면은 그것만 본다.
   *
   * **화면이 판정하지 않는다.** 여기서 정하면 이 상태를 뒤집는 것으로
   * 그냥 뚫린다. 백오피스 API 자체도 서버가 막아야 하고, 이 화면은
   * 못 들어가는 사람에게 무엇을 보여줄지만 정한다.
   */
  const [devAdmin, setDevAdmin] = useState(true)
  const { isAdmin } = useViewer({ role: 'guest', userId: null, sanction: null })
  const admin = USE_API ? !!isAdmin : devAdmin
  const [tab, setTab] = useState<Tab>('reports')

  const [only, setOnly] = useState(true)
  const [reports, setReports] = useState(REPORTS)
  const [sanctions, setSanctions] = useState(SANCTIONS)
  const [audit, setAudit] = useState(AUDIT)

  /* 제재 시트 */
  const [act, setAct] = useState<Report | null>(null)
  const [level, setLevel] = useState<Level>('warn')
  const [why, setWhy] = useState('')
  const [sure, setSure] = useState(false)

  /* 나머지 시트들. 한 번에 하나만 뜬다 */
  const [blind, setBlind] = useState<Report | null>(null)
  const [peek, setPeek] = useState<Report | null>(null)
  const [release, setRelease] = useState<SanctionRow | null>(null)
  const [releaseWhy, setReleaseWhy] = useState('')

  /** 본문을 이미 연 신고. 열람은 한 번만 기록한다 */
  const [opened, setOpened] = useState<string[]>([])

  /**
   * 기록을 덧붙인다. **여기 말고 audit 을 건드리는 곳을 두지 않는다.**
   *
   * 고치거나 지우는 함수는 만들지 않는다. 있으면 언젠가 쓴다.
   * 처리방침 제8조에 「수정·삭제할 수 없는 기록으로 남습니다」 라고
   * 공개해둔 약속이라, 화면 쪽에도 그럴 길을 두지 않는다.
   *
   * append-only 를 실제로 지키는 것은 서버다. 화면은 그렇게 보일 뿐이다.
   */
  const log = (kind: AuditKind, target: string, detail: string) =>
    setAudit((prev) => [
      { id: `a_${Date.now()}`, at: stamp(), actor: '운영자', kind, target, detail },
      ...prev,
    ])

  /**
   * 신고를 닫는다. 결과를 같이 적어야 나중에 왜 그렇게 됐는지 안다.
   *
   * **감사 로그에 남기지 않는다** (2026-09-05). 처리 이력은 신고 자체가
   * 들고 있고, 감사 로그는 개인정보·비공개 내용 접근과 계정 불이익만
   * 담는다. 양쪽에 남기면 같은 사실이 두 곳에 적힌다.
   */
  /**
   * 붙잡거나 놓는다 (PROCESSING ↔ PENDING).
   *
   * **감사 로그에 남기지 않는다.** 계정에 불이익을 주는 행위가 아니고,
   * 누가 집었다 놓았다를 기록해봐야 읽을 사람이 없다.
   */
  const take = (r: Report, status: ReportStatus) => {
    setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)))
  }

  const close = (r: Report, result: string) => {
    setReports((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, status: 'RESOLVED' as const, result } : x)),
    )
  }

  /* 최신순이다. 신고는 쌓이는 목록이라 순서를 안 정해두면 들어온
     순서대로 오래된 것이 위에 남는다 */
  const list = reports
    .filter((r) => (only ? r.status !== 'RESOLVED' : true))
    .sort((a, b) => (a.at < b.at ? 1 : -1))

  /* 제재 목록도 최근 것이 위다. 오래된 정지는 곧 저절로 풀린다 */
  const sancList = [...sanctions].sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))

  /* ── 403 ──────────────────────────────────────────────
     일반 계정으로 들어오면 여기서 끝난다. 목록도 숫자도 안 보여준다.
     "신고 3건" 같은 것만 보여줘도 그건 이미 정보다 */
  if (!admin) {
    return (
      <div className="bo">
        <header className="bo__bar">
          <span className="bo__logo">
            덕모임 <b>백오피스</b>
          </span>
          {!USE_API && <DevWho admin={devAdmin} onPick={setDevAdmin} />}
        </header>
        <main className="bo__body">
          <div className="bo__deny">
            <p className="bo__dcode">403</p>
            <h1 className="bo__dtitle">접근 권한이 없습니다</h1>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bo">
      <header className="bo__bar">
        <span className="bo__logo">
          덕모임 <b>백오피스</b>
        </span>
        {!USE_API && <DevWho admin={devAdmin} onPick={setDevAdmin} />}
      </header>

      {/* 탭. 셋 다 운영자가 번갈아 보는 것이라 화면을 나누지 않는다.
          신고를 처리하면 기록이 쌓이고, 제재를 풀어도 기록이 쌓인다 */}
      <nav className="bo__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className="bo__tab"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="bo__body">
        {/* ── 신고 ─────────────────────────────────────── */}
        {tab === 'reports' && (
          <>
            <div className="bo__toolbar">
              <h1 className="bo__h">신고</h1>
              <label className="bo__filter">
                <input
                  type="checkbox"
                  checked={only}
                  onChange={(e) => setOnly(e.target.checked)}
                />
                처리 안 된 것만
              </label>
              <span className="bo__count">{list.length}건</span>
            </div>

            {list.length === 0 ? (
              <Blank title="처리할 신고가 없어요" art={false} />
            ) : (
              /* 좁은 화면에서는 표가 옆으로 흐른다. 칸을 접어 쌓으면
                 표로 훑는다는 이점이 사라지므로 그냥 흐르게 둔다.
                 PC 로 보라고 만든 화면이다 */
              <div className="bo__scroll">
                <table className="bo__table">
                  <thead>
                    <tr>
                      <th>대상</th>
                      <th>신고된 것</th>
                      <th>사유</th>
                      <th>신고자</th>
                      <th>접수</th>
                      <th className="bo__actcol">처리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Badge state="off">{r.target}</Badge>
                        </td>
                        <td className="bo__subject">
                          {r.subject}
                          {/* 비밀 댓글은 본문을 여기 안 뿌린다. 여는
                              것이 기록에 남는 행위라 한 번 물어본다 */}
                          {r.secret && (
                            <span className="bo__peek">
                              {opened.includes(r.id) ? (
                                <span className="bo__peeked">{r.body}</span>
                              ) : (
                                <button type="button" onClick={() => setPeek(r)}>
                                  본문 보기
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          {r.reason}
                          {r.detail && <span className="bo__detail">{r.detail}</span>}
                        </td>
                        <td className="bo__dim">{r.reporter}</td>
                        <td className="bo__dim bo__when">{readable(r.at)}</td>
                        <td className="bo__actcol">
                          {r.status === 'RESOLVED' ? (
                            /* 처리한 신고는 다시 처리하지 않는다 (AD-03).
                               결과를 배지 옆에 남겨야 나중에 왜 그렇게
                               됐는지 알 수 있다 */
                            <span className="bo__acts">
                              <Badge state="off">{STATUS_LABEL.RESOLVED}</Badge>
                              {r.result && <span className="bo__result">{r.result}</span>}
                            </span>
                          ) : (
                            <span className="bo__acts">
                              {/* 붙잡았다는 표시. 이것이 없으면 관리자 넷이
                                  같은 건에 동시에 손을 댄다. 되돌릴 수도
                                  있어야 한다 — 열어보고 내 건이 아니면
                                  놓아야 다른 사람이 집는다 */}
                              {r.status === 'PROCESSING' ? (
                                <button
                                  type="button"
                                  className="bo__hold bo__hold--on"
                                  onClick={() => take(r, 'PENDING')}
                                >
                                  {STATUS_LABEL.PROCESSING}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="bo__hold"
                                  onClick={() => take(r, 'PROCESSING')}
                                >
                                  맡기
                                </button>
                              )}
                              <Button size="sm" tone="ghost" onClick={() => close(r, '문제 없음')}>
                                문제 없음
                              </Button>
                              {/* 댓글만 가릴 수 있다 (AD-07). 모집글은
                                  가리는 대신 방장이 내리거나 제재로 간다 */}
                              {r.target === '댓글' && (
                                <Button size="sm" tone="ghost" onClick={() => setBlind(r)}>
                                  블라인드
                                </Button>
                              )}
                              <Button
                                size="sm"
                                tone="danger"
                                onClick={() => {
                                  /* 시트를 열 때마다 처음으로 되돌린다. 앞
                                     건에서 파기를 고르고 닫았는데 그 값이
                                     남아 있으면 다음 사람이 그대로 지워진다 */
                                  setLevel('warn')
                                  setWhy('')
                                  setSure(false)
                                  setAct(r)
                                }}
                              >
                                제재
                              </Button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── 제재 ─────────────────────────────────────── */}
        {tab === 'sanctions' && (
          <>
            <div className="bo__toolbar">
              <h1 className="bo__h">제재 중인 회원</h1>
              <span className="bo__count">{sancList.length}명</span>
            </div>
            <p className="bo__lead">
              기간 정지는 종료일이 지나면 저절로 풀립니다. 여기서 푸는 것은 그
              전에 푸는 경우이고, 푼 것도 기록에 남습니다.
            </p>

            {sancList.length === 0 ? (
              <Blank title="제재 중인 회원이 없어요" art={false} />
            ) : (
              <div className="bo__scroll">
                <table className="bo__table">
                  <thead>
                    <tr>
                      <th>회원</th>
                      <th>수위</th>
                      <th>사유</th>
                      <th>시작</th>
                      <th>종료</th>
                      <th className="bo__actcol">처리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sancList.map((s) => (
                      <tr key={s.id}>
                        <td className="bo__subject">{s.user}</td>
                        <td>
                          <Badge state="off">{KIND_TEXT[s.kind]}</Badge>
                        </td>
                        <td>{s.reason}</td>
                        <td className="bo__dim bo__when">{readable(s.issuedAt)}</td>
                        <td className="bo__dim bo__when">
                          {s.until ? readable(s.until) : '없음'}
                        </td>
                        <td className="bo__actcol">
                          <Button
                            size="sm"
                            tone="ghost"
                            onClick={() => {
                              setReleaseWhy('')
                              setRelease(s)
                            }}
                          >
                            해제
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── 기록 ─────────────────────────────────────── */}
        {tab === 'audit' && (
          <>
            <div className="bo__toolbar">
              <h1 className="bo__h">기록</h1>
              <span className="bo__count">{audit.length}건</span>
            </div>
            <p className="bo__lead">
              운영자가 한 일을 덧붙이기만 하는 목록입니다.{' '}
              <b>고치거나 지울 수 없습니다.</b> 제재와 해제, 그리고 비밀 댓글을
              열어본 사실이 여기 남습니다. 개인정보 처리방침 제8조에 공개해둔
              약속입니다.
            </p>

            <div className="bo__scroll">
              <table className="bo__table">
                <thead>
                  <tr>
                    <th>시각</th>
                    <th>운영자</th>
                    <th>한 일</th>
                    <th>대상</th>
                    <th>내용</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="bo__dim bo__when">{readable(a.at)}</td>
                      <td className="bo__dim">{a.actor}</td>
                      <td>
                        <Badge state="off">{AUDIT_TEXT[a.kind]}</Badge>
                      </td>
                      <td className="bo__subject">{a.target}</td>
                      <td>{a.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* ── 제재 시트 ───────────────────────────────────── */}
      {act && (
        <Sheet
          title={`${act.subject} 제재`}
          desc="제재와 해제는 모두 기록에 남습니다. 지울 수 없어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAct(null)}>취소</Button>
              <Button
                tone="danger"
                /* 파기는 확인을 받아야 눌린다. 나머지는 되돌릴 수 있어
                   한 번에 보낸다 */
                disabled={level === 'purge' && !sure}
                onClick={() => {
                  const label = LEVELS.find((l) => l.key === level)!.label
                  const reason = why.trim() || '사유 미기재'
                  if (level === 'purge') {
                    log('PURGE', act.subject, `연령 미달 · ${reason}`)
                    /* 파기하면 제재 목록에서도 사라진다. 계정이 없어졌는데
                       제재 중인 회원으로 남아 있으면 그건 남은 개인정보다 */
                    setSanctions((prev) => prev.filter((s) => s.user !== act.subject))
                  } else {
                    log('SANCTION', act.subject, `${label} · ${reason}`)
                    /* 같은 사람에게 두 줄이 생기지 않게 먼저 걷어낸다.
                       제재는 한 사람에 하나다. 경고를 받은 사람이 정지되면
                       그건 정지 한 줄이지 두 줄이 아니다 */
                    setSanctions((prev) => [
                      ...prev.filter((s) => s.user !== act.subject),
                      {
                        id: `s_${Date.now()}`,
                        user: act.subject,
                        kind: LEVEL_KIND[level],
                        reason,
                        issuedAt: stamp(),
                      },
                    ])
                  }
                  close(act, label)
                  setAct(null)
                }}
              >
                {level === 'purge' ? '계정 삭제하기' : '제재하기'}
              </Button>
            </>
          }
        >
          <Field label="수위">
            <Select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {LEVELS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>

          {/* 나이 확인은 무엇이 일어나는지 한 줄로 알려준다. 「글쓰기
              제한」 이라는 말만으로는 읽기가 열려 있다는 것과 답이 오면
              풀린다는 것이 안 보인다 */}
          {level === 'hold' && (
            <p className="bo__hint">
              본인에게 확인을 요청하고 글·댓글만 막습니다. 읽는 것은 막지 않습니다.
              답을 받으면 풀고, 끝까지 없으면 그때 파기합니다.
            </p>
          )}

          {/* 파기는 되돌릴 수 없다. 그래서 무엇이 지워지는지 먼저 적고,
              무엇을 근거로 판단했는지를 손으로 확인받는다.

              신고가 들어왔다는 사실만으로는 지우지 않는다. 그렇게 두면
              신고가 남의 계정을 지우는 버튼이 된다 (처리방침 제10조) */}
          {level === 'purge' && (
            <div className="bo__danger">
              <p className="bo__dhead">되돌릴 수 없습니다</p>
              <p>
                계정과 그 계정으로 받은 개인정보를 모두 파기합니다. 쓴 글과 댓글도
                함께 지우며 자리표시자를 남기지 않습니다.
              </p>
              <Checkbox
                label="본인이 밝힌 내용을 직접 확인했습니다"
                checked={sure}
                onChange={(e) => setSure(e.target.checked)}
              />
              <p className="bo__dnote">
                어려 보인다는 인상이나 신고 접수만으로는 파기하지 않습니다. 근거가
                추측뿐이면 위에서 「나이 확인 요청」 을 고르세요.
              </p>
            </div>
          )}

          <Field
            label="사유"
            hint={
              level === 'purge'
                ? '기록에만 남습니다. 파기된 계정에는 보여줄 화면이 없습니다'
                : '본인에게 보이는 문구입니다'
            }
          >
            <TextArea
              placeholder={
                level === 'hold'
                  ? '무엇을 확인하려는지 적어주세요'
                  : '어떤 규칙을 어겼는지 적어주세요'
              }
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={3}
            />
          </Field>
        </Sheet>
      )}

      {/* ── 블라인드 시트 (AD-07) ───────────────────────── */}
      {blind && (
        <Sheet
          title="이 댓글을 가릴까요?"
          desc="본문이 아무에게도 보이지 않게 됩니다. 자리는 남아서 아래 대댓글이 고아가 되지 않습니다."
          foot={
            <>
              <Button tone="ghost" onClick={() => setBlind(null)}>취소</Button>
              <Button
                tone="danger"
                onClick={() => {
                  log('BLIND', blind.subject, `${blind.reason} · ${blind.detail || '상세 없음'}`)
                  close(blind, '블라인드')
                  setBlind(null)
                }}
              >
                가리기
              </Button>
            </>
          }
        >
          <p className="bo__hint">
            가린 사유는 그 자리에 적지 않습니다. 신고 내용이 남으면 신고가 곧
            공개 낙인이 되고, 누가 신고했는지도 짐작됩니다.
          </p>
          <p className="bo__hint">
            1차에서는 이 화면에서 되돌릴 수 없습니다. 잘못 가린 경우도 기록에
            남으니 그것을 근거로 처리합니다.
          </p>
        </Sheet>
      )}

      {/* ── 비밀 댓글 열람 확인 (AD-05) ─────────────────── */}
      {peek && (
        <Sheet
          title="비밀 댓글 본문을 열까요?"
          desc="채팅이 없어 비밀 댓글이 연락처를 주고받는 통로입니다. 여는 것은 남의 연락처를 보는 일입니다."
          foot={
            <>
              <Button tone="ghost" onClick={() => setPeek(null)}>취소</Button>
              <Button
                tone="danger"
                onClick={() => {
                  setOpened((prev) => [...prev, peek.id])
                  log('SECRET_READ', peek.subject, `신고 ${peek.id} 처리를 위해 본문 열람`)
                  setPeek(null)
                }}
              >
                열람하기
              </Button>
            </>
          }
        >
          <div className="bo__danger">
            <p className="bo__dhead">기록에 남습니다</p>
            <p>
              누가 언제 어느 댓글을 열어봤는지 기록 탭에 남고, 그 기록은 고치거나
              지울 수 없습니다. 개인정보 처리방침 제8조에 이렇게 공개했습니다.
            </p>
          </div>
        </Sheet>
      )}

      {/* ── 해제 시트 (AD-04) ───────────────────────────── */}
      {release && (
        <Sheet
          title={`${release.user} 제재 해제`}
          desc="해제하면 바로 다시 쓸 수 있게 됩니다. 해제한 사실도 기록에 남습니다."
          foot={
            <>
              <Button tone="ghost" onClick={() => setRelease(null)}>취소</Button>
              <Button
                /* 사유가 없으면 못 푼다. 제재를 줄 때 사유를 적게
                   해놓고 풀 때는 안 적게 두면, 나중에 왜 풀렸는지
                   아무도 모른다 */
                disabled={!releaseWhy.trim()}
                onClick={() => {
                  log(
                    'RELEASE',
                    release.user,
                    `${KIND_TEXT[release.kind]} 해제 · ${releaseWhy.trim()}`,
                  )
                  setSanctions((prev) => prev.filter((s) => s.id !== release.id))
                  setRelease(null)
                }}
              >
                해제하기
              </Button>
            </>
          }
        >
          <p className="bo__hint">
            지금 걸린 것은 {KIND_TEXT[release.kind]} 입니다. 사유는 「{release.reason}」
          </p>
          <Field label="해제 사유" hint="기록에 남습니다. 본인에게는 보이지 않습니다">
            <TextArea
              placeholder="이의 제기를 검토한 결과처럼, 왜 푸는지 적어주세요"
              value={releaseWhy}
              onChange={(e) => setReleaseWhy(e.target.value)}
              rows={3}
            />
          </Field>
        </Sheet>
      )}
    </div>
  )
}

/**
 * 누구로 들어와 있나. **개발용이다.**
 *
 * 인증이 붙으면 이 토글을 지우고 서버 세션에서 온 운영자 이름만 남긴다.
 */
function DevWho({ admin, onPick }: { admin: boolean; onPick: (v: boolean) => void }) {
  return (
    <span className="bo__who">
      <button type="button" aria-pressed={admin} onClick={() => onPick(true)}>
        운영자
      </button>
      <button type="button" aria-pressed={!admin} onClick={() => onPick(false)}>
        일반 계정
      </button>
    </span>
  )
}
