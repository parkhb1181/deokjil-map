import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProfileView, { type ProfileData } from '@/components/ProfileView'
import { USE_API } from '@/lib/api/config'
import { ApiFailure } from '@/lib/api/http'
import { fetchPublicProfile } from '@/lib/api/users'
import { fetchUserPosts } from '@/lib/api/posts'
import { toProfilePost } from '@/lib/profile-post'

/**
 * 공개 프로필 (AU-09).
 *
 * ─────────────────────────────────────────────────────────
 * **서버에서 받는다.**
 *
 * 내 활동(`/me`)과 다르다. 저쪽은 「나」 가 누구인지 토큰이 정해서
 * 브라우저만 알지만, 여기는 주소에 회원번호가 들어 있고 등급이 공개라
 * 서버가 그대로 받아 그릴 수 있다. 낯선 사람을 확인하러 오는 화면이라
 * 첫 그림이 빨리 뜨는 편이 낫다.
 *
 * **두 번 부른다.** 프로필 단건에 모집글이 안 들어 있다 — 계약이
 * 「건수가 늘면 프로필 조회가 같이 무거워진다」 로 갈라 놨다. 둘을 같이
 * 기다린다.
 *
 * **없는 사람 판정은 프로필 쪽이 한다.** 글 목록은 없는 회원번호로 물어도
 * 200 에 빈 페이지를 준다. 그걸로는 「없는 사람」 과 「글 안 쓴 사람」 이
 * 구분되지 않는다.
 *
 * 화면은 `/me` 와 같은 렌더러를 쓴다. 목데이터에서는 개발용 「보는 사람」
 * 토글을 「나」로 넘기면 내 화면이 어떻게 보이는지 여기서 바로 확인할 수
 * 있다.
 */
const USERS: Record<string, ProfileData> = {
  /* 채울 것이 다 있는 사람. 서버가 아직 안 주는 값 (district) 이 들어왔을 때의 모습이다 */
  u_host: {
    id: 'u_host',
    nickname: '덕질하는오리',
    profileImageUrl: '/avatar/a1.webp',
    bio: '팝업이랑 생카 자주 다녀요. 오픈런도 곧잘 합니다.',
    lastSeen: 'WITHIN_3_DAYS',
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
      },
      /* 행사에 안 붙은 글. 회색 네모 대신 제목에서 뽑은 색이 깔린다 */
      { id: 'p4', title: '원위 팝업 첫날 같이 가요', status: 'CLOSED', closedReason: 'MANUAL', meetAt: '2026-08-28T10:30', district: '성수' },
    ],
  },
  /* 갓 가입해서 셀 것이 하나도 없는 사람. 숫자를 0 으로 채우지 않고
     기록 구간이 통째로 한 줄이 된다 */
  u_b: {
    id: 'u_b',
    nickname: '조용한덕후',
    profileImageUrl: '/avatar/a3.webp',
    bio: null,
    lastSeen: 'LONG_AGO',
    posts: [],
  },
}

/**
 * 남이 보는 화면이라 나중에는 검색에 걸릴 수 있다. 다만 사람 정보라
 * 색인 여부는 따로 정해야 한다. 지금은 막아 둔다.
 */
export const metadata: Metadata = {
  title: '프로필 · 덕모임',
  robots: { index: false, follow: false },
}

/**
 * 굽지 않는다. 한줄소개와 최근 접속 구간이 바뀌는 값이라, 정적으로 두면
 * 「3일 이내 접속」 이 배포 시점에 굳는다.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!USE_API) {
    const user = USERS[id]
    if (!user) notFound()
    return <ProfileView user={user} />
  }

  let user: ProfileData
  try {
    const [me, posts] = await Promise.all([fetchPublicProfile(id), fetchUserPosts(id)])
    user = {
      id: me.id,
      nickname: me.nickname,
      profileImageUrl: me.profileImageUrl,
      bio: me.bio,
      /* 접속이 관측된 적 없으면 null 이다. 화면은 그 줄을 안 그린다 */
      lastSeen: me.lastSeen ?? undefined,
      posts: posts.items.map(toProfilePost),
    }
  } catch (e) {
    /* 탈퇴했거나 가입을 안 끝낸 회원이다. 둘을 구분해 알리지 않는다 */
    if (e instanceof ApiFailure && e.httpStatus === 404) notFound()
    throw e
  }

  return <ProfileView user={user} />
}
