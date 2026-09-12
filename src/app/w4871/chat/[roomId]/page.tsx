import type { Metadata } from 'next'
import ChatRoom from './ChatRoom'
import raw from '@/data/chat.sample.json'
import { USE_API } from '@/lib/api/config'

/**
 * 채팅방 (CH-02 ~ CH-04).
 *
 * 목데이터 경로에서는 그 방들만 미리 굽는다. 서버가 있으면 굽는 것이
 * 없고 (빈 목록) 목록에서 온 id 로 그때그때 연다 — `dynamicParams` 가
 * 기본값(true)이라 빈 목록이면 전부 요청 시점에 그려진다.
 */
export const metadata: Metadata = {
  title: '채팅 · 덕모임',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return USE_API ? [] : raw.rooms.map((r) => ({ roomId: r.id }))
}

export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  return <ChatRoom roomId={roomId} />
}
