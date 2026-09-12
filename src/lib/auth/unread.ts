'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { USE_API } from '@/lib/api/config'
import { fetchUnreadCount } from '@/lib/api/notifications'
import { authed } from './authed'
import { isSignedIn } from './session'

/**
 * 안 읽은 알림 수 (NT-10) — 화면 여럿이 같이 보는 숫자.
 *
 * 하단 탭의 프로필 배지와 내 활동의 「알림」 줄이 같은 수를 보여야
 * 한다. 각자 부르면 왕복이 둘이고, 한쪽만 읽음 처리한 뒤 다른 쪽이
 * 낡은 수를 들고 있게 된다. 그래서 모듈 하나에 두고 구독한다.
 *
 * **자주 안 부른다.** 한 번 받으면 1분은 그대로 쓴다. 배지는 정확한
 * 실시간 수가 아니라 「들어올 이유」 라, 1분 늦는 것은 문제가 아니고
 * 화면을 오갈 때마다 서버를 두드리는 것이 문제다. 알림함에서 읽음
 * 처리를 하면 그 자리에서 `setUnread` 로 바로 맞춘다.
 *
 * 로그인 안 했으면 0 이고 서버를 부르지 않는다.
 */

const TTL = 60_000

let count = 0
let fetchedAt = 0
let inflight: Promise<void> | null = null
const subs = new Set<() => void>()

function emit() {
  for (const fn of subs) fn()
}

function subscribe(fn: () => void): () => void {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}

function snapshot(): number {
  return count
}

/** 읽음 처리한 쪽이 바로 맞춘다. 서버를 다시 묻지 않는다 */
export function setUnread(n: number): void {
  count = Math.max(0, n)
  fetchedAt = Date.now()
  emit()
}

/** 서버에 묻는다. TTL 안이면 안 묻고, 이미 묻는 중이면 그 약속을 같이 기다린다 */
export function refreshUnread(force = false): Promise<void> {
  if (!USE_API || !isSignedIn()) {
    if (count !== 0) setUnread(0)
    return Promise.resolve()
  }
  if (!force && Date.now() - fetchedAt < TTL) return Promise.resolve()
  if (inflight) return inflight
  inflight = authed((token) => fetchUnreadCount(token))
    .then((n) => setUnread(n))
    .catch(() => {
      /* 배지는 실패해도 화면을 막지 않는다. 다음 화면 전환 때 다시 묻는다 */
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** 구독한다. 마운트되면 (TTL 안이 아니면) 한 번 묻는다 */
export function useUnreadCount(): number {
  const n = useSyncExternalStore(subscribe, snapshot, () => 0)
  useEffect(() => {
    void refreshUnread()
  }, [])
  return n
}
