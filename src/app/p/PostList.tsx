'use client'

/**
 * 모집글 목록.
 *
 * 상세에서 정한 것을 그대로 쓴다. 껍데기·빈 화면·실패 화면·카드가
 * 이미 있어서 여기서 새로 정한 것은 필터 하나뿐이다.
 *
 * 비회원도 목록을 본다 (Q-04 노출함). 로그인은 화면이 아니라
 * 행동에 붙는다. 글쓰기를 누를 때 막힌다.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { PostState } from '@/types'
import { PageShell } from '@/components/ui/PageShell'
import { Button, Blank, Skeleton } from '@/components/ui/Basics'
import { PostCard } from '@/components/ui/Post'
import { Sheet } from '@/components/ui/Basics'

export type ListItem = {
  id: string
  event_id: string | null
  event_title: string | null
  title: string
  excerpt: string
  state: PostState
  capacity: number | null
  meet_at: string
  meet_place: string
  author: { id: string; nickname: string; image_url?: string | null; done_count?: number }
  comment_count: number
  /** 붙은 이벤트의 대표 사진. 이벤트에 안 붙은 글은 없다 */
  image_url?: string | null
}

/** '2026-09-14T09:00' → '9/14 (월) 09:00' */
function whenShort(iso: string) {
  const [d, t] = iso.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const dow = '일월화수목금토'[new Date(y, m - 1, day).getDay()]
  return `${m}/${day} (${dow}) ${t}`
}

/* 상태 필터. 기본은 모집중만 본다. 끝난 글까지 섞으면
   목록이 두 배가 되고 정작 갈 수 있는 글이 묻힌다 */
const TABS = [
  { key: 'open', label: '모집중' },
  { key: 'all', label: '전체' },
] as const

/* 화면 상태를 눈으로 확인할 방법이 없어 개발용으로 바꿔본다.
   API 가 붙으면 이 상태와 아래 whoami 막대를 지운다 */
const VIEWS = ['정상', '비었음', '실패', '기다리는 중'] as const

export default function PostList({ posts }: { posts: ListItem[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('open')
  const [view, setView] = useState<(typeof VIEWS)[number]>('정상')
  const [ask, setAsk] = useState(false)

  const list = useMemo(
    () => (tab === 'open' ? posts.filter((p) => p.state === 'open') : posts),
    [posts, tab],
  )

  return (
    <PageShell title="동행 구해요">
      <div className="whoami">
        <b>화면</b>
        {VIEWS.map((v) => (
          <button key={v} aria-pressed={v === view} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      <div className="plist">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tabs__item${t.key === tab ? ' tabs__item--on' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {view === '기다리는 중' && (
          <div className="plist__body">
            {/* 포스터 카드 한 칸의 높이. 자리를 실제 크기로 잡아둬야
                그림이 들어올 때 목록이 밀리지 않는다 */}
            <Skeleton h={296} />
            <Skeleton h={296} />
            <Skeleton h={296} />
            <Skeleton h={296} />
          </div>
        )}

        {view === '실패' && (
          <Blank
            title="목록을 불러오지 못했어요"
            desc="잠시 뒤 다시 시도해주세요"
            action={<Button size="sm" tone="ghost">다시 시도</Button>}
          />
        )}

        {view === '비었음' && (
          <Blank
            title="아직 모집글이 없어요"
            desc="처음으로 동행을 구해보세요"
            action={<Button size="sm" onClick={() => setAsk(true)}>글쓰기</Button>}
          />
        )}

        {view === '정상' && (
          <div className="plist__body">
            {list.map((p) => (
              <Link key={p.id} href={`/p/${p.id}`} className="plist__link">
                {/* 본문 요약·인원·댓글 수를 넘기지 않는다. 요약은 제목과
                    같은 말을 두 번 하고, 인원은 신청·수락을 두지 않아
                    정원이 아니라 희망사항이라 목록에서 거를 근거가 안
                    된다. 댓글 수는 초기에 0~2 라 신호가 되지 않는다.
                    셋 다 상세에는 그대로 있다 */}
                <PostCard
                  state={p.state}
                  title={p.title}
                  when={whenShort(p.meet_at)}
                  where={p.meet_place}
                  image={p.image_url}
                />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 글쓰기는 헤더가 아니라 오른쪽 아래다. 당근이 그 자리에 둔다.
          헤더 오른쪽은 한 손으로 쥔 엄지에서 가장 먼 자리라, 가장 자주
          누를 것을 거기 두면 매번 손을 고쳐 잡아야 한다 */}
      <button type="button" className="fab" onClick={() => setAsk(true)}>
        <svg viewBox="0 0 18 18" aria-hidden focusable="false">
          <path
            d="M9 3.5v11M3.5 9h11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
        글쓰기
      </button>

      {ask && (
        <Sheet
          title="로그인이 필요해요"
          desc="모집글을 쓰려면 로그인해주세요. 닉네임만 정하면 바로 쓸 수 있어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(false)}>나중에</Button>
              <Button tone="kakao" onClick={() => setAsk(false)}>카카오로 시작하기</Button>
            </>
          }
        />
      )}
    </PageShell>
  )
}
