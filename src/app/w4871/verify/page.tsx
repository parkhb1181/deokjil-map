import type { Metadata } from 'next'
import { Suspense } from 'react'
import Verify from './Verify'

/**
 * 휴대전화 인증 (AU-13).
 *
 * 채팅으로 가는 관문이다. 고시 요건 ① 이라 건너뛸 수 없다
 * (docs/SPEC-S3.md 2장).
 *
 * 돌아갈 곳을 next 로 받으므로 로그인·가입과 같이 Suspense 로 감싼다.
 * 없으면 빌드가 이 페이지를 통째로 동적 렌더로 떨어뜨린다.
 */
export const metadata: Metadata = {
  title: '휴대전화 인증 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  )
}
