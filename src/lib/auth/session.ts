/**
 * 로그인 세션.
 *
 * ADR 0001 이 **쿠키를 안 쓰기로 정했다.** 토큰은 헤더로만 오간다
 * (`Authorization: Bearer`). 그러면 브라우저가 알아서 들고 다녀주지
 * 않으므로 우리가 어딘가 넣어둬야 한다.
 *
 * ─────────────────────────────────────────────────────────
 * **`localStorage` 에 둔다. 대가를 알고 고른다.**
 *
 * `httpOnly` 쿠키였다면 스크립트가 못 읽는다. 헤더 방식을 고른 순간
 * 그 방어를 포기한 것이고, 여기서 메모리에만 둔다고 되살아나지 않는다
 * — 메모리에 둬도 같은 페이지의 스크립트는 읽는다. 새로고침마다
 * 재발급을 부르는 값만 치를 뿐이다.
 *
 * 그래서 XSS 방어는 저장 위치가 아니라 **본문을 넣는 자리**에서 한다.
 * 우리는 `dangerouslySetInnerHTML` 을 쓰지 않는다.
 *
 * ─────────────────────────────────────────────────────────
 * **서버에서는 항상 비어 있다.**
 *
 * 정적 생성과 재검증이 서버에서 도는데 거기엔 `localStorage` 가 없다.
 * 로그인 상태에 따라 갈리는 화면은 반드시 클라이언트에서 그려야 한다.
 * 서버가 로그인 화면을 굽고 브라우저가 로그인 화면으로 바꾸면
 * 하이드레이션이 어긋난다.
 */

const ACCESS = 'duckmoim.access'
const REFRESH = 'duckmoim.refresh'
/** 로그인 뒤 돌아갈 곳. 카카오에 다녀오는 동안 들고 있을 데가 없다 */
const NEXT = 'duckmoim.next'
/** OAuth `state`. 돌아온 요청이 우리가 보낸 것인지 확인한다 */
const STATE = 'duckmoim.state'

export interface Tokens {
  accessToken: string
  refreshToken: string
}

/**
 * `localStorage` 는 던질 수 있다.
 *
 * 사파리 프라이빗 모드, 쿠키·사이트 데이터를 막은 설정, 서드파티
 * iframe 안에서 접근 자체가 예외다. 로그인이 안 되는 것과 화면이
 * 통째로 죽는 것은 다르다.
 */
function read(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* 저장을 못 해도 이번 세션은 굴러간다. 새로고침하면 풀릴 뿐이다 */
  }
}

export function getAccessToken(): string | null {
  return read(ACCESS)
}

export function getRefreshToken(): string | null {
  return read(REFRESH)
}

export function saveTokens(t: Tokens): void {
  write(ACCESS, t.accessToken)
  write(REFRESH, t.refreshToken)
}

/**
 * 로그아웃. **서버 호출과 별개로 항상 부른다.**
 *
 * 서버가 실패해도 이 기기에서는 나가야 한다. 「로그아웃했는데
 * 로그인 상태」 가 제일 나쁘다.
 */
export function clearTokens(): void {
  write(ACCESS, null)
  write(REFRESH, null)
  write(STATE, null)
}

export function isSignedIn(): boolean {
  return getAccessToken() !== null
}

/* ── 카카오에 다녀오는 동안 들고 있을 것 ────────────────── */

export function stashNext(path: string): void {
  write(NEXT, path)
}

/**
 * 돌아갈 곳을 꺼내고 지운다.
 *
 * **바깥 주소로는 안 보낸다.** `next` 가 `https://evil.example` 이면
 * 로그인 직후 남의 사이트로 튕긴다 (open redirect). `/` 로 시작하고
 * `//` 는 아닌 것만 통과시킨다 — `//evil.com` 은 브라우저가 다른
 * 호스트로 읽는다.
 */
export function takeNext(): string {
  const raw = read(NEXT)
  write(NEXT, null)
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

/**
 * `state` 를 만들어 저장한다.
 *
 * 카카오가 그대로 돌려주는 값이다. 돌아온 요청의 `state` 가 우리가
 * 보낸 것과 다르면 **남이 만든 로그인 요청이다** — 공격자가 자기
 * 인가코드로 피해자 브라우저를 로그인시키는 수법(CSRF)을 막는다.
 */
export function issueState(): string {
  const s =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : String(Math.random()).slice(2) + String(Date.now())
  write(STATE, s)
  return s
}

/** 한 번 쓰고 버린다. 남겨두면 다음 요청에 재사용된다 */
export function takeState(): string | null {
  const s = read(STATE)
  write(STATE, null)
  return s
}
