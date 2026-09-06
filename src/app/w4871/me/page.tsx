import type { Metadata } from 'next'
import ProfileView, { type MyComment, type ProfileData } from '@/components/ProfileView'

/**
 * 내 활동 내역.
 *
 * 알림이 없는 1차에서 사용자가 상태를 확인할 수 있는 유일한 경로다.
 * 명세가 홈에서 한 번에 닿게 두라고 못박고 있다 (AU-10).
 *
 * 화면은 `/u/[id]` 와 같은 렌더러를 쓴다. 여기서는 `isMe` 로 들어가
 * 제재 안내·마이메뉴·내 댓글 탭이 붙는다. 주소를 따로 두는 이유는
 * `components/ProfileView.tsx` 머리에 적어 두었다.
 */

/* 로그인이 없어 내 정보를 서버에서 못 받는다. 붙으면 이 상수들을 지우고
   세션에서 채운다. u_host 는 /u/u_host 와 같은 사람이라 두 화면을
   나란히 놓고 비교할 수 있다 */
const ME: ProfileData = {
  id: 'u_host',
  nickname: '덕질하는오리',
  profileImageUrl: '/avatar/a1.webp',
  bio: '팝업이랑 생카 자주 다녀요. 오픈런도 곧잘 합니다.',
  lastSeen: 'TODAY',
  posts: [
    {
      id: 'p1',
      title: '빅뱅 전시 같이 보실 분',
      status: 'OPEN',
      meetAt: '2026-09-14T11:00',
      district: '여의도',
      /* 모집글 상세(posts.sample.json)가 쓰는 것과 같은 포스터다.
         같은 글이 화면마다 다른 사진이면 같은 글로 안 보인다 */
      imageUrl:
        'https://cdn.popga.co.kr/spot/8417/main/0d0515e8-01f4-4fa6-8def-3fa4030d1063_1786265342238_thumbnail_MAIN_W480.webp',
      commentCount: 5,
      newComments: 2,
    },
    /* 행사에 안 붙은 글. 회색 네모 대신 제목에서 뽑은 색이 깔린다 */
    {
      id: 'p4',
      title: '원위 팝업 첫날 같이 가요',
      status: 'CLOSED',
      closedReason: 'MANUAL',
      meetAt: '2026-08-28T10:30',
      district: '성수',
      commentCount: 8,
      newComments: 0,
    },
  ],
}

const MY_COMMENTS: MyComment[] = [
  {
    id: 'c3',
    postId: 'p2',
    postTitle: '성수 토리든 팝업 평일 낮에 가실 분',
    body: '카톡 아이디 night_ticket 입니다',
    secret: true,
    createdAt: '2026-08-30T09:40',
    replied: true,
  },
  {
    id: 'c9',
    postId: 'p3',
    postTitle: '홍대 생카 세 군데 같이 도실 분',
    body: '저도 갈 수 있을 것 같아요! 동선 공유해주실 수 있나요?',
    secret: false,
    createdAt: '2026-08-30T18:12',
    replied: false,
  },
]

export const metadata: Metadata = {
  title: '내 프로필 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <ProfileView user={ME} isMe comments={MY_COMMENTS} />
}
