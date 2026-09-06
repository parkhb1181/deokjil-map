import type { Metadata } from 'next'
import { Suspense } from 'react'
import Callback from './Callback'

/**
 * 카카오 인가 콜백.
 *
 * **주소가 계약이다.** 카카오 개발자 콘솔에 등록한 Redirect URI 와
 * 글자 하나까지 같아야 하고, 다르면 카카오가 `KOE006` 으로 막는다.
 * 그래서 이 경로는 와이어프레임 깃발과 무관하게 항상 있어야 한다 —
 * `/w4871` 아래로 숨기면 실서비스에서 로그인이 안 된다.
 *
 * 색인을 막는다. 사람이 눌러서 오는 화면이 아니라 지나가는 자리다.
 */
export const metadata: Metadata = {
  title: '로그인 중 · 덕모임',
  robots: { index: false, follow: false },
}

/* 인가코드가 쿼리로 오므로 정적으로 구울 수 없다 */
export const dynamic = 'force-dynamic'

export default function Page() {
  /* useSearchParams 는 Suspense 경계가 있어야 한다 */
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  )
}
