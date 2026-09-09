import type { PostListItem } from './api/posts'
import type { ProfilePost } from '@/components/ProfileView'

/**
 * 모집글 카드를 프로필 줄로.
 *
 * 내 활동(AU-10)과 남의 프로필(AU-09)이 같은 응답을 받아 같은 화면을
 * 그린다. 두 화면이 각자 옮기면 한쪽만 고쳐지는 날이 오므로 한 곳에 둔다.
 *
 * **여기는 `'use client'` 가 아니다.** 공개 프로필은 서버에서 받아 그리고
 * 내 활동은 브라우저에서 받는다. `ProfileView` 안에 두면 서버 쪽에서
 * 부를 수 없어서 이 파일이 따로 있다. `ProfilePost` 는 타입만 가져오므로
 * 빌드 때 사라진다.
 */
export function toProfilePost(p: PostListItem): ProfilePost {
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    /* 배지 문구가 이걸로 갈린다 — MANUAL 이면 「모집 완료」, 시간이
       지난 것이면 「종료」 다. status 만으로는 둘을 구분 못 한다 */
    closedReason: p.closedReason,
    meetAt: p.meetAt,
    /* 붙은 행사의 포스터. 행사를 안 고른 글은 null 이고 카드가 색 블록이 된다 */
    imageUrl: p.eventImageUrl,
    commentCount: p.commentCount,
    /*
     * **둘은 서버가 안 준다.**
     *
     * `district` — 만나는 구역. 응답에 오는 것은 `meetPoint.place`(장소명)
     * 이지 구역이 아니다. 「더현대 서울」 을 「여의도」 자리에 넣으면 메타
     * 줄이 장소를 두 번 말하게 된다. 서버가 행사에서 조인해 채워 주면 그때
     * 넣는다.
     *
     * `newComments` — 마지막으로 본 뒤에 달린 댓글 수. 계약에 그런 칸이
     * 없다. 화면이 세어 만들려면 글마다 댓글을 전부 받아야 한다. 알림
     * 화면이 이 자리를 대신한다.
     */
  }
}
