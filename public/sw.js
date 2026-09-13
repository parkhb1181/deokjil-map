/*
 * 서비스워커.
 *
 * ─────────────────────────────────────────────────────────
 * **일부러 작게 만들었다.**
 *
 * 서비스워커의 위험은 기능이 아니라 캐시다. 한번 잘못 저장하면 사용자
 * 브라우저에 낡은 화면이 남고, 우리가 고쳐 배포해도 그 사람만 옛것을
 * 계속 본다. 그래서 **무엇을 캐시하지 않을지**부터 정했다.
 *
 *   HTML · RSC     캐시에서 먼저 주지 않는다. 항상 네트워크가 먼저다
 *   API 응답       손대지 않는다. 로그인·모집글·댓글이 여기 걸리면
 *                  남의 계정 응답이 남는 사고가 난다
 *   교차 출처      손대지 않는다. 카카오·포스터 CDN 전부
 *
 * 캐시하는 것은 **주소에 해시가 박힌 정적 파일**뿐이다. 내용이 바뀌면
 * 주소가 바뀌므로 낡을 수가 없다.
 *
 * ─────────────────────────────────────────────────────────
 * **오프라인은 「최소한 뭔가 보인다」 까지다.**
 *
 * 네트워크가 없으면 마지막으로 받아둔 홈을 보여준다. 목록 내용은
 * 그때 것이라 최신이 아니고, 그래서 오프라인에서 할 수 있는 일이
 * 많지는 않다. 이 서비스는 밖에서 검색하다 들어오는 쪽이라 오프라인
 * 자체가 중요한 화면이 아니다.
 *
 * 이게 있어야 크롬이 「앱 설치」 를 권한다. 매니페스트만으로는 메뉴에서
 * 직접 추가해야 하고, 대부분은 그 메뉴를 열지 않는다.
 *
 * ─────────────────────────────────────────────────────────
 * **푸시는 맨 아래 두 핸들러다** (NT-13 · NT-15). 서버가 보낸 것을 알림으로
 * 띄우고, 누르면 그 글로 간다. 구독을 만들어 서버에 등록하는 쪽은
 * 화면이 한다 (`lib/push.ts`) — 서비스워커는 받기만 한다.
 */

/* 올릴 때마다 올린다. 낡은 캐시는 activate 에서 통째로 지운다 */
const VERSION = 'v4'
const SHELL = `shell-${VERSION}`
const ASSETS = `assets-${VERSION}`

/** 오프라인일 때 보여줄 최소한 */
const FALLBACK = '/'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.add(FALLBACK))
      /* 홈을 못 받아도 설치는 끝낸다. 여기서 실패하면 서비스워커가
         아예 안 붙고, 그러면 다음 방문에도 계속 안 붙는다 */
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

/** 주소에 해시가 박혀 내용이 바뀌면 주소도 바뀌는 것들 */
function immutable(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/font/') ||
    /\.(?:woff2?|png|webp|svg|ico)$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  /* 우리 출처만 다룬다. API 는 다른 출처(api.duckmoim.com)라 여기서 걸러진다 */
  if (url.origin !== self.location.origin) return
  /* 만약 같은 출처로 API 를 두게 되더라도 건드리지 않는다 */
  if (url.pathname.startsWith('/api/')) return

  if (immutable(url)) {
    /* 캐시 우선. 주소가 곧 버전이라 낡을 수 없다 */
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(ASSETS).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  if (req.mode === 'navigate') {
    /*
     * 화면은 **네트워크가 먼저다.** 캐시를 먼저 주면 배포해도 안 바뀐다.
     * 네트워크가 죽었을 때만 마지막으로 받아둔 홈을 준다.
     */
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put(FALLBACK, copy))
          }
          return res
        })
        .catch(() => caches.match(FALLBACK).then((hit) => hit ?? Response.error())),
    )
  }
})

/* ── 푸시 ──────────────────────────────────────────────────
   서버(NT-13)는 문구를 만들지 않는다. 종류와 번호만 보낸다 — 알림함과
   같은 규칙이다 (API 설계 2-10). 문장과 갈 곳은 여기서 조립한다.
     { "notificationId": 42, "kind": "POST_COMMENTED", "postId": 10, "commentId": 100,
       "roomId": null, "messageId": null, "tag": "post-10" }
   tag 가 같으면 먼저 뜬 알림을 갈아끼운다 — 한 글에 댓글이 다섯 개
   달려도 알림은 하나다. 서버가 url 을 실어도 안 쓴다. 주소는 화면 쪽
   규칙이라 서버가 만들면 어긋난다.
   ------------------------------------------------------- */
const TEXT = {
  POST_COMMENTED: '내 모집글에 댓글이 달렸어요',
  COMMENT_REPLIED: '내 댓글에 답글이 달렸어요',
  ROOM_MESSAGED: '채팅방에 새 메시지가 있어요',
}

/** 알림이 가리키는 우리 화면. 와이어프레임 접두어(/w4871)는 wireframe.ts 와 같다 */
function whereTo(data) {
  if (data.kind === 'ROOM_MESSAGED' && data.roomId != null) return `/w4871/chat/${data.roomId}`
  if (data.postId != null) {
    /* 댓글 번호가 있으면 그 댓글까지 내려간다. 글 화면이 목록을 채운 뒤 해시를 본다 (PostDetail) */
    const anchor = data.commentId != null ? `#comment-${data.commentId}` : ''
    return `/w4871/p/${data.postId}${anchor}`
  }
  return '/w4871/alerts'
}

self.addEventListener('push', (e) => {
  /* 본문이 없거나 깨졌어도 무언가는 띄운다. 조용히 버리면 권한을 준
     사람이 아무것도 못 받고, 왜 안 오는지도 모른다 */
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = {}
  }
  /* 서버가 문구를 실어 보내는 날이 오면 그것을 우선한다 */
  const title = data.title || TEXT[data.kind] || '새 알림이 있어요'
  const body = data.body || ''
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      /* 안드로이드 상태줄의 작은 아이콘. 단색 전용 그림이 없어 앱 아이콘을 쓴다 */
      badge: '/icon-192.png',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      renotify: typeof data.tag === 'string',
      data: { url: whereTo(data), notificationId: data.notificationId ?? null },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      /* 이미 열린 탭이 있으면 새 탭을 만들지 않는다. 같은 글이면 그대로
         올리고, 다른 화면이면 그 탭을 그 글로 보낸다 */
      const same = list.find((c) => c.url === url)
      if (same) return same.focus()
      const any = list.find((c) => 'navigate' in c)
      if (any) return any.navigate(url).then((c) => (c ? c.focus() : undefined))
      return self.clients.openWindow(url)
    }),
  )
})

/*
 * 브라우저가 구독을 갈았다 (NT-12 · ⑤).
 *
 * 여기서 서버에 다시 등록하지 못한다 — 서비스워커에는 로그인 토큰이
 * 없다 (토큰은 화면의 localStorage 에 있다). 그래서 새 구독을 만들어
 * 두고 열린 화면에 알린다. 화면이 없으면 다음에 앱을 열 때 PushSync 가
 * 주소가 바뀐 것을 보고 다시 등록한다. 옛 주소로 보낸 푸시는 410 이
 * 나고 서버가 그 줄을 지운다.
 */
self.addEventListener('pushsubscriptionchange', (e) => {
  const old = e.oldSubscription
  const key = old && old.options ? old.options.applicationServerKey : null
  e.waitUntil(
    (key ? self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : Promise.resolve(null))
      .catch(() => null)
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((list) => list.forEach((c) => c.postMessage({ type: 'push-subscription-changed' }))),
  )
})
