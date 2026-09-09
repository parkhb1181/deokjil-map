'use client'

/**
 * 내 활동 내역을 서버에서 받아 그린다.
 *
 * ─────────────────────────────────────────────────────────
 * **서버 컴포넌트로 못 받는다.**
 *
 * 「나」 가 누구인지는 토큰이 정하는데 토큰은 `localStorage` 에 있어
 * 브라우저만 안다. 모집글 목록·상세는 비회원에게도 보여줄 것이 있어서
 * 서버가 먼저 그리고 브라우저가 채웠지만, 이 화면은 로그인 전에는 보여줄
 * 것이 아예 없다. 그래서 처음부터 브라우저가 받는다.
 *
 * 목데이터 경로는 이 파일을 지나지 않는다 (`page.tsx` 가 갈린다).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProfileView, { type MyComment, type ProfileData } from '@/components/ProfileView'
import { Blank, Button, Skeleton } from '@/components/ui/Basics'
import { PageShell } from '@/components/ui/PageShell'
import { fetchMe } from '@/lib/api/users'
import { fetchMyComments } from '@/lib/api/comments'
import { fetchMyPosts } from '@/lib/api/posts'
import { slotFor } from '@/lib/api/errors'
import { authed } from '@/lib/auth/authed'
import { getAccessToken } from '@/lib/auth/session'
import { toProfilePost } from '@/lib/profile-post'
import { wf } from '@/lib/wireframe'

type State =
  | { k: 'loading' }
  | { k: 'guest' }
  | { k: 'failed'; text: string }
  | { k: 'ok'; user: ProfileData; comments: MyComment[] }

export default function MyProfile() {
  const router = useRouter()
  const [state, setState] = useState<State>({ k: 'loading' })

  useEffect(() => {
    if (!getAccessToken()) {
      setState({ k: 'guest' })
      return
    }

    let alive = true
    /*
     * 셋을 같이 받는다. 순서대로 기다리면 화면이 세 번 바뀌고, 그 사이에
     * 프로필만 있고 글·댓글은 비어 있는 상태가 잠깐 보인다 — 아무것도 안
     * 쓴 사람과 구분이 안 된다.
     */
    authed((t) => Promise.all([fetchMe(t), fetchMyComments(t), fetchMyPosts(t)]))
      .then(([me, cm, ps]) => {
        if (!alive) return

        /*
         * **가입을 안 끝낸 계정을 여기 세워두지 않는다.** 카카오 로그인만
         * 하고 닉네임을 아직 안 정한 사람인데, 그 상태로는 이름이 비어
         * 있고 쓰기도 전부 막혀 있다 (AU-07). 빈 프로필을 보여주고 왜
         * 아무것도 안 되는지는 말 안 하느니 가입 화면으로 보낸다.
         */
        if (!me.signupCompleted) {
          router.replace(wf('/welcome'))
          return
        }

        setState({
          k: 'ok',
          user: {
            id: me.id,
            /* 위에서 걸렀으므로 여기서는 늘 있다. 타입만 좁힌다 */
            nickname: me.nickname ?? '',
            profileImageUrl: me.profileImageUrl,
            bio: me.bio,
            /* 접속이 관측된 적 없으면 null 이다. 화면은 그 줄을 안 그린다 */
            lastSeen: me.lastSeen ?? undefined,
            posts: ps.items.map(toProfilePost),
          },
          comments: cm.items.map((c) => ({
            id: c.id,
            postId: c.postId,
            postTitle: c.postTitle,
            /* 내 댓글이라 본문이 온다. 없으면 빈 문자열로 두고 자리는 남긴다 */
            body: c.content ?? '',
            secret: c.secret,
            createdAt: c.createdAt,
          })),
        })
      })
      .catch((e) => {
        if (!alive) return
        const slot = slotFor(e)
        setState(slot.at === 'login' ? { k: 'guest' } : { k: 'failed', text: slot.text })
      })

    return () => {
      alive = false
    }
  }, [router])

  if (state.k === 'loading') {
    return (
      <PageShell title="내 활동">
        <div className="form">
          <Skeleton h={96} />
          <Skeleton h={130} />
          <Skeleton h={130} />
        </div>
      </PageShell>
    )
  }

  if (state.k === 'guest') {
    return (
      <PageShell title="내 활동">
        <Blank
          title="로그인하면 내 활동을 볼 수 있어요"
          desc="닉네임만 정하면 바로 쓸 수 있어요"
          action={
            <Button
              size="sm"
              tone="kakao"
              onClick={() => router.push(wf(`/login?next=${encodeURIComponent(wf('/me'))}`))}
            >
              로그인
            </Button>
          }
        />
      </PageShell>
    )
  }

  if (state.k === 'failed') {
    return (
      <PageShell title="내 활동">
        <Blank
          title="불러오지 못했어요"
          desc={state.text}
          action={
            <Button size="sm" tone="ghost" onClick={() => location.reload()}>
              다시 시도
            </Button>
          }
        />
      </PageShell>
    )
  }

  /*
   * `postsReady` 를 안 넘긴다 (기본값이 참이다). 한동안 거짓으로 두고
   * 「곧 볼 수 있어요」 를 띄웠는데, 서버가 안 주던 시절의 이야기다. 이제
   * 빈 목록은 진짜로 안 쓴 것이므로 「아직 쓴 글이 없어요」 가 맞다.
   */
  return <ProfileView user={state.user} isMe comments={state.comments} />
}
