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
 * 장소는 글로 적고 지도에 핀을 찍는다. 핀은 선택이라 안 찍으면
 * 서버가 적어준 글을 지오코딩한다 (Q-03).
 * 성별·연령 조건은 받지 않는다. 조건이 필요하면 본문에 적는다.
 *
 * 칸은 여섯이고 **필수는 셋이다. 제목 · 언제 · 어디서.**
 * 내용과 인원은 선택으로 내렸다. 어디서 언제 만나는지만 있으면 글이
 * 성립하고, 나머지는 쓰고 싶은 사람이 쓴다. 필수를 늘릴수록 쓰다 마는
 * 사람이 늘어난다.
 *
 * 인원이 선택이 되면서 정원 개념이 흐려진다. 원래도 표시용이고 자동
 * 마감이 없어서(capacity 는 number | null) 타입은 그대로다.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { Button, Sheet } from '@/components/ui/Basics'
import { Field, TextInput, TextArea, ChoiceChips } from '@/components/ui/Field'
import { EventPicker, type PickableEvent } from '@/components/ui/EventPicker'
import { PlacePicker, type Pin } from '@/components/ui/PlacePicker'
import { wf } from '@/lib/wireframe'

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

/**
 * 고를 수 있는 인원. 나를 포함한 수다.
 *
 * 최대 6명이다. 그 위로는 동행이 아니라 모임이라 알아서 굴러가지
 * 않는다. 만나서 서로 못 알아보고, 한 사람이 늦으면 다섯이 기다린다.
 * 서버 검증도 이 값을 봐야 한다. 화면만 막으면 API 를 직접 부르면 그만이다.
 */
const CAPACITY = [2, 3, 4, 5, 6] as const
const MAX_CAPACITY = CAPACITY[CAPACITY.length - 1]

/**
 * 화면과 서버가 같은 규칙을 봐야 한다. 서버에도 같은 검증이 있다.
 *
 * 고른 행사를 같이 받는 이유는 **만남시각 검증이 행사에 걸리기**
 * 때문이다 (PO-02). 행사를 안 골랐으면 비교할 대상이 없어 검증하지
 * 않는다 — 콘서트처럼 우리 데이터에 없는 행사도 있어서 안 고르고
 * 올릴 수 있어야 한다.
 */
function validate(f: Form, event: PickableEvent | null) {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.title.trim()) e.title = '제목을 적어주세요'
  else if (f.title.length > 40) e.title = '40자를 넘었어요'
  /* 내용은 선택이다. 안 써도 올라가지만 쓴다면 길이는 지킨다 */
  if (f.body.length > 500) e.body = '500자를 넘었어요'
  /* 인원도 선택이다. 다만 고른 값이 상한을 넘으면 막는다. 칩으로만
     고르게 해뒀어도 서버는 아무 값이나 받을 수 있어서, 같은 규칙이
     양쪽에 있어야 한다 */
  if (f.capacity && !CAPACITY.includes(Number(f.capacity) as (typeof CAPACITY)[number]))
    e.capacity = `${MAX_CAPACITY}명까지 모을 수 있어요`
  if (!f.meetAt) e.meetAt = '만나는 시간을 정해주세요'
  /*
   * 행사가 끝난 뒤로는 못 잡는다 (PO-02, 불변식 I-04).
   *
   * endsOn 은 날짜뿐이라 그날 안이면 몇 시든 통과시킨다. 문자열
   * 비교로 끝나는 이유는 둘 다 'YYYY-MM-DD' 로 시작하는 사전순
   * 포맷이어서다. Date 를 만들면 타임존 왕복이 끼어든다 (lib/when.ts).
   */
  else if (event && f.meetAt.slice(0, 10) > event.endsOn)
    e.meetAt = `고른 행사가 ${event.endsOn} 에 끝나요`
  if (!f.place.trim()) e.place = '어디서 만날지 적어주세요'
  return e
}

export default function NewPost({ events }: { events: PickableEvent[] }) {
  const router = useRouter()
  const [f, setF] = useState<Form>(EMPTY)
  /* 고른 행사. 필수가 아니다 — 콘서트처럼 우리 데이터에 없는 행사도
     있어서 안 고르고도 올릴 수 있어야 한다 (검증에 넣지 않는 이유) */
  const [event, setEvent] = useState<PickableEvent | null>(null)
  /* 만날 자리. 안 찍으면 null 이고 서버가 place 를 지오코딩한다 */
  const [pin, setPin] = useState<Pin | null>(null)
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [ask, setAsk] = useState(false)

  /* 한 글자라도 쓴 것이 있는가. 빈 폼에서 나갈 때는 경고하지 않는다.
     "쓰던 내용은 저장되지 않아요" 를 쓴 것도 없는 사람에게 띄우면
     묻지 않아도 될 것을 묻는 셈이다 */
  const dirty = Object.values(f).some((v) => v.trim() !== '') || event !== null || pin !== null

  const errors = validate(f, event)
  const show = (k: keyof Form) => (tried ? errors[k] : undefined)
  const set = (k: keyof Form) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  const submit = () => {
    setTried(true)
    /* 핀이 validate 밖에 있는 이유는 그 함수가 Form 만 받기 때문이다.
       pin 은 지도 컴포넌트가 들고 있는 별도 상태라 여기서 같이 본다 */
    if (Object.keys(errors).length || !pin) {
      /* 첫 번째 잘못된 칸으로 데려간다. 어디가 틀렸는지 찾게 두면
         긴 폼에서는 화면 밖에 있어 안 보인다 */
      document.querySelector('.fld--err')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    setSending(true)
    /* API 가 붙으면 여기서 POST 하고, 응답이 준 id 로 그 글에 간다.
       지금은 만들 수 없으니 목록으로 보낸다.

       replace 다. push 면 뒤로가기가 방금 올린 폼으로 되돌아가고,
       거기서 다시 올리면 같은 글이 두 번 올라간다 */
    setTimeout(() => {
      setSending(false)
      router.replace(wf('/p'))
    }, 600)
  }

  return (
    <PageShell
      title="모집글 쓰기"
      onBack={() => (dirty ? setAsk(true) : history.back())}
    >
      <div className="form">
        {/* 무슨 행사인지부터 정하고 제목·내용을 쓴다. 당근도 동네생활
            글쓰기에서 카테고리를 맨 위에서 고른다.

            라벨을 바깥에 세운다. 전에는 접힌 줄 안에 「함께 갈 행사」 가
            들어 있어서, 아래 칸들의 「제목」·「내용」 과 높이도 굵기도
            달랐다. 같은 폼 안에서 묻는 것인데 하나만 다르게 생겼다 */}
        <div className="fld">
          <span className="fld__label">행사</span>
          <EventPicker all={events} picked={event} onPick={setEvent} />
        </div>

        {/* 필수가 셋, 선택이 셋이라 이제는 구분해줄 값이 있다.
            선택인 칸에만 표시를 단다 (docs/design/SCALE.md 「폼」) */}
        <p className="form__lead">제목과 만나는 때·곳만 적으면 올릴 수 있어요.</p>

        <Field label="제목" error={show('title')} count={[f.title.length, 40]}>
          <TextInput
            /* 완성된 문장을 넣어두면 그대로 베껴 쓰게 된다. 어떤 글을
               쓰는 자리인지만 알려준다 */
            placeholder="어떤 동행인지 한 줄로"
            value={f.title}
            onChange={(e) => set('title')(e.target.value)}
          />
        </Field>

        {/* 안내를 힌트 줄로 빼지 않고 placeholder 안에 넣었다. 칸마다
            힌트를 달면 한 칸이 89px 이 되어 다섯 칸이 화면을 넘긴다 */}
        <Field label="내용" error={show('body')} count={[f.body.length, 500]}>
          <TextArea
            placeholder={'몇 시에 만나서 무엇을 할지 적어주세요.\n연락은 비밀 댓글로 받아도 좋아요.'}
            value={f.body}
            onChange={(e) => set('body')(e.target.value)}
            rows={5}
          />
        </Field>

        {/* 날짜·시각·모집 마감 세 칸을 한 칸으로 합쳤다.

            시각을 따로 받을 이유가 없었다. 어차피 둘 다 필수였고 서버에
            들어갈 때 meetAt 하나로 붙는다. 칸만 둘이었지 묻는 것은
            하나였다.

            모집 마감은 아예 뺐다. 비우면 만나는 날까지였는데, 그러면
            기본값이 곧 정답인 칸을 하나 더 보여준 셈이다. 만나는 날이
            지나면 아무도 못 오므로 마감은 만나는 날이다. 서버가
            closesAt 을 meetAt 으로 채운다 */}
        <Field label="만나는 시간" error={show('meetAt')} hint="모집은 이 날까지 받아요">
          <TextInput
            type="datetime-local"
            value={f.meetAt}
            onChange={(e) => set('meetAt')(e.target.value)}
          />
        </Field>

        {/* 글과 핀을 한 덩어리로 받는다. 핀은 "여기 어디쯤" 이고 글은
            "성수역 3번 출구" 다. 핀만 있으면 도착해서도 서로 못 찾고,
            글만 있으면 처음 가는 동네에서 그게 어디인지 모른다.

            **별도 「만나는 곳」 항목을 없앴다.** 지도와 입력칸이 따로
            있으니 다른 물건처럼 보였다. 찍은 자리 바로 아래에서 이름을
            적으면 무엇에 붙이는 이름인지가 눈으로 이어진다.

            핀이 필수다 (PO-03). 계약이 좌표 누락을 400 으로 막는다 */}
        <PlacePicker
          pin={pin}
          label={f.place}
          onPick={setPin}
          onLabel={set('place')}
          error={tried ? (!pin ? '지도에서 만날 자리를 찍어주세요' : errors.place) : undefined}
        />

        {/* 선택지가 적어서 드롭다운이 아니라 칩이다. 무엇을 고를 수
            있는지가 열어보기 전에 보이고 한 번만 누르면 된다.
            당근도 거래 방식을 칩으로 둔다 */}
        <Field label="인원" optional error={show('capacity')} hint="나를 포함한 인원이에요">
          <ChoiceChips
            value={f.capacity}
            options={CAPACITY.map((n) => ({ value: String(n), label: `${n}명` }))}
            onPick={set('capacity')}
          />
        </Field>

      </div>

      {/* 제출은 화면 아래에 붙인다. 흐름 안에 두면 긴 폼에서 끝까지
          내려보기 전엔 올릴 수 있는 상태인지조차 알 수 없다.
          당근도 작성 완료를 하단에 고정한다 */}
      <div className="form__bar">
        <Button block disabled={sending} onClick={submit}>
          {sending ? '올리는 중…' : '올리기'}
        </Button>
      </div>

      {ask && (
        <Sheet
          title="그만둘까요?"
          desc="쓰던 내용은 저장되지 않아요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(false)}>이어서 쓰기</Button>
              {/* 시트만 닫으면 그만둔 것이 아니라 쓰던 자리로 되돌아온다.
                  물어놓고 아무것도 안 하는 셈이었다 */}
              <Button tone="danger" onClick={() => history.back()}>그만두기</Button>
            </>
          }
        />
      )}
    </PageShell>
  )
}
