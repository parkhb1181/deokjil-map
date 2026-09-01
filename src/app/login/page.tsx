import type { Metadata } from 'next'
import { Suspense } from 'react'
import Login from './Login'
import { wireframeOnly } from '@/lib/wireframe'

/**
 * 로그인.
 *
 * useSearchParams 를 쓰므로 Suspense 로 감싼다. 없으면 빌드가
 * 이 페이지 전체를 동적 렌더로 떨어뜨린다.
 */
export const metadata: Metadata = {
  title: '시작하기 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  /* 실서비스 배포에서는 404 다 (lib/wireframe.ts) */
  wireframeOnly()

  return (
    <Suspense>
      <Login />
    </Suspense>
  )
}
