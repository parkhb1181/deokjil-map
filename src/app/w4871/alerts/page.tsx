import type { Metadata } from 'next'
import Alerts from './Alerts'

/**
 * 알림 (S3).
 *
 * 1차에는 없었고 「내 활동 내역」(AU-10) 이 그 자리를 대신했다. 채팅이
 * 들어오면서 그것으로 안 된다 — 댓글은 내가 쓴 글에 달리니 내 활동에서
 * 찾아지지만, 채팅은 상대가 언제 답할지 모르고 방을 하나씩 열어봐야만
 * 안다. 내 활동에서 들어온다.
 */
export const metadata: Metadata = {
  title: '알림 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Alerts />
}
