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
 */

/* 올릴 때마다 올린다. 낡은 캐시는 activate 에서 통째로 지운다 */
const VERSION = 'v1'
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
