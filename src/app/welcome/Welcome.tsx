'use client'

/**
 * 가입 정보 입력.
 *
 * 소셜 로그인을 마치면 회원은 이미 만들어져 있고 이 값들만 비어
 * 있다 (AU-01). 그래서 "가입" 이 아니라 "환영" 화면이다.
 *
 * 이걸 채우기 전에는 글쓰기와 댓글이 막힌다 (AU-07). 막는 것은
 * 서버 인터셉터다. 화면에서만 막으면 API 를 직접 부르면 그만이다.
 *
 * 성별을 받을지는 아직 안 정했다. 참여 조건(PO-04)을 빼기로 하면서
 * 성별을 쓸 데가 없어졌고, 남는 이유는 미성년 차단(Q-05) 하나인데
 * 그건 연령만으로 된다. 지금은 넣어두되 지우기 쉽게 한 덩어리로 뒀다.
 */
import { useState } from 'react'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Basics'
import { Field, TextInput, Select } from '@/components/ui/Field'

/* 미성년을 빼기로 한 기본값을 따른다 (Q-05 기본값: 미성년 제외).
   허용하기로 바뀌면 여기에 줄을 더한다 */
const AGES = ['20대 초반', '20대 후반', '30대 초반', '30대 후반', '40대 이상']

/** 서버에도 같은 규칙이 있다. 화면은 먼저 알려주는 역할일 뿐이다 */
function checkNick(v: string) {
  const s = v.trim()
  if (!s) return '닉네임을 정해주세요'
  if (s.length < 2) return '2자 이상이어야 해요'
  if (s.length > 10) return '10자를 넘었어요'
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(s)) return '한글·영문·숫자·밑줄만 쓸 수 있어요'
  return undefined
}

export default function Welcome() {
  const [nick, setNick] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  /* 서버가 409 를 주면 여기 담는다. 사전 조회만으로는 동시 가입 시
     중복이 생겨 유니크 제약이 최종 방어선이다 (AU-06) */
  const [taken, setTaken] = useState<string | null>(null)

  const nickError = taken === nick.trim() ? '이미 쓰고 있는 닉네임이에요' : checkNick(nick)
  const ageError = age ? undefined : '연령대를 골라주세요'
  const ok = !nickError && !ageError

  const submit = () => {
    setTried(true)
    if (!ok) return
    setSending(true)
    /* API 가 붙으면 여기서 PATCH 하고 409 면 setTaken 한다.
       지금은 '덕모임' 을 이미 있는 이름으로 흉내낸다 */
    setTimeout(() => {
      setSending(false)
      if (nick.trim() === '덕모임') setTaken(nick.trim())
    }, 500)
  }

  return (
    <PageShell title="시작하기">
      <div className="form">
        <p className="form__lead">
          닉네임과 연령대만 정하면 바로 쓸 수 있어요.
          <br />
          나중에 프로필에서 바꿀 수 있습니다.
        </p>

        <Field
          label="닉네임"
          required
          error={tried ? nickError : undefined}
          hint="다른 사람에게 이렇게 보여요"
          count={[nick.trim().length, 10]}
        >
          <TextInput
            placeholder="덕질하는오리"
            value={nick}
            onChange={(e) => {
              setNick(e.target.value)
              /* 이름을 고치면 중복 표시를 지운다. 고쳤는데도 빨간 줄이
                 남아 있으면 무엇이 문제인지 알 수 없다 */
              if (taken) setTaken(null)
            }}
            maxLength={12}
          />
        </Field>

        {/* 성별과 연령대. 참여 조건을 빼면서 성별은 쓸 데가 없어졌다.
            지우기로 정해지면 이 묶음에서 성별 칸만 들어내면 된다 */}
        <Field label="연령대" required error={tried ? ageError : undefined}>
          <Select value={age} onChange={(e) => setAge(e.target.value)}>
            <option value="" disabled>골라주세요</option>
            {AGES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </Field>

        <Field label="성별" hint="지금은 아무 데도 쓰지 않아요. 넣을지 논의 중입니다">
          <Select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">고르지 않음</option>
            <option value="f">여성</option>
            <option value="m">남성</option>
          </Select>
        </Field>

        <div className="form__foot">
          <Button block disabled={sending} onClick={submit}>
            {sending ? '저장하는 중…' : '시작하기'}
          </Button>
        </div>
      </div>
    </PageShell>
  )
}
