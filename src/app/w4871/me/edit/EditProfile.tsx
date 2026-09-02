'use client'

/**
 * 프로필 수정.
 *
 * 당근 비즈프로필 만들기의 배치를 따랐다. 사진이 가운데 크게,
 * 그 아래 왜 넣으면 좋은지 한 줄, 그다음 입력 칸들, 완료는 헤더
 * 오른쪽이다.
 *
 * 사진을 맨 위 가운데 두는 이유가 있다. 프로필에서 남이 먼저 보는
 * 것이 사진이고, 폼 중간에 끼워 넣으면 이름·소개와 같은 무게로
 * 읽혀 비어 있어도 그런가 보다 하고 넘어간다.
 *
 * 고칠 수 있는 것은 셋뿐이다. 사진 · 닉네임 · 한줄소개.
 * 출생연도는 여기서 못 고친다. 만 14세 미만 차단에 쓰는 값이라 가입 때
 * 한 번 받고 잠근다. 성별은 아예 받지 않는다.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Button, Sheet } from '@/components/ui/Basics'
import { Field, TextInput, TextArea } from '@/components/ui/Field'

/* 로그인이 없어 내 정보를 서버에서 못 받는다. 붙으면 지운다 */
const ME = {
  nickname: '덕질하는오리',
  imageUrl: '/avatar/a1.webp',
  bio: '팝업이랑 생카 자주 다녀요. 오픈런도 곧잘 합니다.',
  age: '1999년',
}

/** 가입 때와 같은 규칙이다. 두 화면이 다르게 굴면 한쪽에서 통과한
 *  이름이 다른 쪽에서 막힌다 */
function checkNick(v: string) {
  const s = v.trim()
  if (!s) return '닉네임을 정해주세요'
  if (s.length < 2) return '2자 이상이어야 해요'
  if (s.length > 10) return '10자를 넘었어요'
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(s)) return '한글·영문·숫자·밑줄만 쓸 수 있어요'
  return undefined
}

export default function EditProfile() {
  const router = useRouter()
  const [nick, setNick] = useState(ME.nickname)
  const [bio, setBio] = useState(ME.bio)
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [ask, setAsk] = useState(false)

  /* 이름을 바꿨을 때만 중복을 다시 확인한다. 안 바꿨으면 이미 내 것이다 */
  const renamed = nick.trim() !== ME.nickname
  const [checked, setChecked] = useState<{ name: string; free: boolean } | null>(null)
  const [checking, setChecking] = useState(false)
  const fresh = checked && checked.name === nick.trim() ? checked : null

  const formError = checkNick(nick)
  const takenError = fresh && !fresh.free ? '이미 쓰고 있는 닉네임이에요' : undefined
  const shownError = (tried ? formError : undefined) ?? takenError

  const dirty = renamed || bio !== ME.bio
  const ok = !formError && !takenError && (!renamed || !!fresh?.free)

  const check = () => {
    if (formError || checking) return
    setChecking(true)
    setTimeout(() => {
      setChecking(false)
      setChecked({ name: nick.trim(), free: nick.trim() !== '덕모임' })
    }, 450)
  }

  const save = () => {
    setTried(true)
    if (!ok) return
    setSending(true)
    /* API 가 붙으면 여기서 PATCH 한다 */
    setTimeout(() => {
      setSending(false)
      router.back()
    }, 500)
  }

  return (
    <PageShell
      title="프로필 수정"
      onBack={() => (dirty ? setAsk(true) : router.back())}
      right={
        <Button size="sm" tone="ghost" disabled={sending} onClick={save}>
          {sending ? '저장 중…' : '완료'}
        </Button>
      }
    >
      {/* 사진이 맨 위 가운데다. 프로필에서 남이 먼저 보는 것이 사진이라
          폼 중간에 끼워 넣으면 비어 있어도 넘어가게 된다 */}
      <div className="pedit__pic">
        <label className="myid__pic">
          <Avatar name={nick || ME.nickname} src={ME.imageUrl} lg />
          <span className="myid__cam" aria-hidden>
            <svg viewBox="0 0 16 16">
              <path
                d="M2.6 4.8h2.2l.9-1.4h4.6l.9 1.4h2.2v7.2H2.6z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="8.4" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          <input type="file" accept="image/*" hidden />
        </label>
        <p className="pedit__hint">사진을 넣으면 같이 가자는 말을 더 많이 듣습니다</p>
      </div>

      <div className="form">
        <Field
          label="닉네임"
          error={shownError}
          hint={
            !renamed
              ? '지금 쓰는 이름이에요'
              : fresh?.free
                ? '쓸 수 있는 닉네임이에요'
                : '이름을 바꾸면 중복 확인이 필요해요'
          }
          count={[nick.trim().length, 10]}
        >
          <TextInput
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={12}
            after={
              /* 안 바꿨으면 확인할 것이 없다. 버튼을 늘 살려두면
                 누를 이유가 없는데 누르게 된다 */
              renamed ? (
                <Button size="sm" tone="ghost" disabled={!!formError || checking} onClick={check}>
                  {checking ? '확인 중…' : '중복 확인'}
                </Button>
              ) : undefined
            }
          />
        </Field>

        <Field
          label="한줄소개"
          optional
          hint="어떤 행사를 좋아하는지 적으면 말을 걸기 쉬워져요"
          count={[bio.length, 60]}
        >
          <TextArea
            placeholder="팝업이랑 생카 자주 다녀요"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
          />
        </Field>

        {/* 출생연도는 못 고친다. 만 14세 미만 차단에 쓰는 값이라 가입 때 한 번
            받고 잠근다. 칸을 숨기지 않고 잠긴 채로 보여주는 것은,
            없으면 어디서 고치는지 찾아 헤매기 때문이다 */}
        <Field label="출생연도" disabled hint="가입할 때 정한 값이라 바꿀 수 없어요">
          <TextInput value={ME.age} disabled readOnly />
        </Field>
      </div>

      {ask && (
        <Sheet
          title="그만둘까요?"
          desc="고친 내용은 저장되지 않아요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(false)}>이어서 고치기</Button>
              <Button tone="danger" onClick={() => router.back()}>그만두기</Button>
            </>
          }
        />
      )}
    </PageShell>
  )
}
