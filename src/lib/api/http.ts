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

type Params = Record<string, string | number | boolean | null | undefined>

function url(path: string, params?: Params): string {
  const u = new URL(API_BASE + path)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === null || v === undefined || v === '') continue
    u.searchParams.set(k, String(v))
  }
  return u.toString()
}

export async function apiGet<T>(path: string, params?: Params): Promise<T> {
  let res: Response
  try {
    res = await fetch(url(path, params), {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
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
