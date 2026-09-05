import type { Metadata } from 'next'
import Leave from './Leave'

/**
 * 회원 탈퇴 (AU-11).
 *
 * **시트가 아니라 화면이다.** 무엇이 지워지고 무엇이 남는지를 읽어야
 * 하는데, 시트에 그만큼 담으면 스크롤이 생기고 버튼이 글보다 먼저
 * 눈에 든다.
 */
export const metadata: Metadata = {
  title: '회원 탈퇴 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Leave />
}
