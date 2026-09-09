import type { Metadata } from 'next'
import ChatList from './ChatList'

/**
 * 채팅방 목록 (CH-05).
 *
 * 알림이 없어서 여기가 「누가 답했나」 를 아는 유일한 자리다.
 * 하단 탭에 안 읽음 배지를 걸 자리도 여기서 나온다.
 */
export const metadata: Metadata = {
  title: '채팅 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <ChatList />
}
