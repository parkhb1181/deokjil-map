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
 * 세 가지만 한다.
 *   신고 처리 · 유저 제재 · 이벤트 수기 등록
 *
 * 이벤트 등록이 신규 행사의 유일한 경로다 (AD-01). 크롤러가 생카·팝업만
 * 긁고 콘서트는 안 긁어서, 콘서트 동행을 구하려면 여기서 넣어야 한다.
 */
import { useState } from 'react'
import { Button, Badge, Blank, Sheet } from '@/components/ui/Basics'
import { Field, TextInput, Select, TextArea } from '@/components/ui/Field'

type Report = {
  id: string
  target: '유저' | '모집글' | '댓글'
  subject: string
  reason: string
  detail: string
  reporter: string
  at: string
  /** 신고 누적으로 자동 제한이 걸린 건. 위로 올린다 (AD-03) */
  auto: boolean
  done: boolean
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
    auto: true,
    done: false,
  },
  {
    id: 'r2',
    target: '모집글',
    subject: '홍대 생카 세 군데 같이 도실 분',
    reason: '광고 · 홍보',
    detail: '본문에 쇼핑몰 링크가 있어요.',
    reporter: '남은대댓글',
    at: '2026-08-31T11:40',
    auto: false,
    done: false,
  },
  {
    id: 'r3',
    target: '댓글',
    subject: '카톡 아이디 night_ticket 입니다',
    reason: '부적절한 내용',
    detail: '',
    reporter: '덕질하는오리',
    at: '2026-08-30T22:05',
    auto: false,
    done: true,
  },
]

const TABS = ['신고', '이벤트 등록']

export default function Admin() {
  const [tab, setTab] = useState(0)
  const [only, setOnly] = useState(true)
  const [act, setAct] = useState<Report | null>(null)
  /* API 가 붙으면 목록을 다시 읽는다. 그때까지는 처리한 결과가
     화면에 남아야 무엇을 처리했는지 알 수 있다 */
  const [reports, setReports] = useState(REPORTS)

  const close = (id: string) =>
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, done: true } : r)))

  /* 탭에 붙일 미처리 건수. 필터와 무관하게 전체에서 센다.
     '처리 안 된 것만' 을 꺼둔 상태에서도 남은 일이 몇 건인지 보여야 한다 */
  const pending = reports.filter((r) => !r.done).length

  /* 자동 제한이 걸린 건을 맨 위로. 야간·주말에 사람이 없어도
     그것만은 먼저 보게 한다 (SF-05). 그 안에서는 최신순이다.
     신고는 쌓이는 목록이라 순서를 안 정해두면 들어온 순서대로
     오래된 것이 위에 남는다 */
  const list = reports
    .filter((r) => (only ? !r.done : true))
    .sort((a, b) => Number(b.auto) - Number(a.auto) || (a.at < b.at ? 1 : -1))

  return (
    <div className="bo">
      {/* 상단 바는 전체 폭을 가로지른다. 앱 헤더처럼 제목을 가운데
          두지 않는 것은, 여기가 한 화면을 보는 곳이 아니라 두 가지
          일을 오가는 작업대이기 때문이다 */}
      <header className="bo__bar">
        <span className="bo__logo">
          덕모임 <b>백오피스</b>
        </span>

        <nav className="bo__tabs">
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              className={`bo__tab${tab === i ? ' bo__tab--on' : ''}`}
              aria-current={tab === i ? 'page' : undefined}
              onClick={() => setTab(i)}
            >
              {t}
              {/* 남은 건수를 탭에 붙인다. 들어가 봐야 아는 구조면
                  야간에 쌓인 것을 아무도 모른다 */}
              {i === 0 && pending > 0 && <em className="bo__badge">{pending}</em>}
            </button>
          ))}
        </nav>

        {/* 인증이 붙으면 로그인한 운영자 이름이 온다 (Q-13) */}
        <span className="bo__who">운영자</span>
      </header>

      <main className="bo__body">
        {tab === 0 && (
          <section>
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
                      <tr key={r.id} className={r.auto ? 'bo__tr--hot' : undefined}>
                        <td>
                          <Badge state="off">{r.target}</Badge>
                          {r.auto && <span className="bo__hot">자동 제한</span>}
                        </td>
                        <td className="bo__subject">{r.subject}</td>
                        <td>
                          {r.reason}
                          {r.detail && <span className="bo__detail">{r.detail}</span>}
                        </td>
                        <td className="bo__dim">{r.reporter}</td>
                        <td className="bo__dim bo__when">{r.at.replace('T', ' ')}</td>
                        <td className="bo__actcol">
                          {r.done ? (
                            <Badge state="done">처리됨</Badge>
                          ) : (
                            <span className="bo__acts">
                              <Button size="sm" tone="ghost" onClick={() => close(r.id)}>
                                문제 없음
                              </Button>
                              <Button size="sm" tone="danger" onClick={() => setAct(r)}>
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
          </section>
        )}

        {tab === 1 && (
          <section className="bo__panel">
            <h1 className="bo__h">이벤트 등록</h1>
            <p className="bo__lead">
              자동 수집은 생카와 팝업만 긁습니다. 콘서트처럼 크롤러가 못 가져오는
              행사는 여기서 넣어야 목록에 뜹니다.
            </p>

            {/* 폼은 표만큼 넓힐 이유가 없다. 한 줄이 너무 길면 라벨과
                값이 눈으로 안 이어진다. 두 칸씩 나눠 세로를 줄인다 */}
            <div className="bo__grid">
              <Field label="행사명">
                <TextInput placeholder="아이유 단독 콘서트" />
              </Field>

              <Field label="종류">
                <Select defaultValue="">
                  <option value="" disabled>골라주세요</option>
                  <option value="birthday_cafe">생일카페</option>
                  <option value="popup">팝업</option>
                  <option value="concert">콘서트</option>
                </Select>
              </Field>

              <Field label="시작일">
                <TextInput type="date" />
              </Field>
              <Field label="종료일">
                <TextInput type="date" />
              </Field>

              <div className="bo__wide">
                <Field label="장소" hint="주소를 적으면 좌표는 서버가 찾습니다">
                  <TextInput placeholder="서울 송파구 올림픽로 25 잠실 주경기장" />
                </Field>
              </div>

              {/* 출처를 속이지 않는다. 확인하지 않은 것을 official 로
                  올리지 않는다 (CLAUDE.md) */}
              <div className="bo__wide">
                <Field
                  label="원문 주소"
                  hint="주최자·운영사의 실제 공지여야 합니다. 리스팅 사이트 주소를 넣지 마세요"
                >
                  <TextInput placeholder="https://" />
                </Field>
              </div>
            </div>

            <div className="bo__submit">
              <Button>등록하기</Button>
            </div>
          </section>
        )}
      </main>

      {act && (
        <Sheet
          title={`${act.subject} 제재`}
          desc="제재와 해제는 모두 기록에 남습니다. 지울 수 없어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAct(null)}>취소</Button>
              <Button
                tone="danger"
                onClick={() => {
                  close(act.id)
                  setAct(null)
                }}
              >
                제재하기
              </Button>
            </>
          }
        >
          <Field label="수위">
            <Select defaultValue="warn">
              <option value="warn">경고</option>
              <option value="7d">7일 정지</option>
              <option value="forever">영구 정지</option>
            </Select>
          </Field>
          <Field label="사유" hint="본인에게 보이는 문구입니다">
            <TextArea placeholder="어떤 규칙을 어겼는지 적어주세요" rows={3} />
          </Field>
        </Sheet>
      )}
    </div>
  )
}
