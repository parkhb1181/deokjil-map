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
import { slotFor } from '@/lib/api/errors'
import { authed } from '@/lib/auth/authed'
import { getAccessToken } from '@/lib/auth/session'
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
     * 둘을 같이 받는다. 순서대로 기다리면 화면이 두 번 바뀌고, 그 사이에
     * 프로필만 있고 댓글은 비어 있는 상태가 잠깐 보인다 — 댓글이 없는
     * 사람과 구분이 안 된다.
     */
    authed((t) => Promise.all([fetchMe(t), fetchMyComments(t)]))
      .then(([me, cm]) => {
        if (!alive) return
        setState({
          k: 'ok',
          user: {
            id: me.id,
            nickname: me.nickname,
            profileImageUrl: me.profileImageUrl,
            bio: me.bio,
            lastSeen: me.lastSeen,
            /*
             * **내 모집글은 아직 서버가 안 준다.** `/users/me/posts` 가
             * 계약에는 있는데(AU-10) 구현이 없다. 빈 배열을 넘기면 화면은
             * 「아직 쓴 글이 없어요」 를 띄우는데, 쓴 사람에게는 그것이
             * 거짓말이다. 그 탭이 생기면 여기만 채운다.
             */
            posts: [],
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
  }, [])

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

  return <ProfileView user={state.user} isMe comments={state.comments} postsReady={false} />
}
