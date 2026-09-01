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
 *
 * 묻는 것은 다섯뿐이다. 제목 · 내용 · 언제 · 어디서 · 몇 명.
 * 한때 일곱 칸이었는데 시각과 모집 마감이 따로 있었다. 시각은 날짜와
 * 같은 것을 두 칸에서 물은 것이고, 마감은 기본값이 곧 정답이라
 * 보여줄 이유가 없었다.
 */
import { useState } from 'react'
import { PageShell } from '@/components/ui/PageShell'
import { Button, Sheet } from '@/components/ui/Basics'
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field'
import { EventPicker, type PickableEvent } from '@/components/ui/EventPicker'

type Form = {
  title: string
  body: string
  capacity: string
  /** 'YYYY-MM-DDTHH:mm'. 날짜와 시각을 한 칸에서 받는다 */
  meetAt: string
  place: string
}

const EMPTY: Form = {
  title: '',
  body: '',
  capacity: '',
  meetAt: '',
  place: '',
}

/** 화면과 서버가 같은 규칙을 봐야 한다. 서버에도 같은 검증이 있다 */
function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.title.trim()) e.title = '제목을 적어주세요'
  else if (f.title.length > 40) e.title = '40자를 넘었어요'
  if (!f.body.trim()) e.body = '어떤 동행인지 적어주세요'
  else if (f.body.length > 500) e.body = '500자를 넘었어요'
  if (!f.capacity) e.capacity = '몇 명 모을지 골라주세요'
  if (!f.meetAt) e.meetAt = '언제 만날지 정해주세요'
  if (!f.place.trim()) e.place = '어디서 만날지 적어주세요'
  return e
}

export default function NewPost({ events }: { events: PickableEvent[] }) {
  const [f, setF] = useState<Form>(EMPTY)
  /* 고른 행사. 필수가 아니다 — 콘서트처럼 우리 데이터에 없는 행사도
     있어서 안 고르고도 올릴 수 있어야 한다 (검증에 넣지 않는 이유) */
  const [event, setEvent] = useState<PickableEvent | null>(null)
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [ask, setAsk] = useState(false)

  /* 한 글자라도 쓴 것이 있는가. 빈 폼에서 나갈 때는 경고하지 않는다.
     "쓰던 내용은 저장되지 않아요" 를 쓴 것도 없는 사람에게 띄우면
     묻지 않아도 될 것을 묻는 셈이다 */
  const dirty = Object.values(f).some((v) => v.trim() !== '') || event !== null

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
        {/* 무슨 행사인지부터 정하고 제목·내용을 쓴다. 당근도 동네생활
            글쓰기에서 카테고리를 맨 위에서 고른다 */}
        <EventPicker all={events} picked={event} onPick={setEvent} />

        {/* 별표를 칸마다 달지 않는 대신 여기서 한 번 말한다. 다섯 칸이
            전부 필수라 별표 다섯 개는 아무것도 구분해주지 못한다 */}
        <p className="form__lead">아래 다섯 가지를 모두 적어야 올릴 수 있어요.</p>

        <Field label="제목" error={show('title')} count={[f.title.length, 40]}>
          <TextInput
            placeholder="에이티즈 팝업 오픈런 같이 하실 분"
            value={f.title}
            onChange={(e) => set('title')(e.target.value)}
          />
        </Field>

        {/* 안내를 힌트 줄로 빼지 않고 placeholder 안에 넣었다. 칸마다
            힌트를 달면 한 칸이 89px 이 되어 다섯 칸이 화면을 넘긴다 */}
        <Field label="내용" error={show('body')} count={[f.body.length, 500]}>
          <TextArea
            placeholder={'혼자 가려니 막막해서 같이 가실 분 찾아요.\n\n몇 시에 만나서 무엇을 할지, 연락은 어떻게 받을지 적으면 사람이 더 잘 모여요. 연락처는 비밀 댓글로 받아도 좋아요.'}
            value={f.body}
            onChange={(e) => set('body')(e.target.value)}
            rows={5}
          />
        </Field>

        {/* 날짜·시각·모집 마감 세 칸을 한 칸으로 합쳤다.

            시각을 따로 받을 이유가 없었다. 어차피 둘 다 필수였고 서버에
            들어갈 때 meet_at 하나로 붙는다. 칸만 둘이었지 묻는 것은
            하나였다.

            모집 마감은 아예 뺐다. 비우면 만나는 날까지였는데, 그러면
            기본값이 곧 정답인 칸을 하나 더 보여준 셈이다. 만나는 날이
            지나면 아무도 못 오므로 마감은 만나는 날이다. 서버가
            closes_at 을 meet_at 으로 채운다 */}
        <Field label="만나는 때" error={show('meetAt')} hint="모집은 이 날까지 받아요">
          <TextInput
            type="datetime-local"
            value={f.meetAt}
            onChange={(e) => set('meetAt')(e.target.value)}
          />
        </Field>

        {/* 좌표를 받지 않는다. 글로 적으면 서버가 지오코딩해 지도를 그린다 */}
        <Field label="만나는 곳" error={show('place')}>
          <TextInput
            placeholder="성수역 3번 출구처럼 찾기 쉬운 곳"
            value={f.place}
            onChange={(e) => set('place')(e.target.value)}
          />
        </Field>

        <Field label="인원" error={show('capacity')}>
          <Select value={f.capacity} onChange={(e) => set('capacity')(e.target.value)}>
            <option value="" disabled>골라주세요</option>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}명 (나 포함)</option>
            ))}
          </Select>
        </Field>

        <div className="form__foot">
          <Button block disabled={sending} onClick={submit}>
            {sending ? '올리는 중…' : '올리기'}
          </Button>
          <button
            type="button"
            className="form__cancel"
            onClick={() => (dirty ? setAsk(true) : history.back())}
          >
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
