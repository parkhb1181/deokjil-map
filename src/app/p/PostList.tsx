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
  const [q, setQ] = useState('')
  const [view, setView] = useState<(typeof VIEWS)[number]>('정상')
  const [ask, setAsk] = useState(false)

  /**
   * 상태 탭 + 검색.
   *
   * **브라우저에서 거른다.** 목록이 이미 다 내려와 있어서 타자 칠 때마다
   * 바로 좁혀진다. 서버로 보내면 글자 하나에 한 번씩 왕복한다.
   *
   * 글이 늘어 목록을 나눠 받게 되면(페이지네이션) 이 방식은 받아온
   * 페이지 안에서만 찾게 된다. 그때는 서버로 옮겨야 한다.
   *
   * 제목·장소·행사명을 다 본다. 사람들이 "성수" 로도 찾고 "에이티즈"
   * 로도 찾는데 어느 칸에 있는지는 모른다.
   */
  const list = useMemo(() => {
    const byState = tab === 'open' ? posts.filter((p) => p.state === 'open') : posts
    const key = q.trim().toLowerCase()
    if (!key) return byState
    return byState.filter((p) =>
      `${p.title} ${p.meet_place} ${p.event_title ?? ''}`.toLowerCase().includes(key),
    )
  }, [posts, tab, q])

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
        {/* 검색은 탭 위에 둔다. 아래에 두면 탭을 바꿀 때마다 검색어가
            남아 있는지 눈으로 확인하러 내려가야 한다 */}
        <div className="psearch">
          <svg viewBox="0 0 16 16" aria-hidden focusable="false">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제목 · 장소 · 행사로 찾기"
            aria-label="모집글 검색"
          />
        </div>

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
            {/* 행 하나의 높이. 자리를 실제 크기로 잡아둬야 그림이
                들어올 때 목록이 밀리지 않는다 */}
            <Skeleton h={130} />
            <Skeleton h={130} />
            <Skeleton h={130} />
            <Skeleton h={130} />
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

        {/* 검색해서 0건인 것과 원래 글이 없는 것은 다르다. 같은 문구를
            띄우면 "처음으로 동행을 구해보세요" 를 검색 결과에서 보게 된다 */}
        {view === '정상' && list.length === 0 && q.trim() && (
          <Blank
            title={`'${q.trim()}' 로 찾은 글이 없어요`}
            desc="다른 말로 찾아보거나 직접 글을 써보세요"
            art={false}
            action={
              <Button size="sm" tone="ghost" onClick={() => setQ('')}>
                검색어 지우기
              </Button>
            }
          />
        )}

        {view === '정상' && (
          <div className="plist__body">
            {list.map((p) => (
              <Link key={p.id} href={`/p/${p.id}`} className="plist__link">
                {/* 본문 요약과 인원은 넘기지 않는다. 요약은 제목과 같은
                    말을 두 번 하고, 인원은 신청·수락을 두지 않아 정원이
                    아니라 희망사항이라 목록에서 거를 근거가 안 된다.
                    둘 다 상세에는 그대로 있다.

                    댓글 수는 글자 줄이 아니라 오른쪽 말풍선으로 나간다 */}
                <PostCard
                  state={p.state}
                  title={p.title}
                  when={whenShort(p.meet_at)}
                  where={p.meet_place}
                  image={p.image_url}
                  comments={p.comment_count}
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
