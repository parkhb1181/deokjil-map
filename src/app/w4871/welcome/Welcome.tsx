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
 * 거를 일이 없어졌다. 남은 이유는 미성년 차단 하나인데 그건 나이만으로
 * 된다. 쓰지도 않을 것을 받아두면 유출됐을 때 잃을 것만 늘어난다.
 *
 * **연령대 선택을 출생연도로 바꿨다.** 전에는 「20대 초반」 부터 시작하는
 * 목록이라 10대가 고를 것이 없었다. 막힌 것처럼 보이지만 실제로는
 * 열일곱이 「20대 초반」 을 누르면 그만이었다. 막지도 못하고 기록도
 * 남지 않는 쪽이 제일 나쁘다. 연도를 받으면 판정이 서버에서 되고
 * 거절 사유를 본인에게 말해줄 수 있다.
 */
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Basics'
import { Field, TextInput, Select } from '@/components/ui/Field'

/**
 * 가입 하한. **만 나이** 기준이다.
 *
 * 만 14세 미만은 법정대리인의 동의를 받고 그 동의를 확인해야 개인정보를
 * 처리할 수 있는데(개인정보보호법 제22조의2) 그 절차가 우리에게 없다.
 * 그래서 받지 않는다.
 *
 * **이건 우리가 고른 선이 아니라 법이 그은 선이라 더 내릴 수 없다.**
 * 올리는 것은 제품 판단이다.
 */
const MIN_AGE = 14

/**
 * 실제로 비교하는 값. 연 나이 기준이라 하한보다 하나 크다.
 *
 * 출생연도만 받으면 만 나이를 알 수 없다. 생일이 지났는지 모르기
 * 때문이다. 연 나이(올해 − 출생연도)는 만 나이보다 같거나 하나 크므로,
 * 연 나이 14 를 통과시키면 그 안에 만 13 세가 섞인다.
 *
 * 그래서 하나 올려 잡는다. 대신 올해 생일이 이미 지난 만 14 세가 그
 * 해 동안 막힌다. **뚫리는 것보다 과차단이 낫다는 판단이다.** 통과는
 * 되돌릴 수 없고 과차단은 문의로 풀 수 있다.
 *
 * 생년월일까지 받으면 정확해지지만, 판정에만 쓰고 화면 어디에도 안
 * 쓰는 월·일을 받게 된다. 최소수집과 맞바꾼 정확도다.
 */
const MIN_BIRTH_AGE = MIN_AGE + 1

/** 고를 수 있는 가장 오래된 출생연도. 목록 길이를 정하는 값일 뿐이다 */
const OLDEST = 80

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
  const [birth, setBirth] = useState('')
  const [tried, setTried] = useState(false)

  /* 올해는 useEffect 에서 확정한다. 서버 프리렌더 시점은 빌드 시각이라
     그대로 쓰면 12월에 빌드한 것이 해가 바뀐 뒤 목록과 나이 계산을
     한 해씩 어긋나게 한다 (CLAUDE.md) */
  const [thisYear, setThisYear] = useState<number | null>(null)
  useEffect(() => setThisYear(new Date().getFullYear()), [])
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

  /* 고를 수 있는 연도. 올해부터 거꾸로 편다. 자기 연도가 목록 위쪽에
     있는 사람이 드물어 최근 연도를 앞에 두는 편이 덜 굴린다 */
  const years =
    thisYear === null ? [] : Array.from({ length: OLDEST + 1 }, (_, i) => thisYear - i)

  /** 연 나이. 올해 − 출생연도 */
  const age = thisYear !== null && birth ? thisYear - Number(birth) : null

  /** 가입할 수 있는 가장 늦은 출생연도. 사람에게는 이 값으로 말한다 */
  const maxYear = thisYear === null ? null : thisYear - MIN_BIRTH_AGE

  /**
   * 나이 때문에 막힌 것은 「고르라」 가 아니라 「왜 안 되는지」 를 말한다.
   *
   * 목록에서 미달 연도를 빼버리면 고를 것이 없어 화면이 고장난 것처럼
   * 보이고, 결국 아무 연도나 누르게 된다. 고르게 두고 사유를 말하는 편이
   * 낫다. 서버도 같은 판정을 한다. 화면은 먼저 알려주는 역할일 뿐이다.
   *
   * 문구에 「만 14세」 대신 연도를 적는 이유는, 연 나이로 판정하는 탓에
   * 올해 생일이 지난 만 14 세가 막히기 때문이다. 「만 14세 이상만」 이라고
   * 적으면 그 사람은 자기가 왜 막혔는지 알 수 없다. 연도로 말하면 어긋날
   * 일이 없다.
   */
  const birthError = !birth
    ? '출생연도를 골라주세요'
    : age !== null && age < MIN_BIRTH_AGE
      ? `${maxYear}년생까지 가입할 수 있어요`
      : undefined

  /* 확인을 받아야 넘어간다. 안 받고 제출하면 서버가 튕겨내는데,
     그때 알려주면 이미 다음 화면을 기대하고 있던 사람이 되돌아온다 */
  const ok = !nickError && !birthError && !!fresh?.free

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
          닉네임과 출생연도만 정하면 바로 쓸 수 있어요.
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

        {/* 나이 때문에 막힌 것은 눌러본 뒤가 아니라 고른 즉시 알린다.
            형식 오류와 달리 고쳐 쓸 수 있는 값이 아니라, 제출까지
            기다리게 하면 헛수고를 시키는 셈이다 */}
        <Field
          label="출생연도"
          error={tried || (birth && age !== null && age < MIN_BIRTH_AGE) ? birthError : undefined}
          hint={
            maxYear
              ? `${maxYear}년생까지 가입할 수 있어요. 나이는 공개되지 않아요`
              : '나이는 공개되지 않아요'
          }
        >
          <Select
            value={birth}
            disabled={thisYear === null}
            onChange={(e) => setBirth(e.target.value)}
          >
            <option value="" disabled>
              골라주세요
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
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
