/**
 * 약관·처리방침 본문.
 *
 * 앞서 `LegalStub` 은 「아직 안 썼다」 고 적어 두었다. 그럴듯한 문장을
 * 지어 걸어두면 팀은 다 됐다고 여기고 사용자는 없는 약속을 읽는다는
 * 이유였고, 그 판단은 지금도 맞다.
 *
 * 그래서 초안을 쓰되 **초안이라는 사실을 문서 맨 위에 남긴다.**
 * 아직 안 정해진 값(사업자명·연락처·보관 기간)은 `〔 〕` 로 비워
 * 두었다. 빈칸을 그럴듯한 값으로 채우면 그 순간 검토가 끝난 문서처럼
 * 보이고, 실제로 채워야 할 사람이 어디를 채울지 알 수 없게 된다.
 *
 * 조 번호를 매기는 이유는 신고·제재 안내에서 「제10조에 따라」 처럼
 * 가리켜야 하기 때문이다. 조가 없으면 통지문이 근거를 못 댄다.
 */
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { wf } from '@/lib/wireframe'

export type LegalSection = {
  /** "제1조 (목적)" 처럼 통째로 적는다 */
  head: string
  /** 문단. 줄바꿈은 문단을 나눈다 */
  body?: string[]
  /** 번호 없는 목록 */
  list?: string[]
  /** 표. 첫 행이 머리다 */
  table?: string[][]
  /** 문단 뒤에 붙는 강조 상자 */
  note?: string
}

export function LegalDoc({
  title,
  updated,
  effective,
  lead,
  sections,
}: {
  title: string
  /** 개정일 */
  updated: string
  /** 시행일. 아직 안 열었으면 미정으로 적는다 */
  effective: string
  lead: string
  sections: LegalSection[]
}) {
  return (
    <PageShell title={title}>
      <div className="legal">
        {/* 초안이라는 사실을 맨 위에 둔다. 아래로 내리면 다 읽고 나서야
            검토 전이라는 것을 알게 된다 */}
        <p className="legal__draft">
          <b>검토 전 초안입니다.</b> 실제로 열기 전에 법무 검토를 받아야 하고,
          〔 〕 로 비워둔 값을 채워야 합니다.
        </p>

        <p className="legal__lead">{lead}</p>

        <p className="legal__dates meta">
          <span>개정 {updated}</span>
          <span>시행 {effective}</span>
        </p>

        {sections.map((s) => (
          <section key={s.head} className="legal__sec">
            <h2 className="legal__h">{s.head}</h2>

            {s.body?.map((p) => (
              <p key={p} className="legal__p">
                {p}
              </p>
            ))}

            {s.list && (
              <ul className="legal__list">
                {s.list.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            )}

            {s.table && (
              /* 표는 좁은 화면에서 넘칠 수 있다. 페이지가 아니라 표만
                 옆으로 밀리게 둔다 */
              <div className="legal__tablewrap">
                <table className="legal__table">
                  <thead>
                    <tr>
                      {s.table[0].map((th) => (
                        <th key={th}>{th}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.slice(1).map((row) => (
                      <tr key={row.join('|')}>
                        {row.map((td, i) => (
                          <td key={i}>{td}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {s.note && <p className="legal__note">{s.note}</p>}
          </section>
        ))}

        <p className="legal__back">
          <Link href={wf('/login')}>로그인으로 돌아가기</Link>
        </p>
      </div>
    </PageShell>
  )
}
