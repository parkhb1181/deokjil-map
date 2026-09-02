/**
 * 약관·처리방침 본문.
 *
 * 앞서 `LegalStub` 은 「아직 안 썼다」 고 적어 두었다. 그럴듯한 문장을
 * 지어 걸어두면 팀은 다 됐다고 여기고 사용자는 없는 약속을 읽는다는
 * 이유였고, 그 판단은 지금도 맞다.
 *
 * 한동안 「검토 전 초안입니다」 배너를 맨 위에 달아 두었다. 지금은 뗐다.
 * GA 와 Clarity 가 실서비스에서 돌고 있어 처리방침 의무가 이미 걸려
 * 있고, 이 문서가 실제로 서비스를 규율하기 때문이다. 규율하는 문서에
 * 「초안」 이라고 적으면 이용자는 이게 지금 적용되는 약속인지 알 수 없다.
 *
 * 법무 검토를 아직 안 받은 것은 사실이지만 그건 팀이 아는 일이다.
 * 이용자에게 할 말은 아니다.
 *
 * 조 번호를 매기는 이유는 신고·제재 안내에서 「제10조에 따라」 처럼
 * 가리켜야 하기 때문이다. 조가 없으면 통지문이 근거를 못 댄다.
 */
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'

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
        {/* 「검토 전 초안입니다」 배너를 걷어냈다.

            이 문서가 실제로 서비스를 규율하기 시작했기 때문이다. 지금
            GA 와 Clarity 가 돌고 있어서 처리방침 의무가 이미 걸려 있다.
            그 상태에서 「초안」 이라고 적어두면 이용자는 이게 지금
            적용되는 약속인지 아닌지 알 수 없다. 규율하는 문서는 규율한다고
            말해야 한다.

            법무 검토를 아직 안 받은 것은 사실이고 그건 팀이 아는 일이다.
            이용자에게 「우리도 아직 확신이 없습니다」 라고 말하는 것과는
            다르다. 검토가 끝나면 개정일만 올리면 된다 */}
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
          <Link href="/">덕모임으로 돌아가기</Link>
        </p>
      </div>
    </PageShell>
  )
}
