'use client'

/**
 * 동행 안의 두 칸 — 모집글 · 채팅.
 *
 * 하단 탭의 「동행」 하나가 두 화면의 입구다. 처음엔 모집글만 있어서
 * 링크 하나로 충분했는데, 채팅이 붙으면서 갈 데가 둘이 됐다. 하단 탭을
 * 하나 더 늘리면 다섯 칸이 넘어가고, 누를 때마다 고르게 하면 매번 한
 * 번씩 더 눌러야 한다. 그래서 동행으로 들어오면 모집글이 열리고, 위에
 * 이 두 칸이 있어 한 번에 채팅으로 건너간다. 두 화면 다 이것을 맨 위에
 * 그려서 어느 쪽에서든 왕복이 된다.
 */
import { usePathname, useRouter } from 'next/navigation'
import { Tabs } from '@/components/ui/Basics'
import { wf } from '@/lib/wireframe'

const ITEMS = ['모집글', '채팅']

export function CompanionTabs() {
  const router = useRouter()
  const path = usePathname()
  const on = path.includes('/chat') ? 1 : 0
  return (
    <div className="ctabs">
      <Tabs items={ITEMS} on={on} onPick={(i) => router.push(wf(i === 1 ? '/chat' : '/p'))} />
    </div>
  )
}
