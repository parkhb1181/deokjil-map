'use client'

/**
 * 알림 설정 (NT-11 · NT-15).
 *
 * 두 층이다. 위는 **이 기기로 푸시를 받을지** (브라우저 구독), 아래는
 * **어떤 종류를 받을지** (서버 설정, 기기와 무관). 종류를 다 꺼도 알림함에는
 * 안 쌓이고 푸시도 안 온다 — 종류 설정이 알림 자체를 만드는 단계에서
 * 걸러진다 (NT-11).
 *
 * **전체 끄기 하나만 두지 않는다.** 댓글은 받고 채팅은 안 받고 싶은 사람이
 * 있고, 그 반대도 있다.
 *
 * 스위치는 화면부터 바꾸고 서버가 뒤따른다. 실패하면 되돌리고 한 줄
 * 알린다 — 스위치가 눌린 채 서버만 옛값이면 「껐는데 왜 오지」 가 된다.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Blank, Button } from '@/components/ui/Basics'
import { wf } from '@/lib/wireframe'
import { ApiFailure } from '@/lib/api/http'
import { slotFor } from '@/lib/api/errors'
import { fetchSettings, updateSettings, type NotificationSettings } from '@/lib/api/notifications'
import { authed } from '@/lib/auth/authed'
import { PUSH_READY, askPermission, isOn, permission, register, subscribe, support, unsubscribe } from '@/lib/push'

const KINDS: { key: keyof NotificationSettings; label: string; desc: string }[] = [
  { key: 'postCommented', label: '내 모집글에 댓글', desc: '방장으로서 받는 알림' },
  { key: 'commentReplied', label: '내 댓글에 답글', desc: '내가 단 댓글에 답이 왔을 때' },
  { key: 'roomMessaged', label: '채팅방 새 메시지', desc: '보고 있는 방에서는 오지 않아요' },
]

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`sw${on ? ' sw--on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="sw__knob" />
    </button>
  )
}

export default function Settings() {
  const [kinds, setKinds] = useState<NotificationSettings | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'guest' | 'error'>('loading')
  const [failed, setFailed] = useState<string | null>(null)
  /* 이 기기의 푸시. null 은 아직 안 봄, 'na' 는 이 브라우저에선 안 됨 */
  const [push, setPush] = useState<boolean | 'na' | null>(null)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    let alive = true
    authed((t) => fetchSettings(t))
      .then((s) => {
        if (!alive) return
        setKinds(s)
        setState('ready')
      })
      .catch((e: unknown) => {
        if (!alive) return
        setState(e instanceof ApiFailure && e.code === 'NOT_SIGNED_IN' ? 'guest' : 'error')
      })
    if (!PUSH_READY || support() !== 'ok') setPush('na')
    else isOn().then((v) => alive && setPush(v)).catch(() => alive && setPush(false))
    return () => {
      alive = false
    }
  }, [])

  const flipKind = (key: keyof NotificationSettings, v: boolean) => {
    if (!kinds) return
    const before = kinds
    const next = { ...kinds, [key]: v }
    setKinds(next)
    setFailed(null)
    authed((t) => updateSettings(next, t)).catch((e: unknown) => {
      setKinds(before)
      setFailed(slotFor(e).text)
    })
  }

  const flipPush = async (v: boolean) => {
    setPushBusy(true)
    setFailed(null)
    try {
      if (v) {
        /* 권한은 이 손 안에서 묻는다 (lib/push.ts) */
        if (permission() !== 'granted' && (await askPermission()) !== 'granted') {
          setFailed('브라우저에서 알림이 차단돼 있어요. 주소창 옆 자물쇠에서 허용해주세요')
          return
        }
        const sub = await subscribe()
        if (!sub) throw new Error('no-subscription')
        await register(sub)
        setPush(true)
      } else {
        await unsubscribe()
        setPush(false)
      }
    } catch (e: unknown) {
      setFailed(e instanceof ApiFailure ? slotFor(e).text : '지금은 바꿀 수 없어요. 잠시 뒤 다시 시도해주세요')
    } finally {
      setPushBusy(false)
    }
  }

  let body
  if (state === 'loading') body = <p className="croom__state">불러오는 중…</p>
  else if (state === 'guest')
    body = (
      <Blank
        title="로그인하면 알림을 설정할 수 있어요"
        action={
          <Link className="btn btn--primary btn--sm" href={wf('/login')}>
            로그인
          </Link>
        }
      />
    )
  else if (state === 'error' || !kinds)
    body = (
      <Blank
        title="설정을 불러오지 못했어요"
        action={
          <Button size="sm" tone="ghost" onClick={() => location.reload()}>
            다시 시도
          </Button>
        }
      />
    )
  else
    body = (
      <>
        {failed && (
          <p className="form__failed" role="alert">
            {failed}
          </p>
        )}

        <section className="nset">
          <h2 className="nset__h">이 기기</h2>
          <div className="nset__row">
            <span className="nset__main">
              <b>브라우저 알림</b>
              <span className="nset__desc">
                {push === 'na'
                  ? support() === 'ios-not-installed'
                    ? '홈 화면에 추가한 뒤에 켤 수 있어요'
                    : '이 브라우저에서는 받을 수 없어요'
                  : '앱을 닫아도 이 기기로 알림이 와요'}
              </span>
            </span>
            {push !== 'na' && (
              <Switch on={push === true} disabled={push === null || pushBusy} onChange={flipPush} label="브라우저 알림" />
            )}
          </div>
        </section>

        <section className="nset">
          <h2 className="nset__h">받을 알림</h2>
          {KINDS.map((k) => (
            <div className="nset__row" key={k.key}>
              <span className="nset__main">
                <b>{k.label}</b>
                <span className="nset__desc">{k.desc}</span>
              </span>
              <Switch on={kinds[k.key]} onChange={(v) => flipKind(k.key, v)} label={k.label} />
            </div>
          ))}
          {/* 다 끄면 알림함에도 안 쌓인다는 것을 미리 말한다 */}
          <p className="nset__foot">끈 종류는 알림함에도 쌓이지 않아요.</p>
        </section>
      </>
    )

  return <PageShell title="알림 설정">{body}</PageShell>
}
