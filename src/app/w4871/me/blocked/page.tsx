import type { Metadata } from 'next'
import Blocked from './Blocked'

/**
 * 차단 목록 (SF-06 · SF-04).
 *
 * 차단은 상대에게 알리지 않으므로 되돌리는 자리가 여기 하나뿐이다.
 * 내 활동에서 들어온다.
 */
export const metadata: Metadata = {
  title: '차단 목록 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Blocked />
}
