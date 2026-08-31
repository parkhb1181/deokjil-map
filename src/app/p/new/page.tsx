import type { Metadata } from 'next'
import NewPost from './NewPost'

/** 로그인한 사람만 오는 화면이라 검색에 걸릴 이유가 없다 */
export const metadata: Metadata = {
  title: '모집글 쓰기 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <NewPost />
}
