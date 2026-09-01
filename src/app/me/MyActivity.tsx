'use client'

/**
 * 내 활동 내역.
 *
 * 알림이 없어서 **사용자가 상태를 확인할 수 있는 유일한 경로**다.
 * 내 글에 댓글이 달렸는지, 내가 단 댓글에 답이 왔는지를 여기서만
 * 알 수 있다. 그래서 홈에서 한 번에 닿아야 한다.
 *
 * 폴링은 하지 않는다. 화면에 들어올 때마다 다시 읽는다. 알림이
 * 없다고 계속 두드리면 서버만 힘들고 사용자는 어차피 화면을
 * 보고 있어야 안다.
 *
 * 신청·수락을 두지 않기로 해서 탭이 둘이다. 내 모집글과 내 댓글.
 */
import { useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Blank, Tabs, Badge, Avatar } from '@/components/ui/Basics'
import type { PostState } from '@/types'

type MyPost = {
  id: string
  title: string
  state: PostState
  meet_at: string
  comment_count: number
  /** 마지막으로 본 뒤에 달린 댓글 수. 알림이 없으니 이 숫자가 알림이다 */
  new_comments: number
}

type MyComment = {
  id: string
  post_id: string
  post_title: string
  body: string
  secret: boolean
  created_at: string
  /** 내 댓글에 답글이 달렸는지 */
  replied: boolean
}

const POSTS: MyPost[] = [
  {
    id: 'p1',
    title: '에이티즈 팝업 오픈런 같이 하실 분',
    state: 'open',
    meet_at: '2026-09-14T09:00',
    comment_count: 5,
    new_comments: 2,
  },
  {
    id: 'p4',
    title: '원위 팝업 첫날 같이 가요',
    state: 'done',
    meet_at: '2026-08-28T10:30',
    comment_count: 8,
    new_comments: 0,
  },
]

const COMMENTS: MyComment[] = [
  {
    id: 'c3',
    post_id: 'p2',
    post_title: '성수 토리든 팝업 평일 낮에 가실 분',
    body: '카톡 아이디 night_ticket 입니다',
    secret: true,
    created_at: '2026-08-30T09:40',
    replied: true,
  },
  {
    id: 'c9',
    post_id: 'p3',
    post_title: '홍대 생카 세 군데 같이 도실 분',
    body: '저도 갈 수 있을 것 같아요! 동선 공유해주실 수 있나요?',
    secret: false,
    created_at: '2026-08-30T18:12',
    replied: false,
  },
]

function whenShort(iso: string) {
  const [d, t] = iso.split('T')
  const [, m, day] = d.split('-')
  return `${Number(m)}/${Number(day)} ${t}`
}

/** 목록 행 오른쪽 끝의 꺾쇠. 누를 수 있다는 표시다 */
function Caret() {
  return (
    <svg className="mymenu__caret" viewBox="0 0 16 16" aria-hidden focusable="false">
      <path
        d="M6 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* 로그인이 없어 내 정보를 서버에서 못 받는다. 붙으면 지운다 */
const ME = {
  id: 'u_host',
  nickname: '덕질하는오리',
  image_url: '/avatar/a1.webp',
  done_count: 3,
}

export default function MyActivity() {
  const [tab, setTab] = useState(0)
  const [empty, setEmpty] = useState(false)

  return (
    <PageShell title="내 활동">
      <div className="whoami">
        <b>화면</b>
        <button aria-pressed={!empty} onClick={() => setEmpty(false)}>정상</button>
        <button aria-pressed={empty} onClick={() => setEmpty(true)}>비었음</button>
      </div>

      {/* 내 정보. 공개 프로필(/u/[id])의 신원 줄과 같은 배치다.
          같은 사람이 화면마다 다르게 보이면 내 프로필이 남에게 어떻게
          보이는지 짐작할 수 없다.

          사진을 누르면 바로 고를 수 있다. 수정 화면에 들어가야만 바꿀
          수 있으면 아바타가 기본값인 채로 남는 사람이 많아진다 */}
      <header className="myid">
        {/* 사진이 가운데다. 이름과 나란히 두면 목록 행처럼 읽혀 내
            프로필이 아니라 남의 목록 한 줄로 보인다. 당근도 프로필
            화면에서 사진을 가운데 크게 둔다 */}
        <label className="myid__pic">
          <Avatar name={ME.nickname} src={ME.image_url} lg />
          <span className="myid__cam" aria-hidden>
            <svg viewBox="0 0 16 16">
              <path
                d="M2.6 4.8h2.2l.9-1.4h4.6l.9 1.4h2.2v7.2H2.6z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="8.4" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          <input type="file" accept="image/*" hidden />
        </label>

        <div className="myid__main">
          <p className="myid__name">{ME.nickname}</p>
          <p className="myid__meta meta">
            <span>동행 {ME.done_count}회</span>
          </p>
        </div>

        {/* 수정 화면으로 간다. 전에는 공개 프로필로 보냈는데 그건
            남에게 보이는 화면이라 고칠 수가 없었다 */}
        <Link className="btn btn--ghost btn--sm" href="/me/edit">
          프로필 수정
        </Link>
      </header>

      {/* 마이페이지에서 찾게 되는 것들. 여기 없으면 어디에도 없다 */}
      <nav className="mymenu">
        <Link className="mymenu__row" href="/p/new">
          <span>모집글 쓰기</span>
          <Caret />
        </Link>
        <Link className="mymenu__row" href="/me/blocked">
          <span>차단한 사람</span>
          <Caret />
        </Link>
        {/* 알림이 1차에 없다. 자리를 비워두면 없는 줄 모르고 찾아
            헤매므로 준비 중이라고 적어 둔다 */}
        <button type="button" className="mymenu__row" disabled>
          <span>알림 설정</span>
          <span className="mymenu__note">준비 중</span>
        </button>
      </nav>

      <Tabs items={['내 모집글', '내 댓글']} on={tab} onPick={setTab} />

      {empty ? (
        <Blank
          title={tab === 0 ? '아직 쓴 모집글이 없어요' : '아직 남긴 댓글이 없어요'}
          desc={tab === 0 ? '같이 갈 사람을 구해보세요' : '마음에 드는 글에 말을 걸어보세요'}
          action={
            /* 빈 화면에서는 이 버튼이 전부다. 눌러도 아무 일이 없으면
               비었다는 사실만 두 번 말하는 셈이다 */
            tab === 0 ? (
              <Link className="btn btn--primary btn--sm" href="/p/new">
                모집글 쓰기
              </Link>
            ) : (
              <Link className="btn btn--ghost btn--sm" href="/p">
                둘러보기
              </Link>
            )
          }
        />
      ) : (
        <ul className="mine">
          {tab === 0 &&
            POSTS.map((p) => (
              <li key={p.id}>
                {/* 목록 행과 같은 순서다. 제목 → 메타 한 줄.
                    화면마다 순서를 바꾸면 같은 글이 다른 물건으로 보인다 */}
                <Link href={`/p/${p.id}`} className="mine__row">
                  <p className="mine__title">
                    {p.state === 'done' && <Badge state={p.state} />}
                    {p.title}
                  </p>
                  <p className="mine__sub meta">
                    <span>{whenShort(p.meet_at)}</span>
                    <span>댓글 {p.comment_count}</span>
                    {/* 알림이 없으니 이 표시가 알림 노릇을 한다 */}
                    {p.new_comments > 0 && <em>새 댓글 {p.new_comments}</em>}
                  </p>
                </Link>
              </li>
            ))}

          {tab === 1 &&
            COMMENTS.map((c) => (
              <li key={c.id}>
                <Link href={`/p/${c.post_id}`} className="mine__row">
                  <div className="mine__head">
                    <span className="mine__on">{c.post_title}</span>
                  </div>
                  <p className="mine__title mine__title--sm">
                    {c.secret && <span className="cmt__lock">비밀</span>} {c.body}
                  </p>
                  <p className="mine__sub meta">
                    <span>{whenShort(c.created_at)}</span>
                    {c.replied && <em>답글 옴</em>}
                  </p>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </PageShell>
  )
}
