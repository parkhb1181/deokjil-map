import type { Metadata } from 'next'
import ChatRoom from './ChatRoom'
import raw from '@/data/chat.sample.json'

/**
 * 채팅방 (CH-02 ~ CH-04).
 *
 * 목데이터의 방만 미리 만들어 둔다. 서버가 붙으면 목록에서 온 id 로
 * 바로 여는 동적 경로가 되고 generateStaticParams 는 빠진다.
 */
export const metadata: Metadata = {
  title: '채팅 · 덕모임',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return raw.rooms.map((r) => ({ roomId: r.id }))
}

export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  return <ChatRoom roomId={roomId} />
}
