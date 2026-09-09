'use client'

/**
 * 휴대전화 인증 (AU-13).
 *
 * **이 화면이 있어야 채팅을 넣을 수 있다.** 여성가족부 고시가 요구하는
 * 기술적 조치 셋 중 첫째다 — 「실명 인증 또는 휴대전화 인증을 통한
 * 회원관리」. 하나라도 빠지면 청소년유해매체물로 지정돼 ⑲금 표시와
 * 별도 성인인증 의무가 붙고, 그러면 만 14세 이상을 받는 우리 정책
 * (AU-05)과 정면으로 부딪힌다. 자세한 것은 docs/SPEC-S3.md 2장.
 *
 * 그래서 이 화면은 편의 기능이 아니라 **관문**이다. 건너뛰기를 두지
 * 않는 이유이고, 대신 왜 필요한지를 맨 위에서 먼저 말한다. 번호를
 * 달라고만 하면 사람들은 안 준다.
 *
 * 단계는 둘이다. 번호 → 인증번호. 한 화면에서 아래로 이어 붙인다.
 * 화면을 나누면 뒤로가기로 번호를 고치러 갈 때 인증번호가 날아간다.
 *
 * 서버가 아직 없다. 아래 mock 자리에 API 를 끼운다.
 */
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Basics'
import { Field, TextInput } from '@/components/ui/Field'
import { wf } from '@/lib/wireframe'

/** 인증번호 유효 시간. 서버와 같은 값이어야 한다 */
const LIVE_SEC = 180
/** 재발송 쿨다운. SMS 는 한 통이 곧 요금이다 (NF-03) */
const RESEND_SEC = 60
/** 이 횟수를 넘기면 번호 기준으로 잠근다 */
const MAX_TRY = 5

/** 숫자만 남기고 11자리로 자른다 */
function onlyNum(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
}

/** '01012345678' → '010-1234-5678'. 보이는 값만 예쁘게 한다 */
function dashed(v: string) {
  if (v.length < 4) return v
  if (v.length < 8) return `${v.slice(0, 3)}-${v.slice(3)}`
  return `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7)}`
}

function mmss(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default function Verify() {
  const router = useRouter()
  const params = useSearchParams()
  /* 인증을 마치면 돌아갈 곳. 채팅을 누르다 들어온 사람은 그 방으로
     돌아가야지 홈으로 떨어지면 처음부터 다시 찾아가야 한다 */
  const next = params.get('next') ?? wf('/chat')

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  /* 보냈는가. 보내기 전에는 인증번호 칸 자체가 없다 */
  const [sent, setSent] = useState(false)
  const [left, setLeft] = useState(0)
  const [cool, setCool] = useState(0)
  const [tries, setTries] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const locked = tries >= MAX_TRY
  const expired = sent && left === 0
  const phoneOk = /^01\d{8,9}$/.test(phone)

  /* 남은 시간과 쿨다운을 1초마다 함께 줄인다. 타이머를 둘 두면
     탭이 백그라운드로 갔다 올 때 서로 어긋난다 */
  useEffect(() => {
    if (left === 0 && cool === 0) return
    const t = setInterval(() => {
      setLeft((v) => (v > 0 ? v - 1 : 0))
      setCool((v) => (v > 0 ? v - 1 : 0))
    }, 1000)
    return () => clearInterval(t)
  }, [left, cool])

  const send = () => {
    if (!phoneOk || cool > 0 || busy) return
    setBusy(true)
    setErr(null)
    /* API 자리. POST /api/v1/users/me/phone/code { phone } */
    setTimeout(() => {
      setBusy(false)
      setSent(true)
      setCode('')
      setTries(0)
      setLeft(LIVE_SEC)
      setCool(RESEND_SEC)
    }, 500)
  }

  const submit = () => {
    if (code.length !== 6 || busy || locked) return
    setBusy(true)
    setErr(null)
    /* API 자리. POST /api/v1/users/me/phone/verify { phone, code }
       실패 응답은 errors.ts 의 slotFor 를 지나 문장이 된다 */
    setTimeout(() => {
      setBusy(false)
      /* 목업이라 000000 만 튕겨낸다. 실패 흐름을 눈으로 보려고 남긴다 */
      if (code === '000000') {
        setTries((n) => n + 1)
        setErr('인증번호가 맞지 않아요')
        return
      }
      router.replace(next)
    }, 500)
  }

  return (
    <PageShell title="휴대전화 인증">
      <div className="vfy">
        {/* 번호를 달라고만 하면 사람들은 안 준다. 무엇 때문에 받는지를
            먼저 말한다. 「본인확인」 같은 말로 뭉뚱그리지 않는다 */}
        <p className="vfy__lead">
          채팅을 쓰려면 번호 확인이 한 번 필요해요.
          <br />
          <b>번호는 다른 사람에게 보이지 않습니다.</b>
        </p>

        <div className="form">
          <Field label="휴대전화 번호" required>
            <TextInput
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="010-1234-5678"
              value={dashed(phone)}
              onChange={(e) => setPhone(onlyNum(e.target.value))}
              disabled={busy}
              after={
                <Button
                  size="sm"
                  tone={sent ? 'ghost' : 'primary'}
                  disabled={!phoneOk || cool > 0 || busy}
                  onClick={send}
                >
                  {cool > 0 ? `${cool}초 뒤` : sent ? '다시 받기' : '인증번호 받기'}
                </Button>
              }
            />
          </Field>

          {sent && (
            <Field
              label="인증번호"
              required
              /* 남은 시간을 라벨 오른쪽에 붙인다. 칸 아래 안내 줄에 두면
                 오류 문장과 자리를 다투다 둘 중 하나가 사라진다 */
              suffix={expired ? '만료됨' : `${mmss(left)} 남음`}
              error={
                locked
                  ? '5번 틀렸어요. 인증번호를 다시 받아주세요'
                  : expired
                    ? '시간이 지났어요. 다시 받아주세요'
                    : (err ?? undefined)
              }
              hint="문자로 받은 6자리를 넣어주세요"
            >
              {/* autoFocus 로 보내자마자 커서를 여기 둔다. 문자를 확인하고
                  돌아온 사람이 칸을 또 눌러야 하면 탭이 한 번 더 든다 */}
              <TextInput
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={busy || locked || expired}
              />
            </Field>
          )}

          <div className="form__foot">
            <Button
              block
              disabled={!sent || code.length !== 6 || busy || locked || expired}
              onClick={submit}
            >
              {busy ? '확인하는 중…' : '확인'}
            </Button>
          </div>
        </div>

        {/* 왜 이걸 받는지의 근거. 화면 맨 아래에 작게 둔다. 처음 보는
            사람에게는 위의 한 줄이면 되고, 따져 묻는 사람에게는 이게
            필요하다 */}
        <p className="vfy__why">
          청소년보호법에 따라 대화 서비스를 제공하려면 휴대전화 인증이 필요합니다.
          받은 번호는 같은 사람인지 확인하는 데만 쓰고 프로필에 보이지 않습니다.
        </p>
      </div>
    </PageShell>
  )
}
