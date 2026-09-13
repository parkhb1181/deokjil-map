'use client'

/**
 * 푸시 구독을 서버와 맞춘다 (NT-12 · ⑤).
 *
 * 앱을 열 때 한 번, 그리고 서비스워커가 「구독이 바뀌었다」 고 알릴 때.
 * 화면을 그리지 않는다. 레이아웃에 한 번 꽂힌다.
 *
 * 개발 모드에는 서비스워커가 없어 아무것도 안 한다 (ServiceWorker.tsx).
 */
import { useEffect } from 'react'
import { sync } from '@/lib/push'

export default function PushSync() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const run = () => {
      void sync().catch(() => undefined)
    }
    /* 등록이 끝난 뒤에 — 그 전에는 구독을 만들 자리가 없다 */
    navigator.serviceWorker.ready.then(run).catch(() => undefined)
    const onMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'push-subscription-changed') run()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])
  return null
}
