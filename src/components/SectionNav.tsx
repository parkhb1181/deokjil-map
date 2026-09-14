'use client'

/**
 * 홈 밖 화면(동행 · 채팅 · 프로필 · 알림함)의 하단 탭.
 *
 * 홈에만 하단 탭이 있고 나머지는 뒤로가기 헤더뿐이라 「푸터가 있는 데가
 * 있고 없는 데가 있다」 는 말이 나왔다 (2026-09-14). 동행에서 지도로,
 * 프로필에서 동행으로 가려면 홈까지 되돌아가야 했다.
 *
 * 홈의 세 칸(목록 · 지도 · 즐겨찾기)은 여기서 누르면 홈으로 가면서 그
 * 칸을 연다 (해시 `#/map` · `#/bookmark`). 동행 · 프로필은 링크 그대로고,
 * 지금 있는 묶음에 켜진 표시가 붙는다.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav, { type Section, type Tab } from '@/components/BottomNav'
import { loadBookmarks } from '@/lib/bookmark'
import { useUnreadCount } from '@/lib/auth/unread'
import { wf } from '@/lib/wireframe'

export function SectionNav({ section }: { section: Section }) {
  const router = useRouter()
  const unread = useUnreadCount()
  /* 즐겨찾기 수는 localStorage 라 마운트 뒤에 읽는다 */
  const [saved, setSaved] = useState(0)
  useEffect(() => {
    setSaved(loadBookmarks().length)
  }, [])
  const go = (tab: Tab) => router.push(wf('/home') + (tab === 'browse' ? '' : `#/${tab}`))
  return <BottomNav companion active={null} section={section} savedCount={saved} onChange={go} unread={unread} />
}
