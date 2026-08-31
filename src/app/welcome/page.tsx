import type { Metadata } from 'next'
import Welcome from './Welcome'

/**
 * 가입 정보 입력.
 *
 * 소셜 로그인 직후 한 번만 지나는 화면이다. 이걸 채우기 전에는
 * 글쓰기와 댓글이 막힌다 (AU-07).
 */
export const metadata: Metadata = {
  title: '시작하기 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Welcome />
}
