'use client'

/**
 * 웹 푸시 — 화면 쪽 (NT-12 · NT-15).
 *
 * 서비스워커(`public/sw.js`)는 받기만 한다. 권한을 묻고 구독을 만들어
 * 서버에 등록하는 것은 여기다.
 *
 * ─────────────────────────────────────────────────────────
 * **권한은 사람이 누른 뒤에만 묻는다.**
 *
 * 들어오자마자 브라우저 창을 띄우면 대부분 「차단」 을 누르고, 한 번
 * 차단하면 브라우저 설정에 들어가야 되돌릴 수 있다. 그래서 「알림 켜기」
 * 버튼이 있고, 그것을 누른 손 안에서만 `requestPermission` 을 부른다.
 * (사파리는 사용자 동작 밖에서 부르면 아예 안 뜬다.)
 *
 * **서버 준비가 안 됐으면 묻지도 않는다.** 구독을 만들어 보낼 곳이 없는데
 * 권한만 받으면, 그 사람의 한 번뿐인 「허용」 을 헛되이 쓴 셈이다. VAPID
 * 공개키(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`)가 없으면 `PUSH_READY` 가 거짓이고
 * 화면은 켜기 카드를 안 그린다. 키는 백엔드가 NT-12 와 함께 준다.
 *
 * **iOS 는 홈 화면에 추가한 뒤에만 된다.** 사파리 탭에서는 `PushManager`
 * 자체가 없다. 그래서 `support()` 가 「설치 안 됨」 을 따로 돌려주고 화면은
 * 켜기 대신 「홈 화면에 추가하세요」 를 보여준다.
 */

import { apiSend } from '@/lib/api/http'
import { authed } from '@/lib/auth/authed'
import { isSignedIn } from '@/lib/auth/session'

export const PUSH_READY = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)

/** 서버에 마지막으로 등록한 구독 주소. 바뀌었는지 볼 때 쓴다 (⑤) */
const ENDPOINT_KEY = 'duckmoim.push.endpoint'

export type PushSupport = 'ok' | 'unsupported' | 'ios-not-installed'

/** 홈 화면에서 열었는가. 안드로이드는 display-mode, iOS 는 navigator.standalone */
export function launchedInstalled(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/.test(navigator.userAgent)
}

export function support(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported'
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (ok) return 'ok'
  /* iOS 사파리 탭에는 PushManager 가 없다. 설치하면 생긴다 (16.4+) */
  if (isIOS() && !launchedInstalled()) return 'ios-not-installed'
  return 'unsupported'
}

export function permission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/** 사용자 동작 안에서만 부른다 (위 설명) */
export async function askPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  return Notification.requestPermission()
}

/** base64url → ArrayBuffer. `applicationServerKey` 가 받는 모양이다 */
function keyBytes(b64url: string): ArrayBuffer {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4)
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  /* TS 5.9 의 Uint8Array 는 SharedArrayBuffer 일 수 있다고 봐서 BufferSource 에 안 맞는다. ArrayBuffer 로 확정한다 */
  const buf = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buf
}

/**
 * 브라우저 구독을 만든다 (NT-12 의 앞 절반).
 *
 * 이미 있으면 그것을 돌려준다 — 두 번 만들면 서버에 같은 기기가 두 줄
 * 생긴다. 서버 등록은 `register()` 가 한다.
 */
export async function subscribe(): Promise<PushSubscription | null> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key || support() !== 'ok') return null
  /* 등록이 없으면(개발 모드는 안 붙인다 — ServiceWorker.tsx) `ready` 가 영원히 안 풀린다. 먼저 있는지 본다 */
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  const had = await reg.pushManager.getSubscription()
  if (had) return had
  return reg.pushManager.subscribe({
    /* 안 보이는 푸시는 크롬이 거부한다. 우리는 늘 알림을 띄우니 참이다 */
    userVisibleOnly: true,
    applicationServerKey: keyBytes(key),
  })
}

/** 서버가 받는 모양. 브라우저 JSON 에서 expirationTime 은 뺀다 — 계약에 없는 칸이다 */
function wire(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const j = sub.toJSON()
  return { endpoint: sub.endpoint, keys: { p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '' } }
}

/**
 * 서버에 구독을 등록한다 (NT-12 · 뒤 절반). `POST /api/v1/push-subscriptions`.
 * 같은 endpoint 를 다시 보내도 서버가 한 줄로 둔다. 등록한 주소를 기억해
 * 두어 다음에 앱을 열 때 바뀌었는지 본다.
 */
export async function register(sub: PushSubscription): Promise<void> {
  await authed((token) => apiSend<void>('POST', '/api/v1/push-subscriptions', wire(sub), token))
  try {
    localStorage.setItem(ENDPOINT_KEY, sub.endpoint)
  } catch {
    /* 저장소가 막혀 있으면 다음에 한 번 더 등록한다. 서버가 같은 줄로 둔다 */
  }
}

/**
 * 알림을 끈다. 서버 줄을 지우고 브라우저 구독도 푼다 — 한쪽만 하면
 * 서버는 죽은 주소로 보내다 410 을 받고, 브라우저는 안 오는 구독을 든다.
 */
export async function unsubscribe(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (sub) {
    /* 해제는 주소만 보낸다 (PushSubscriptionUnregisterRequest). 없는 구독을 지워도 성공이다 */
    await authed((token) => apiSend<void>('DELETE', '/api/v1/push-subscriptions', { endpoint: sub.endpoint }, token)).catch(() => undefined)
    await sub.unsubscribe().catch(() => undefined)
  }
  try {
    localStorage.removeItem(ENDPOINT_KEY)
  } catch {
    /* 무시 */
  }
}

/** 지금 이 기기가 서버에 등록돼 있는가 (권한 허용 + 구독 있음 + 등록한 적 있음) */
export async function isOn(): Promise<boolean> {
  if (!PUSH_READY || support() !== 'ok' || permission() !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (!sub) return false
  try {
    return localStorage.getItem(ENDPOINT_KEY) === sub.endpoint
  } catch {
    return true
  }
}

/**
 * 앱을 열 때 한 번 맞춘다 (⑤ 의 화면 쪽).
 *
 * 허용돼 있고 로그인돼 있으면 구독을 보고, 서버에 등록한 주소와 다르면
 * (브라우저가 갈았거나 아직 한 번도 안 보냈으면) 다시 등록한다.
 * 서비스워커의 pushsubscriptionchange 가 화면에 알릴 때도 이것을 부른다.
 */
export async function sync(): Promise<void> {
  if (!PUSH_READY || !isSignedIn() || support() !== 'ok' || permission() !== 'granted') return
  const sub = await subscribe()
  if (!sub) return
  let saved: string | null = null
  try {
    saved = localStorage.getItem(ENDPOINT_KEY)
  } catch {
    /* 무시 */
  }
  if (saved !== sub.endpoint) await register(sub)
}
