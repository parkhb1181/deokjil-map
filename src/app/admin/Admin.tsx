'use client'

/**
 * 백오피스.
 *
 * 명세가 "의도적으로 최소한만 만든다. 화면 완성도에 시간을 쓰지
 * 않으며 권한 등급 체계도 1차에서는 만들지 않는다" 고 못박았다.
 * 그 말을 그대로 따른다. 예쁘게 만들 시간에 사용자 화면을 만든다.
 *
 * 세 가지만 한다.
 *   신고 처리 · 유저 제재 · 이벤트 수기 등록
 *
 * 자동 수집이 없으므로 이벤트 등록이 신규 행사의 유일한 경로다
 * (AD-01). 크롤러가 생카·팝업만 긁고 콘서트는 안 긁어서, 콘서트
 * 동행을 구하려면 여기서 넣어야 한다.
 */
import { useState } from 'react'
import { PageShell } from '@/components/ui/PageShell'
import { Button, Badge, Blank, Sheet, Tabs, Who } from '@/components/ui/Basics'
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

export default function Admin() {
  const [tab, setTab] = useState(0)
  const [only, setOnly] = useState(true)
  const [act, setAct] = useState<Report | null>(null)

  /* 자동 제한이 걸린 건을 맨 위로. 야간·주말에 사람이 없어도
     그것만은 먼저 보게 한다 (SF-05) */
  const list = REPORTS.filter((r) => (only ? !r.done : true)).sort(
    (a, b) => Number(b.auto) - Number(a.auto),
  )

  return (
    <PageShell title="백오피스">
      <Tabs items={['신고', '이벤트 등록']} on={tab} onPick={setTab} />

      {tab === 0 && (
        <div className="adm">
          <label className="adm__filter">
            <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />
            처리 안 된 것만
          </label>

          {list.length === 0 ? (
            <Blank title="처리할 신고가 없어요" art={false} />
          ) : (
            <ul className="adm__list">
              {list.map((r) => (
                <li key={r.id} className={`adm__row${r.auto ? ' adm__row--hot' : ''}`}>
                  <div className="adm__head">
                    <Badge state="off">{r.target}</Badge>
                    {r.auto && <span className="adm__hot">자동 제한 발동</span>}
                    {r.done && <Badge state="done">처리됨</Badge>}
                    <span className="mine__when">{r.at.replace('T', ' ')}</span>
                  </div>

                  <p className="adm__subject">{r.subject}</p>
                  <p className="adm__reason">
                    {r.reason}
                    {r.detail && <span className="adm__detail"> · {r.detail}</span>}
                  </p>
                  <p className="adm__by">신고 {r.reporter}</p>

                  {!r.done && (
                    <div className="adm__acts">
                      <Button size="sm" tone="ghost">문제 없음</Button>
                      <Button size="sm" tone="danger" onClick={() => setAct(r)}>
                        제재
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 1 && (
        <div className="form">
          <p className="form__lead">
            자동 수집은 생카와 팝업만 긁습니다. 콘서트처럼 크롤러가 못 가져오는
            행사는 여기서 넣어야 목록에 뜹니다.
          </p>

          <Field label="행사명" required>
            <TextInput placeholder="아이유 단독 콘서트" />
          </Field>

          <Field label="종류" required>
            <Select defaultValue="">
              <option value="" disabled>골라주세요</option>
              <option value="birthday_cafe">생일카페</option>
              <option value="popup">팝업</option>
              <option value="concert">콘서트</option>
            </Select>
          </Field>

          <Field label="장소" required hint="주소를 적으면 좌표는 서버가 찾습니다">
            <TextInput placeholder="서울 송파구 올림픽로 25 잠실 주경기장" />
          </Field>

          <div className="form__row">
            <Field label="시작일" required>
              <TextInput type="date" />
            </Field>
            <Field label="종료일" required>
              <TextInput type="date" />
            </Field>
          </div>

          {/* 출처를 속이지 않는다. 확인하지 않은 것을 official 로
              올리지 않는다 (CLAUDE.md) */}
          <Field
            label="원문 주소"
            required
            hint="주최자·운영사의 실제 공지여야 합니다. 리스팅 사이트 주소를 넣지 마세요"
          >
            <TextInput placeholder="https://" />
          </Field>

          <div className="form__foot">
            <Button block>등록하기</Button>
          </div>
        </div>
      )}

      {act && (
        <Sheet
          title={`${act.subject} 제재`}
          desc="제재와 해제는 모두 기록에 남습니다. 지울 수 없어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAct(null)}>취소</Button>
              <Button tone="danger" onClick={() => setAct(null)}>제재하기</Button>
            </>
          }
        >
          <Field label="수위" required>
            <Select defaultValue="warn">
              <option value="warn">경고</option>
              <option value="7d">7일 정지</option>
              <option value="forever">영구 정지</option>
            </Select>
          </Field>
          <Field label="사유" required hint="본인에게 보이는 문구입니다">
            <TextArea placeholder="어떤 규칙을 어겼는지 적어주세요" rows={3} />
          </Field>
        </Sheet>
      )}
    </PageShell>
  )
}
