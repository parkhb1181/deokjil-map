import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Profile, { type ProfileData } from './Profile'

/**
 * 공개 프로필.
 *
 * 아직 API 가 없어 목데이터를 읽는다. 붙으면 이 파일만 fetch 로 바꾼다.
 *
 * 남이 보는 화면이라 나중에는 검색에 걸릴 수 있다. 다만 사람 정보라
 * 색인 여부는 따로 정해야 한다. 지금은 가짜 데이터라 막아 둔다.
 */
const USERS: Record<string, ProfileData> = {
  /* 채울 것이 다 있는 사람. 서버가 아직 안 주는 두 값
     (lastSeenAt · district) 이 들어왔을 때의 모습이다 */
  u_host: {
    id: 'u_host',
    nickname: '덕질하는오리',
    imageUrl: '/avatar/a1.webp',
    bio: '팝업이랑 생카 자주 다녀요. 오픈런도 곧잘 합니다.',
    doneCount: 3,
    joinedAt: '2026-06-11T00:00',
    lastSeenAt: '2026-08-30T21:10',
    posts: [
      {
        id: 'p1',
        title: '에이티즈 팝업 오픈런 같이 하실 분',
        state: 'OPEN',
        meetAt: '2026-09-14T09:00',
        district: '여의도',
        /* 모집글 상세(posts.sample.json)가 쓰는 것과 같은 포스터다.
           같은 글이 화면마다 다른 사진이면 같은 글로 안 보인다 */
        imageUrl:
          'https://cdn.popga.co.kr/spot/8417/main/0d0515e8-01f4-4fa6-8def-3fa4030d1063_1786265342238_thumbnail_MAIN_W480.webp',
      },
      /* 행사에 안 붙은 글. 회색 네모 대신 제목에서 뽑은 색이 깔린다 */
      { id: 'p4', title: '원위 팝업 첫날 같이 가요', state: 'CLOSED', closedReason: 'MANUAL', meetAt: '2026-08-28T10:30', district: '성수' },
    ],
  },
  /* 갓 가입해서 셀 것이 하나도 없는 사람. 숫자를 0 으로 채우지 않고
     기록 구간이 통째로 한 줄이 된다 */
  u_b: {
    id: 'u_b',
    nickname: '조용한덕후',
    imageUrl: '/avatar/a3.webp',
    bio: null,
    doneCount: 0,
    joinedAt: '2026-08-29T00:00',
    posts: [],
  },
}

export const metadata: Metadata = {
  title: '프로필 · 덕모임',
  robots: { index: false, follow: false },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {

  const { id } = await params
  const user = USERS[id]
  if (!user) notFound()
  return <Profile user={user} />
}
