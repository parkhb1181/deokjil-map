import type { PostListItem } from './api/posts'
import type { ClosedReason, MeetPoint, PostState } from '@/types'

/**
 * 모집글 목록 한 줄.
 *
 * ─────────────────────────────────────────────────────────
 * **`PostList.tsx` 에 있다가 여기로 나왔다.**
 *
 * 저 파일이 `'use client'` 인데 목록 페이지(서버 컴포넌트)가 거기서
 * `toListItem` 을 가져다 **불렀다.** Next 가 그것을 막는다 —
 * 「Attempted to call toListItem() from the server but toListItem is on
 * the client」 로 화면이 통째로 500 이 된다.
 *
 * **목데이터로 도는 동안에는 안 걸렸다.** 그 경로는 이 함수를 지나지
 * 않아서다. API 주소를 넣는 순간 목록 화면이 죽는데, 하필 그게 배포
 * 직전에 하는 일이다. 2026-09-09 실 서버 연동에서 잡았다.
 *
 * 타입만 가져가는 것은 괜찮다. `import type` 은 빌드 때 사라져서
 * 클라이언트 경계를 넘지 않는다. 문제가 되는 것은 함수를 부르는 쪽이다.
 */
export type ListItem = {
  id: string
  eventId: string | null
  eventTitle: string | null
  title: string
  excerpt: string
  status: PostState
  closedReason?: ClosedReason | null
  capacity: number | null
  meetAt: string
  meetPoint: MeetPoint
  author: { id: string; nickname: string; imageUrl?: string | null }
  commentCount: number
  /** 붙은 이벤트의 대표 사진. 이벤트에 안 붙은 글은 없다 */
  imageUrl?: string | null
}

/**
 * 계약 모양 → 화면 모양.
 *
 * 두 이름이 갈린다. 화면은 사람 사진을 `imageUrl`, 행사 사진도
 * `imageUrl` 로 부르는데 계약은 `profileImageUrl` 과 `eventImageUrl` 로
 * 나눠 쓴다. **계약 쪽이 맞다** — 하나는 사람이고 하나는 포스터라 같은
 * 이름을 쓰면 어느 쪽인지 매번 따져야 한다 (types.ts `PostAuthor`).
 */
export function toListItem(p: PostListItem): ListItem {
  return {
    id: p.id,
    eventId: p.eventId,
    eventTitle: p.eventTitle ?? null,
    title: p.title,
    excerpt: p.excerpt,
    status: p.status,
    closedReason: p.closedReason,
    capacity: p.capacity,
    meetAt: p.meetAt,
    meetPoint: p.meetPoint,
    author: {
      id: p.author.id,
      nickname: p.author.nickname,
      imageUrl: p.author.profileImageUrl ?? null,
    },
    commentCount: p.commentCount,
    imageUrl: p.eventImageUrl ?? null,
  }
}
