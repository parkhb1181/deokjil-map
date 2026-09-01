'use client'

/**
 * 약관·처리방침 자리.
 *
 * 로그인 화면이 두 문서를 걸어놓고 "동의하는 것으로 봅니다" 라고
 * 적는데, 링크가 404 였다. 동의를 받아놓고 무엇에 동의했는지는
 * 못 보게 둔 셈이다.
 *
 * 그럴듯한 약관 문장을 지어 넣지 않는다. 법무 검토를 받지 않은
 * 문장을 진짜처럼 걸어두면, 팀은 다 됐다고 여기고 사용자는 없는
 * 약속을 읽는다. **아직 없다고 적는 편이 정확하다.**
 *
 * 대신 무엇을 채워야 하는지를 같이 적는다. 빈 화면만 있으면
 * 남은 일이 무엇인지 이 화면을 만든 사람만 안다.
 */
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'

export function LegalStub({ title, lead, body, todo }: {
  title: string
  lead: string
  body: string
  /** 실서비스 전에 채워야 하는 항목 */
  todo: string[]
}) {
  return (
    <PageShell title={title}>
      <div className="legal">
        <p className="legal__lead">{lead}</p>
        <p className="legal__body">{body}</p>

        <h2 className="legal__h">채워야 하는 것</h2>
        <ul className="legal__todo">
          {todo.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <p className="legal__back">
          <Link href="/login">로그인으로 돌아가기</Link>
        </p>
      </div>
    </PageShell>
  )
}
