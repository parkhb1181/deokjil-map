import type { Metadata } from 'next'
import MyActivity from './MyActivity'

/**
 * 내 활동 내역.
 *
 * 알림이 없는 1차에서 사용자가 상태를 확인할 수 있는 유일한 경로다.
 * 명세가 홈에서 한 번에 닿게 두라고 못박고 있다 (AU-10).
 */
export const metadata: Metadata = {
  title: '내 활동 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <MyActivity />
}
