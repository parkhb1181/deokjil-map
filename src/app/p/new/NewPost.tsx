'use client'

/**
 * 모집글 작성.
 *
 * 이 앱에서 처음으로 사람이 무언가를 제출하는 화면이다. 그래서
 * 폼 흐름을 여기서 정하고 가입 정보 입력·신고 시트가 그대로 쓴다.
 *   입력 → 흐린 검증 → 제출 → 실패면 그 자리에 사유
 *
 * 누르기 전에는 빨간 줄을 띄우지 않는다. 아직 다 안 쓴 것을 두고
 * 틀렸다고 하면 쓰는 내내 혼나는 기분이 든다. 제출을 누른 뒤부터
 * 보여준다.
 *
 * 좌표는 받지 않는다 (Q-03). 장소는 글로 적고 서버가 지오코딩한다.
 * 성별·연령 조건도 받지 않는다. 조건이 필요하면 본문에 적는다.
 */
import { useState } from 'react'
import { PageShell } from '@/components/ui/PageShell'
import { Button, Sheet } from '@/components/ui/Basics'
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field'

type Form = {
  title: string
  body: string
  capacity: string
  meetDate: string
  meetTime: string
  place: string
  closeDate: string
}

const EMPTY: Form = {
  title: '',
  body: '',
  capacity: '',
  meetDate: '',
  meetTime: '',
  place: '',
  closeDate: '',
}

/** 화면과 서버가 같은 규칙을 봐야 한다. 서버에도 같은 검증이 있다 */
function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.title.trim()) e.title = '제목을 적어주세요'
  else if (f.title.length > 40) e.title = '40자를 넘었어요'
  if (!f.body.trim()) e.body = '어떤 동행인지 적어주세요'
  else if (f.body.length > 500) e.body = '500자를 넘었어요'
  if (!f.capacity) e.capacity = '몇 명 모을지 골라주세요'
  if (!f.meetDate || !f.meetTime) e.meetDate = '만나는 날짜와 시각을 정해주세요'
  if (!f.place.trim()) e.place = '어디서 만날지 적어주세요'

  /* 마감이 만남보다 늦으면 아무도 못 온다 */
  if (f.closeDate && f.meetDate && f.closeDate > f.meetDate) {
    e.closeDate = '만나는 날보다 앞이어야 해요'
  }
  return e
}

export default function NewPost() {
  const [f, setF] = useState<Form>(EMPTY)
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [ask, setAsk] = useState(false)

  const errors = validate(f)
  const show = (k: keyof Form) => (tried ? errors[k] : undefined)
  const set = (k: keyof Form) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  const submit = () => {
    setTried(true)
    if (Object.keys(errors).length) {
      /* 첫 번째 잘못된 칸으로 데려간다. 어디가 틀렸는지 찾게 두면
         긴 폼에서는 화면 밖에 있어 안 보인다 */
      document.querySelector('.fld--err')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    setSending(true)
    /* API 가 붙으면 여기서 POST 한다 */
    setTimeout(() => setSending(false), 600)
  }

  return (
    <PageShell title="모집글 쓰기">
      <div className="form">
        <Field label="제목" required error={show('title')} count={[f.title.length, 40]}>
          <TextInput
            placeholder="에이티즈 팝업 오픈런 같이 하실 분"
            value={f.title}
            onChange={(e) => set('title')(e.target.value)}
          />
        </Field>

        <Field
          label="어떤 동행인가요"
          required
          error={show('body')}
          hint="연락 받을 방법도 같이 적어주세요. 비밀 댓글로 받아도 좋아요"
          count={[f.body.length, 500]}
        >
          <TextArea
            placeholder={'혼자 가려니 막막해서 같이 가실 분 찾아요.\n\n몇 시에 만나서 무엇을 할지 적으면 사람이 더 잘 모여요.'}
            value={f.body}
            onChange={(e) => set('body')(e.target.value)}
            rows={7}
          />
        </Field>

        <div className="form__row">
          <Field label="만나는 날" required error={show('meetDate')}>
            <TextInput
              type="date"
              value={f.meetDate}
              onChange={(e) => set('meetDate')(e.target.value)}
            />
          </Field>
          <Field label="시각" required>
            <TextInput
              type="time"
              value={f.meetTime}
              onChange={(e) => set('meetTime')(e.target.value)}
            />
          </Field>
        </div>

        {/* 좌표를 받지 않는다. 글로 적으면 서버가 지오코딩해 지도를 그린다 */}
        <Field
          label="어디서 만나요"
          required
          error={show('place')}
          hint="지하철역 출구처럼 찾기 쉬운 곳이 좋아요"
        >
          <TextInput
            placeholder="성수역 3번 출구"
            value={f.place}
            onChange={(e) => set('place')(e.target.value)}
          />
        </Field>

        <div className="form__row">
          <Field label="몇 명" required error={show('capacity')}>
            <Select value={f.capacity} onChange={(e) => set('capacity')(e.target.value)}>
              <option value="" disabled>골라주세요</option>
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}명 (나 포함)</option>
              ))}
            </Select>
          </Field>
          <Field label="모집 마감" error={show('closeDate')} hint="비우면 만나는 날까지">
            <TextInput
              type="date"
              value={f.closeDate}
              onChange={(e) => set('closeDate')(e.target.value)}
            />
          </Field>
        </div>

        <div className="form__foot">
          <Button block disabled={sending} onClick={submit}>
            {sending ? '올리는 중…' : '올리기'}
          </Button>
          <button type="button" className="form__cancel" onClick={() => setAsk(true)}>
            그만두기
          </button>
        </div>
      </div>

      {ask && (
        <Sheet
          title="그만둘까요?"
          desc="쓰던 내용은 저장되지 않아요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(false)}>이어서 쓰기</Button>
              <Button tone="danger" onClick={() => setAsk(false)}>그만두기</Button>
            </>
          }
        />
      )}
    </PageShell>
  )
}
