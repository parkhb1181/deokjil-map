'use client'

/**
 * 프로필 수정 (AU-08).
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
 *
 * ─────────────────────────────────────────────────────────
 * **둘로 나눠 두었다.**
 *
 * 받아오는 것과 고치는 것이다. 한 컴포넌트에 두면 폼 상태를 서버 응답이
 * 온 뒤에 채워 넣어야 하는데, 그러면 「아직 안 온 값」 과 「사용자가 지운
 * 값」 이 둘 다 빈 문자열이라 구분이 안 된다. 값이 확정된 뒤에 폼을
 * 세우면 그 문제가 없다.
 */
import { useEffect, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Blank, Button, Sheet, Skeleton } from '@/components/ui/Basics'
import { Field, TextInput, TextArea } from '@/components/ui/Field'
import { USE_API } from '@/lib/api/config'
import { slotFor } from '@/lib/api/errors'
import { ApiFailure } from '@/lib/api/http'
import {
  checkNickname,
  fetchMe,
  updateProfile,
  uploadProfileImage,
  type ProfileEdit,
} from '@/lib/api/users'
import { authed } from '@/lib/auth/authed'
import { shrinkImage } from '@/lib/image-shrink'
import { getAccessToken } from '@/lib/auth/session'
import { wf } from '@/lib/wireframe'

/** 폼이 세워질 때 필요한 값 */
type Initial = {
  nickname: string
  bio: string
  /**
   * 출생연도.
   *
   * **서버가 안 준다.** `/users/me` 가 일부러 뺐다 — 가입 때 나이 판정에만
   * 쓰고 어느 응답에도 안 싣는 값이다. 그래서 API 를 붙이면 이 칸이 빈다.
   * 칸을 없애지 않는 것은, 없으면 「출생연도는 어디서 고치지」 를 찾아
   * 헤매기 때문이다. 왜 비어 있는지는 아래 hint 가 말한다.
   */
  birthYear?: string
}

/* 서버가 없을 때 세우는 값 */
const MOCK: Initial = {
  nickname: '덕질하는오리',
  bio: '팝업이랑 생카 자주 다녀요. 오픈런도 곧잘 합니다.',
  birthYear: '1999년',
}

/** 한줄소개 상한. 서버는 100자까지 받지만 프로필 카드가 그만큼 못 담는다 */
const BIO_MAX = 60

/*
 * 사진 형식·크기를 여기서 재지 않는다.
 *
 * 예전에는 서버 제한(jpeg · png · webp, 5MB — AU-08)을 그대로 두고
 * 어기면 안내를 띄웠다. 그런데 폰에서 고른 사진은 그 둘을 거의 항상
 * 어겨서(아이폰 HEIC · 한 장 4~8MB) 안내만 뜨고 아무도 못 올렸다.
 * 지금은 올리기 전에 512px jpeg 로 줄여 보낸다 (image-shrink.ts).
 */

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

/* ── 받아오는 쪽 ─────────────────────────────────────────── */

type Load =
  | { k: 'loading' }
  | { k: 'guest' }
  | { k: 'failed'; text: string }
  | { k: 'ok'; initial: Initial; imageUrl: string | null }

export default function EditProfile() {
  const router = useRouter()
  const [load, setLoad] = useState<Load>(() =>
    USE_API ? { k: 'loading' } : { k: 'ok', initial: MOCK, imageUrl: '/avatar/a1.webp' },
  )

  useEffect(() => {
    if (!USE_API) return
    if (!getAccessToken()) {
      setLoad({ k: 'guest' })
      return
    }

    let alive = true
    authed(fetchMe)
      .then((me) => {
        if (!alive) return
        /* 가입을 안 끝냈으면 고칠 프로필이 아직 없다. 가입 화면이 먼저다 */
        if (!me.signupCompleted) {
          router.replace(wf('/welcome'))
          return
        }
        setLoad({
          k: 'ok',
          initial: { nickname: me.nickname ?? '', bio: me.bio ?? '' },
          imageUrl: me.profileImageUrl,
        })
      })
      .catch((e) => {
        if (!alive) return
        const slot = slotFor(e)
        setLoad(slot.at === 'login' ? { k: 'guest' } : { k: 'failed', text: slot.text })
      })

    return () => {
      alive = false
    }
  }, [router])

  if (load.k === 'loading') {
    return (
      <PageShell title="프로필 수정">
        <div className="form">
          <Skeleton h={96} />
          <Skeleton h={72} />
          <Skeleton h={96} />
        </div>
      </PageShell>
    )
  }

  if (load.k === 'guest') {
    return (
      <PageShell title="프로필 수정">
        <Blank
          title="로그인이 필요해요"
          desc="내 프로필은 로그인한 뒤에 고칠 수 있어요"
          action={
            <Button
              size="sm"
              tone="kakao"
              onClick={() => router.push(wf(`/login?next=${encodeURIComponent(wf('/me/edit'))}`))}
            >
              로그인
            </Button>
          }
        />
      </PageShell>
    )
  }

  if (load.k === 'failed') {
    return (
      <PageShell title="프로필 수정">
        <Blank
          title="불러오지 못했어요"
          desc={load.text}
          action={
            <Button size="sm" tone="ghost" onClick={() => location.reload()}>
              다시 시도
            </Button>
          }
        />
      </PageShell>
    )
  }

  return <Form initial={load.initial} imageUrl={load.imageUrl} />
}

/* ── 고치는 쪽 ───────────────────────────────────────────── */

function Form({ initial, imageUrl }: { initial: Initial; imageUrl: string | null }) {
  const router = useRouter()
  const [nick, setNick] = useState(initial.nickname)
  const [bio, setBio] = useState(initial.bio)
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [ask, setAsk] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  /* 사진은 폼과 따로 논다. 고르는 즉시 올라가고 완료를 안 눌러도 반영된다 */
  const [pic, setPic] = useState(imageUrl)
  const [uploading, setUploading] = useState(false)

  /* 이름을 바꿨을 때만 중복을 다시 확인한다. 안 바꿨으면 이미 내 것이다 */
  const renamed = nick.trim() !== initial.nickname
  const [checked, setChecked] = useState<{ name: string; free: boolean } | null>(null)
  const [checking, setChecking] = useState(false)
  const fresh = checked && checked.name === nick.trim() ? checked : null

  const formError = checkNick(nick)
  const takenError = fresh && !fresh.free ? '이미 쓰고 있는 닉네임이에요' : undefined
  const shownError = (tried ? formError : undefined) ?? takenError

  const dirty = renamed || bio !== initial.bio
  const ok = !formError && !takenError && (!renamed || !!fresh?.free)

  /**
   * 사진을 고르면 바로 올린다.
   *
   * **완료 버튼을 기다리지 않는다.** 사진은 서버를 세 번 오가는 일이라
   * 저장에 묶으면 완료를 누른 뒤 한참 멈춰 있게 된다. 그리고 사진만
   * 바꾸러 온 사람이 완료를 안 누르고 나가는 일이 실제로 생긴다.
   *
   * 올린 뒤 주소를 `/users/me` 로 다시 읽는다. 확정 응답에 주소가 없다 —
   * 클라이언트가 임의 URL 을 박을 수 있게 되기 때문이다 (결정 D-2).
   */
  const pickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    /* 값을 비워야 같은 파일을 다시 고를 수 있다. 실패하고 그대로 다시
       고르면 change 가 안 나서 아무 일도 안 일어난다 */
    e.target.value = ''
    if (!file || uploading) return

    setUploading(true)
    setFailed(null)

    /*
     * **고른 사진을 그대로 안 보낸다.** 512px jpeg 로 줄여서 보낸다
     * (image-shrink.ts).
     *
     * 서버가 받는 것은 jpeg · png · webp 셋이고 5MB 까지인데, 요즘 폰
     * 사진은 둘을 동시에 어긴다 — 아이폰 기본이 HEIC 이고 안드로이드도
     * 한 장이 4~8MB 다. 형식과 크기를 여기서 우리가 정하면 그 두 안내가
     * 아예 안 뜬다.
     *
     * 못 읽는 사진일 때만 예전 안내를 띄운다. 안드로이드 크롬이 HEIC 을
     * 디코딩 못 하는 경우가 있는데, 그때 원본을 그냥 올리면 서버가 막아서
     * 같은 자리에서 더 어려운 말이 나온다.
     */
    shrinkImage(file)
      .catch(() => {
        throw new ApiFailure(
          'PROFILE_IMAGE_UNREADABLE',
          '이 사진은 읽을 수 없어요. JPG · PNG 로 저장해서 다시 올려주세요',
          0,
        )
      })
      .then((small) => authed((t) => uploadProfileImage(small, t)))
      .then(() => authed(fetchMe))
      .then((me) => setPic(me.profileImageUrl))
      .catch((err) => setFailed(slotFor(err).text))
      .finally(() => setUploading(false))
  }

  const check = () => {
    if (formError || checking) return
    const name = nick.trim()
    setChecking(true)
    setFailed(null)

    if (!USE_API) {
      /* 서버가 없을 때. '덕모임' 만 이미 있는 이름으로 흉내낸다 */
      setTimeout(() => {
        setChecking(false)
        setChecked({ name, free: name !== '덕모임' })
      }, 450)
      return
    }

    authed((t) => checkNickname(name, t))
      .then((free) => setChecked({ name, free }))
      .catch((e) => setFailed(slotFor(e).text))
      .finally(() => setChecking(false))
  }

  const save = () => {
    setTried(true)
    if (!ok) return
    setSending(true)
    setFailed(null)

    if (!USE_API) {
      setTimeout(() => {
        setSending(false)
        router.back()
      }, 500)
      return
    }

    /*
     * **안 바꾼 칸은 안 보낸다.** 여기는 이름 그대로 부분 수정이라 보낸
     * 것만 바뀐다. 안 고친 값을 굳이 실어 보내면, 그 사이 다른 기기에서
     * 고친 값을 이쪽 화면이 들고 있던 옛 값으로 덮는다.
     */
    const body: ProfileEdit = {}
    if (renamed) body.nickname = nick.trim()
    if (bio !== initial.bio) body.bio = bio.trim()

    authed((t) => updateProfile(body, t))
      .then(() => router.back())
      .catch((e) => {
        setSending(false)
        const slot = slotFor(e)
        /*
         * 확인과 저장 사이에 남이 그 이름을 채 갔다 (I-01). 확인 결과를
         * 지워 다시 확인하게 만든다 — 안 그러면 「확인됨」 표시가 남아
         * 눌러도 같은 자리에서 계속 막힌다. 가입 화면과 같은 처리다.
         */
        if (slot.at === 'field' && slot.field === 'nickname') {
          setChecked({ name: nick.trim(), free: false })
        }
        setFailed(slot.text)
      })
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
      {/* 칸을 못 짚는 실패. 폼 맨 위다 (가입·모집글 폼과 같은 자리) */}
      {failed && (
        <p className="form__failed" role="alert">
          {failed}
        </p>
      )}

      {/* 사진이 맨 위 가운데다. 프로필에서 남이 먼저 보는 것이 사진이라
          폼 중간에 끼워 넣으면 비어 있어도 넘어가게 된다 */}
      <div className="pedit__pic">
        {/* **label 이 아니라 div 다.**

            투명한 파일 입력을 사진 위에 덮어 두었는데, 그것을 label 로
            감싸면 한 번의 누름이 두 번 열린다 — 입력이 스스로 열고,
            그 클릭이 label 까지 올라가 label 이 입력을 한 번 더 연다.
            브라우저에 따라 두 번째가 첫 번째를 덮어써서 고른 파일이
            버려진다. 누르는 자리를 입력 하나로 둔다 */}
        <div className="myid__pic">
          <Avatar name={nick || initial.nickname} src={pic ?? undefined} lg />
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
          {/* **`image/*` 로 연다.**

              전에는 서버가 받는 셋(jpeg · png · webp)만 열어 두었다.
              그런데 사진첩에서 고르는 것은 대부분 그 셋이 아니다 — iOS 는
              기본이 HEIC 이라 사진 대부분이 회색으로 잠겨 보이고, 고를 수
              있는 것만 고르면 이번엔 크기에서 막혔다.

              지금은 고른 것을 512px jpeg 로 줄여 보내므로(pickPhoto) 형식과
              크기를 우리가 정한다. 못 읽는 사진일 때만 안내가 뜬다 */}
          {/* **`hidden` 으로 숨기지 않는다.**

              `hidden` 은 `display: none` 이고, 그 상태의 파일 입력은
              감싼 label 을 눌러도 사진첩이 안 열리는 브라우저가 있다
              (모바일 사파리에서 알려진 문제). 아무 일도 안 일어나므로
              쓰는 사람에게는 기능이 없는 것과 같다.

              대신 **투명하게 만들어 사진 위를 덮는다.** 누르는 것이
              label 이 아니라 입력 자신이라 중간에 아무것도 끼지 않는다 */}
          <input
            className="myid__file"
            type="file"
            accept="image/*"
            /* 목데이터 경로에는 올릴 서버가 없다 */
            disabled={!USE_API || uploading}
            onChange={pickPhoto}
            aria-label="프로필 사진 바꾸기"
          />
        </div>
        <p className="pedit__hint">
          {uploading ? '사진을 올리는 중이에요' : '사진을 넣으면 같이 가자는 말을 더 많이 듣습니다'}
        </p>
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
          count={[bio.length, BIO_MAX]}
        >
          {/* 세는 값과 막는 값을 같게 둔다. 세기만 하고 안 막으면 넘긴
              채로 저장되고, 그러면 카드에서 잘린다 */}
          <TextArea
            placeholder="팝업이랑 생카 자주 다녀요"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={BIO_MAX}
            rows={2}
          />
        </Field>

        {/* 출생연도는 못 고친다. 만 14세 미만 차단에 쓰는 값이라 가입 때 한 번
            받고 잠근다. 칸을 숨기지 않고 잠긴 채로 보여주는 것은,
            없으면 어디서 고치는지 찾아 헤매기 때문이다 */}
        <Field
          label="출생연도"
          disabled
          hint={
            initial.birthYear
              ? '가입할 때 정한 값이라 바꿀 수 없어요'
              : '가입할 때 확인했어요. 화면에는 보여드리지 않아요'
          }
        >
          <TextInput value={initial.birthYear ?? ''} disabled readOnly />
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
