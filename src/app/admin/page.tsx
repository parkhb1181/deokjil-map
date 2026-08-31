import type { Metadata } from 'next'
import Admin from './Admin'

/**
 * 백오피스.
 *
 * 명세가 최소한만 만들라고 못박은 화면이다 (5-6 범위 원칙).
 * 별도 계정과 접근 제한이 필요한데 구현 방식은 아직 미결이다 (Q-13).
 * 지금은 화면만 있고 아무나 열 수 있으므로 **인증이 붙기 전에
 * 배포하면 안 된다.**
 */
export const metadata: Metadata = {
  title: '백오피스 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Admin />
}
