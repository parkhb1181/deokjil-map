'use client'

/**
 * 알림함 위의 「알림 켜기」 카드 (NT-15 · 권한 요청 흐름).
 *
 * 세 가지 중 하나를 그리거나 아무것도 안 그린다.
 *
 *   켜기        브라우저가 푸시를 지원하고 아직 안 물어봤다. 누르면 그
 *               손 안에서 권한을 묻고 구독을 만든다
 *   홈에 추가   iOS 사파리 탭이다. 설치해야 푸시가 생기니 그것부터 안내한다
 *   (없음)      이미 허용했거나, 차단했거나, 서버가 아직 준비 안 됐다
 *
 * 차단한 사람에게 다시 묻지 않는다. 브라우저가 창을 안 띄우고, 우리가
 * 「설정에서 켜세요」 를 매번 보여주면 잔소리가 된다.
 *
 * 서버 준비(`PUSH_READY`)가 안 됐으면 카드 자체가 없다 — 이유는
 * `lib/push.ts` 머리말.
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Basics'
import { PUSH_READY, askPermission, permission, subscribe, support, type PushSupport } from '@/lib/push'

type State = { sup: PushSupport; perm: ReturnType<typeof permission> } | null

export default function PushCard() {
  /* 브라우저 값이라 마운트 뒤에 읽는다. 서버 렌더에서는 아무것도 안 그린다 */
  const [st, setSt] = useState<State>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    setSt({ sup: support(), perm: permission() })
  }, [])

  if (!PUSH_READY || !st) return null

  if (st.sup === 'ios-not-installed') {
    return (
      <div className="pushcard">
        <p>
          <b>홈 화면에 추가하면 알림을 받을 수 있어요.</b>
          <br />
          공유 버튼 → 「홈 화면에 추가」
        </p>
      </div>
    )
  }

  if (st.sup !== 'ok' || st.perm !== 'default') return null

  if (done) {
    return (
      <div className="pushcard">
        <p>{done}</p>
      </div>
    )
  }

  const turnOn = async () => {
    setBusy(true)
    try {
      const p = await askPermission()
      if (p !== 'granted') {
        setSt((v) => (v ? { ...v, perm: p } : v))
        return
      }
      const sub = await subscribe()
      /* 서버 등록(NT-12 뒤 절반)은 엔드포인트가 오면 여기서 이어진다 */
      setDone(sub ? '알림을 켰어요. 댓글이 달리면 알려드릴게요' : '알림을 켰어요')
    } catch {
      setDone('지금은 켤 수 없어요. 잠시 뒤 다시 시도해주세요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pushcard">
      <p>
        <b>앱을 닫아도 알려드릴까요?</b>
        <br />
        내 모집글에 댓글이 달리면 알림이 와요
      </p>
      <Button size="sm" onClick={turnOn} disabled={busy}>
        {busy ? '켜는 중…' : '알림 켜기'}
      </Button>
    </div>
  )
}
