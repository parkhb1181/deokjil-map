import type { Metadata } from 'next'
import Blocked from './Blocked'

/**
 * 차단 목록은 내 것이라 색인 대상이 아니다.
 * /me 와 같은 이유로 robots 를 막는다.
 */
export const metadata: Metadata = {
  title: '차단한 사람 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Blocked />
}
