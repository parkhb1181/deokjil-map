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
 * **성별은 받지 않는다.** 참여 조건을 두지 않기로 하면서 성별로
 * 거를 일이 없어졌다. 남은 이유는 미성년 차단 하나인데 그건 연령만으로
 * 된다. 쓰지도 않을 것을 받아두면 유출됐을 때 잃을 것만 늘어난다.
 */
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  const router = useRouter()
  /* 로그인 화면이 들고 온 목적지. 글을 읽다 로그인한 사람은 가입을
     마치고 그 글로 돌아가야 한다. 없으면 홈 */
  const next = useSearchParams().get('next') || '/'
  const [nick, setNick] = useState('')
  const [age, setAge] = useState('')
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  /**
   * 중복 확인 결과.
   *
   * 검사한 이름을 같이 들고 있는 것이 중요하다. 이름만 저장하면
   * "오리" 로 확인받고 "덕모임" 으로 고쳐서 제출하는 길이 열린다.
   * 이름이 달라지면 결과는 무효가 된다.
   *
   * 이 확인은 사전 조회일 뿐이다. 동시에 같은 이름으로 가입하면
   * 둘 다 통과하므로 유니크 제약이 최종 방어선이고 서버가 409 를
   * 준다 (AU-06). 확인을 받았어도 제출에서 막힐 수 있다.
   */
  const [checked, setChecked] = useState<{ name: string; free: boolean } | null>(null)
  const [checking, setChecking] = useState(false)

  const formError = checkNick(nick)
  const fresh = checked && checked.name === nick.trim() ? checked : null

  const takenError = fresh && !fresh.free ? '이미 쓰고 있는 닉네임이에요' : undefined
  const nickError = formError ?? takenError

  /**
   * 화면에 띄울 오류.
   *
   * 형식 오류는 제출을 누른 뒤에 보여준다. 두 글자 치는 도중에
   * "2자 이상이어야 해요" 가 뜨면 쓰는 내내 혼나는 기분이 든다.
   *
   * 중복은 다르다. **사용자가 확인 버튼을 눌러 물어본 것이라 바로
   * 답해야 한다.** 눌렀는데 아무 변화가 없으면 눌린 건지도 모른다.
   */
  const shownError = (tried ? formError : undefined) ?? takenError
  const ageError = age ? undefined : '연령대를 골라주세요'
  /* 확인을 받아야 넘어간다. 안 받고 제출하면 서버가 튕겨내는데,
     그때 알려주면 이미 다음 화면을 기대하고 있던 사람이 되돌아온다 */
  const ok = !nickError && !ageError && !!fresh?.free

  const check = () => {
    if (formError || checking) return
    setChecking(true)
    /* API 가 붙으면 여기서 GET 한다. 지금은 '덕모임' 만 이미 있는
       이름으로 흉내낸다 */
    setTimeout(() => {
      setChecking(false)
      setChecked({ name: nick.trim(), free: nick.trim() !== '덕모임' })
    }, 450)
  }

  const submit = () => {
    setTried(true)
    if (!ok) return
    setSending(true)
    /* API 가 붙으면 여기서 PATCH 한다. 409 가 오면 setChecked 로
       그 이름을 쓰인 것으로 표시한다 */
    setTimeout(() => {
      setSending(false)
      /* replace 다. push 면 뒤로가기가 방금 채운 가입 화면으로
         되돌아가고, 거기서 또 뒤로 가면 로그인이 나온다 */
      router.replace(next)
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

        {/* 중복 확인은 입력칸 오른쪽에 붙인다. 지금 친 값을 두고
            누르는 버튼이라 눈이 값에서 버튼으로 바로 넘어간다.
            라벨 옆에 두면 값과 버튼 사이에 입력칸 하나가 끼어든다 */}
        <Field
          label="닉네임"
          error={shownError}
          /* 확인을 받았으면 그 결과가 안내를 대신한다 */
          hint={fresh?.free ? '쓸 수 있는 닉네임이에요' : '다른 사람에게 이렇게 보여요'}
          count={[nick.trim().length, 10]}
        >
          <TextInput
            placeholder="덕질하는오리"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={12}
            after={
              <Button
                size="sm"
                tone="ghost"
                disabled={!!formError || checking}
                onClick={check}
              >
                {checking ? '확인 중…' : '중복 확인'}
              </Button>
            }
          />
        </Field>

        {/* 미성년을 빼기로 한 기본값을 따른다. 허용으로 바뀌면
            AGES 에 줄을 더한다 */}
        <Field label="연령대" error={tried ? ageError : undefined}>
          <Select value={age} onChange={(e) => setAge(e.target.value)}>
            <option value="" disabled>골라주세요</option>
            {AGES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </Field>

        <div className="form__foot">
          <Button block disabled={sending} onClick={submit}>
            {sending ? '저장하는 중…' : '시작하기'}
          </Button>
          {tried && !fresh?.free && !nickError && (
            <p className="form__note">닉네임 중복 확인을 먼저 눌러주세요</p>
          )}
        </div>
      </div>
    </PageShell>
  )
}
