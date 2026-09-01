import type { Metadata } from 'next'
import EditProfile from './EditProfile'
import { wireframeOnly } from '@/lib/wireframe'

/** 내 것만 고치는 화면이라 검색에 걸릴 이유가 없다 */
export const metadata: Metadata = {
  title: '프로필 수정 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  /* 실서비스 배포에서는 404 다 (lib/wireframe.ts) */
  wireframeOnly()

  return <EditProfile />
}
