import type { Metadata } from 'next'
import Settings from './Settings'

export const metadata: Metadata = {
  title: '알림 설정 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Settings />
}
