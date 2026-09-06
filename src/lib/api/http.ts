import type { ApiError, Page } from '@/types'
import { isApiError } from '@/types'
import { API_BASE, REVALIDATE_SECONDS } from './config'

/**
 * 서버에서 부르는 GET 한 자리.
 *
 * 화면 코드가 `fetch` 를 직접 쓰지 않게 한다. 주소 조립·에러 봉투·재검증
 * 주기가 여기 한 곳에만 있어야 나중에 셋 다 한 번에 바뀐다.
 *
 * **던지는 것은 항상 `ApiFailure` 다.** 네트워크가 끊긴 것과 서버가
 * 400 을 준 것을 화면이 구분하려면 형태가 같아야 한다. 그러지 않으면
 * 부르는 쪽마다 `e instanceof TypeError` 같은 것을 쓰게 된다.
 */
export class ApiFailure extends Error {
  readonly code: string
  readonly httpStatus: number
  readonly fieldErrors: ApiError['fieldErrors']

  constructor(code: string, message: string, httpStatus: number, fieldErrors?: ApiError['fieldErrors']) {
    super(message)
    this.name = 'ApiFailure'
    this.code = code
    this.httpStatus = httpStatus
    this.fieldErrors = fieldErrors
  }
}

/**
 * 요청 하나가 기다리는 최대 시간(ms).
 *
 * 없으면 서버가 죽지 않고 매달릴 때 화면이 「저장하는 중…」 에서
 * 영원히 멈춘다. fetch 는 스스로 끊지 않는다.
 *
 * 읽기가 더 넉넉하다. 빌드·재검증이 목록 전부를 받아 207장을 굽는
 * 경로라 한 번에 여러 페이지가 오간다.
 */
const READ_TIMEOUT = 15_000
const WRITE_TIMEOUT = 10_000

/**
 * 시간이 지나면 끊는다.
 *
 * 끊기면 fetch 가 던지고 그 자리에서 `NETWORK` 로 감싸진다 — 화면은
 * 「연결이 불안정해요」 를 본다. 오래된 런타임에는 없을 수 있어 확인하고 쓴다.
 */
function cutoff(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? AbortSignal.timeout(ms)
    : undefined
}

type Params = Record<string, string | number | boolean | null | undefined>

function url(path: string, params?: Params): string {
  /*
   * 주소가 없으면 여기서 먼저 막는다.
   *
   * 안 그러면 `new URL('/api/...')` 가 그냥 던지고, 바깥의 catch 가
   * 그것을 네트워크 오류로 감싼다. 화면에는 「연결이 불안정해요」 가
   * 뜨는데 연결은 시도조차 안 한 상태다. 실제로 카카오 로그인을
   * 붙이다 그 문구를 만났다 (2026-09-05).
   */
  if (!API_BASE) {
    throw new ApiFailure(
      'NO_API_BASE',
      'NEXT_PUBLIC_API_BASE 가 비어 있습니다. 서버 주소를 넣어야 부를 수 있습니다',
      0,
    )
  }
  const u = new URL(API_BASE + path)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === null || v === undefined || v === '') continue
    u.searchParams.set(k, String(v))
  }
  return u.toString()
}

/**
 * 토큰은 **헤더로만** 보낸다.
 *
 * 쿼리에 실으면 접근 로그·프록시 캐시·Referer 헤더에 그대로 남는다.
 * ADR 0001 이 헤더 방식을 고른 이유가 이것이고, 편의로 쿼리에 얹으면
 * 그 결정이 무의미해진다.
 *
 * 토큰이 붙은 요청은 **캐시하지 않는다.** 보는 사람마다 응답이 갈리는데
 * (비밀 댓글이 그렇다) 재검증 캐시에 얹으면 남의 응답이 재사용된다.
 */
export async function apiGet<T>(path: string, params?: Params, token?: string | null): Promise<T> {
  /* 주소 조립은 try 밖이다. 안에 두면 NO_API_BASE 가 NETWORK 로 감싸진다 */
  const target = url(path, params)
  let res: Response
  try {
    res = await fetch(target, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: cutoff(READ_TIMEOUT),
      ...(token ? { cache: 'no-store' as const } : { next: { revalidate: REVALIDATE_SECONDS } }),
    })
  } catch (e) {
    /* 여기 오는 것은 DNS·TLS·타임아웃이다. 서버는 아무 말도 안 했다 */
    throw new ApiFailure('NETWORK', e instanceof Error ? e.message : '서버에 닿지 못했습니다', 0)
  }

  if (!res.ok) {
    /*
     * 에러 본문이 계약대로 `{code, message}` 인지 확인한다. 프록시나
     * 로드밸런서가 끼면 HTML 을 돌려주기도 해서, 파싱 실패를 에러로
     * 다루지 않고 상태 코드만 들고 넘어간다.
     */
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* 본문이 JSON 이 아니다. 상태 코드만 쓴다 */
    }
    if (isApiError(body)) {
      throw new ApiFailure(body.code, body.message, res.status, body.fieldErrors)
    }
    throw new ApiFailure('HTTP_' + res.status, `${res.status} ${res.statusText}`, res.status)
  }

  return (await res.json()) as T
}

/**
 * 커서를 끝까지 따라가며 전부 모은다.
 *
 * 빌드·재검증 때 정적 페이지를 만들려면 목록 전부가 필요하다. 지금
 * 207건이라 한두 번이면 끝난다. 브라우저가 부르는 무한 스크롤은 이걸
 * 쓰지 않는다 — 그쪽은 한 페이지씩 받아 이어붙인다.
 *
 * **한계를 둔다.** 커서가 잘못 돌면 무한 루프다. 서버가 같은 커서를
 * 계속 주는 버그를 빌드가 영원히 도는 것으로 겪고 싶지 않다.
 */
export async function apiGetAll<T>(path: string, params?: Params, maxPages = 40): Promise<T[]> {
  const out: T[] = []
  let cursor: string | null = null

  for (let i = 0; i < maxPages; i++) {
    const page: Page<T> = await apiGet<Page<T>>(path, { ...params, cursor })
    out.push(...page.items)
    if (!page.hasNext || !page.nextCursor || page.nextCursor === cursor) break
    cursor = page.nextCursor
  }

  return out
}

/**
 * 쓰기 요청. POST · PATCH · DELETE.
 *
 * 읽기와 갈라둔 이유가 셋이다.
 *
 * **캐시가 반대다.** `apiGet` 은 `revalidate` 를 걸어 재사용하는데,
 * 쓰기는 매번 나가야 한다.
 *
 * **토큰이 붙는다.** 읽기는 대부분 `PUBLIC` 이고 쓰기는 거의 다
 * 로그인이 필요하다 (ADR 0001 이 헤더 방식으로 정했다).
 *
 * **본문이 있다.** 204 로 본문 없이 오는 것도 있어서 파싱을 나눈다.
 */
export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T | null> {
  const target = url(path)
  let res: Response
  try {
    res = await fetch(target, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: cutoff(WRITE_TIMEOUT),
      /* 쓰기는 캐시하지 않는다. 같은 요청을 두 번 보내도 두 번 나가야 한다 */
      cache: 'no-store',
    })
  } catch (e) {
    throw new ApiFailure('NETWORK', e instanceof Error ? e.message : '서버에 닿지 못했습니다', 0)
  }

  if (!res.ok) {
    let payload: unknown = null
    try {
      payload = await res.json()
    } catch {
      /* 본문이 JSON 이 아니다. 상태 코드만 쓴다 */
    }
    if (isApiError(payload)) {
      throw new ApiFailure(payload.code, payload.message, res.status, payload.fieldErrors)
    }
    throw new ApiFailure('HTTP_' + res.status, `${res.status} ${res.statusText}`, res.status)
  }

  /* 204 거나 본문이 비었다. 삭제·마감이 그렇다 */
  if (res.status === 204) return null
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}
