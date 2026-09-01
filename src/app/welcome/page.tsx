import type { Metadata } from 'next'
import { Suspense } from 'react'
import Welcome from './Welcome'

/**
 * 가입 정보 입력.
 *
 * 소셜 로그인 직후 한 번만 지나는 화면이다. 이걸 채우기 전에는
 * 글쓰기와 댓글이 막힌다 (AU-07).
 *
 * 로그인이 넘겨준 next 를 읽으므로 로그인과 같이 Suspense 로 감싼다.
 * 없으면 빌드가 이 페이지를 통째로 동적 렌더로 떨어뜨린다.
 */
export const metadata: Metadata = {
  title: '시작하기 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  )
}
