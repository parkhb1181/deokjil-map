'use client'

import { API_BASE } from './config'
import { ApiFailure } from './http'
import { withAuth } from '@/lib/auth/refresh'

/**
 * 채팅방 실시간 수신 (CH-10 · CH-11). `GET /chat-rooms/{id}/messages/stream`.
 *
 * ─────────────────────────────────────────────────────────
 * **브라우저의 `EventSource` 를 쓰지 않는다.**
 *
 * 그것은 요청 헤더를 못 붙인다. 우리 인증은 `Authorization: Bearer` 헤더
 * 하나뿐이고 (ADR 0001 — 쿼리에 실으면 접속 로그·Referer 에 남는다),
 * 토큰을 쿠키로 옮기거나 스트림만 쿼리를 받게 하면 그 결정이 무너진다.
 * 그래서 `fetch` 로 열고 본문을 한 줄씩 직접 읽는다. SSE 는 텍스트 한
 * 줄 규칙이라 (`event:` `id:` `data:` · 빈 줄이 경계) 손으로 읽어도
 * 스무 줄이다.
 *
 * **재연결도 직접 한다.** `EventSource` 가 해 주던 일이다. 끊기면 잠깐
 * 쉬고 다시 열되, 마지막으로 받은 `id` 를 `Last-Event-ID` 헤더에 실어
 * 그 뒤부터 받는다 (CH-11). 서버가 되돌려줄 것이 너무 많으면
 * `event: gap` 을 보내고, 그때는 목록 API 로 따라잡는다 — 그건 부르는
 * 쪽(ChatRoom)이 한다.
 *
 * **끊기는 것이 정상이다.** 서버가 5분마다 닫고, ALB 도 조용하면 닫는다.
 * 그래서 「오류」 로 다루지 않고 다시 연다. 다만 401 · 403 · 404 는 다시
 * 열어도 같으니 부르는 쪽에 알리고 멈춘다.
 */

export interface StreamHandlers<T> {
  /** `event: message` 한 건. `id` 는 서버가 준 messageId */
  onMessage: (data: T, id: string) => void
  /** `event: gap` — 되돌려주지 못한 구간이 있다. 목록 API 로 따라잡으라는 뜻 */
  onGap: () => void
  /** 다시 열어도 같은 실패. 스트림은 멈췄다 */
  onDead: (e: ApiFailure) => void
}

const RETRY_MS = [1_000, 2_000, 5_000, 10_000]

/**
 * 연다. 돌려주는 함수를 부르면 닫힌다 (화면을 떠날 때).
 *
 * @param lastId 이미 받은 마지막 메시지 번호. 있으면 그 뒤부터 받는다
 */
export function openStream<T>(roomId: string, lastId: string | null, h: StreamHandlers<T>): () => void {
  let closed = false
  let ctrl: AbortController | null = null
  let last = lastId
  let fails = 0

  const url = `${API_BASE}/api/v1/chat-rooms/${encodeURIComponent(roomId)}/messages/stream`

  async function once(): Promise<void> {
    ctrl = new AbortController()
    const res = await withAuth<Response>(
      async (token) => {
        const r = await fetch(url, {
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(last ? { 'Last-Event-ID': last } : {}),
          },
          cache: 'no-store',
          signal: ctrl!.signal,
        })
        /* 401 은 여기서 던져야 withAuth 가 재발급 뒤 한 번 더 부른다 (refresh.ts) */
        if (r.status === 401) throw new ApiFailure('AUTH_ACCESS_TOKEN_EXPIRED', '로그인이 만료되었습니다', 401)
        return r
      },
      (e) => e instanceof ApiFailure && e.httpStatus === 401,
    )

    if (!res.ok) {
      /* 본문이 JSON 이면 그 코드로, 아니면 상태 코드로 */
      let code = `HTTP_${res.status}`
      let message = `${res.status} ${res.statusText}`
      try {
        const body = (await res.json()) as { code?: string; message?: string }
        if (body?.code) code = body.code
        if (body?.message) message = body.message
      } catch {
        /* 본문이 JSON 이 아니다 */
      }
      throw new ApiFailure(code, message, res.status)
    }
    if (!res.body) throw new ApiFailure('NETWORK', '스트림 본문이 없습니다', 0)

    fails = 0
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let ev = { name: 'message', id: null as string | null, data: [] as string[] }

    const flush = () => {
      if (ev.data.length === 0 && ev.id === null) {
        ev = { name: 'message', id: null, data: [] }
        return
      }
      const raw = ev.data.join('\n')
      if (ev.name === 'gap') {
        h.onGap()
      } else if (ev.name === 'message' && raw) {
        try {
          const parsed = JSON.parse(raw) as T
          if (ev.id) last = ev.id
          h.onMessage(parsed, ev.id ?? '')
        } catch {
          /* 깨진 한 줄은 버린다. 다음 줄이 온다 */
        }
      }
      ev = { name: 'message', id: null, data: [] }
    }

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '')
        buf = buf.slice(nl + 1)
        if (line === '') flush()
        else if (line.startsWith(':')) continue /* 주석 = 하트비트 */
        else if (line.startsWith('event:')) ev.name = line.slice(6).trim()
        else if (line.startsWith('id:')) ev.id = line.slice(3).trim()
        else if (line.startsWith('data:')) ev.data.push(line.slice(5).replace(/^ /, ''))
      }
    }
    flush()
  }

  async function loop(): Promise<void> {
    while (!closed) {
      try {
        await once()
        /* 서버가 곱게 닫았다 (5분 타임아웃). 바로 다시 연다 */
      } catch (e: unknown) {
        if (closed) return
        if (e instanceof ApiFailure && (e.httpStatus === 401 || e.httpStatus === 403 || e.httpStatus === 404)) {
          h.onDead(e)
          return
        }
        /* 네트워크가 흔들렸다. 조금씩 더 기다렸다 다시 연다 */
        const wait = RETRY_MS[Math.min(fails, RETRY_MS.length - 1)]
        fails += 1
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }

  void loop()

  return () => {
    closed = true
    ctrl?.abort()
  }
}
