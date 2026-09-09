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
import { useEffect, useMemo, useState } from 'react'
import { useViewer } from '@/lib/auth/useViewer'
import { USE_API } from '@/lib/api/config'
import { fetchPosts, type PostListItem } from '@/lib/api/posts'
import { canWrite } from '@/types'
import Link from 'next/link'
import type { ClosedReason, MeetPoint, PostState } from '@/types'
import { PageShell } from '@/components/ui/PageShell'
import { Button, Blank, Skeleton } from '@/components/ui/Basics'
import { PostCard } from '@/components/ui/Post'
import { Sheet } from '@/components/ui/Basics'
import { wf } from '@/lib/wireframe'
import { whenShort } from '@/lib/when'
import { toListItem, type ListItem } from '@/lib/list-item'

/* ListItem 과 toListItem 은 lib/list-item.ts 에 있다. 서버 컴포넌트인
   page.tsx 가 toListItem 을 부르는데 이 파일이 'use client' 라 여기 두면
   Next 가 막는다 — 이유는 그 파일에 적어 뒀다 */
export type { ListItem }

/* 상태 필터. 기본은 모집중만 본다. 끝난 글까지 섞으면
   목록이 두 배가 되고 정작 갈 수 있는 글이 묻힌다 */


const TABS = [
  { key: 'OPEN', label: '모집중' },
  { key: 'all', label: '전체' },
] as const

/* 화면 상태를 눈으로 확인할 방법이 없어 개발용으로 바꿔본다.
   API 가 붙으면 이 상태와 아래 whoami 막대를 지운다 */
const VIEWS = ['정상', '비었음', '실패', '기다리는 중'] as const

export default function PostList({
  posts,
  nextCursor,
}: {
  posts: ListItem[]
  /**
   * 다음 장을 가리키는 커서. `null` 이면 마지막 장이다.
   *
   * **없으면 첫 20건이 전부가 된다.** 서버가 커서 페이지네이션이라
   * (API 설계 3장) 한 번 부르면 한 장만 온다. 한동안 이 값을 안 받아서
   * 21번째 글부터는 어떤 화면으로도 닿을 수 없었다. 시드가 몇 건뿐이라
   * 눈에 안 띄었을 뿐이다.
   */
  nextCursor?: string | null
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('OPEN')
  const [q, setQ] = useState('')
  const [view, setView] = useState<(typeof VIEWS)[number]>('정상')
  const [ask, setAsk] = useState(false)
  /*
   * 글쓰기가 막혔는가.
   *
   * VIEWS 에 넣지 않은 이유는 그것이 목록 자체의 상태라, 거기에
   * 섞으면 「나이 확인 중」 을 고르는 순간 목록이 사라지기 때문이다.
   * 여기서 막는 것은 글쓰기 하나뿐이고 목록은 그대로다.
   *
   * API 가 붙으면 서버가 준 제재 상태가 정한다. 경고는 쓰기를 막지
   * 않고 배너만 띄운다 (AU-12).
   */
  const [devHold, setDevHold] = useState(false)
  const { viewer } = useViewer({ role: 'guest', userId: null, sanction: null })
  const hold = USE_API ? !canWrite(viewer.sanction) : devHold

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
  /**
   * 이어 받은 장들. 서버가 준 첫 장 뒤에 붙는다.
   *
   * 상태를 여기 두는 이유는 첫 장이 props 로 오기 때문이다. 전부를
   * 한 상태에 담고 props 를 초기값으로 쓰면, 글을 쓰고 돌아왔을 때
   * 서버가 준 새 목록이 무시된다 (초기값은 한 번만 읽힌다).
   */
  const [more, setMore] = useState<ListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(nextCursor ?? null)
  const [loadingMore, setLoadingMore] = useState(false)

  /* 서버가 새 첫 장을 주면 이어 받은 것을 버린다. 안 그러면 방금 쓴
     글이 첫 장에 들어오면서 같은 글이 두 번 보인다 */
  useEffect(() => {
    setMore([])
    setCursor(nextCursor ?? null)
  }, [posts, nextCursor])

  const loadMore = () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    fetchPosts({ cursor })
      .then((page) => {
        setMore((prev) => [...prev, ...page.items.map(toListItem)])
        setCursor(page.nextCursor)
      })
      /* 실패하면 커서를 그대로 둔다. 다시 누르면 같은 장을 다시 받는다 */
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  const all = useMemo(() => [...posts, ...more], [posts, more])

  /**
   * **거르기는 받아온 것 안에서만 돈다.**
   *
   * 목록을 나눠 받으므로 검색어가 뒷장에만 있는 글은 안 걸린다. 위
   * 주석이 예고한 상황이 실제로 온 것이고, 제대로 고치려면 서버에
   * `keyword` 를 넘겨야 한다 (API 설계 2-4 는 PO-13 을 브라우저 필터로
   * 뒀지만 그것은 목록이 다 내려온다는 전제였다).
   *
   * 지금은 그대로 둔다. 글이 스무 건을 넘기 시작하면 그때 옮긴다.
   */
  const list = useMemo(() => {
    const byState = tab === 'OPEN' ? all.filter((p) => p.status === 'OPEN') : all
    const key = q.trim().toLowerCase()
    if (!key) return byState
    return byState.filter((p) =>
      `${p.title} ${p.meetPoint.place} ${p.eventTitle ?? ''}`.toLowerCase().includes(key),
    )
  }, [all, tab, q])

  return (
    <PageShell title="동행 모집">
      <div className="whoami">
        <b>화면</b>
        {VIEWS.map((v) => (
          <button key={v} aria-pressed={v === view} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {/* 나이 확인 중인 사람에게 글쓰기가 어떻게 막히는지 확인한다.
          목록은 그대로 읽힌다 (처리방침 제10조).
          서버가 정하기 시작하면 이 막대는 아무것도 못 바꾼다 */}
      {!USE_API && (
        <div className="whoami">
          <b>쓰기</b>
          <button aria-pressed={!devHold} onClick={() => setDevHold(false)}>가능</button>
          <button aria-pressed={devHold} onClick={() => setDevHold(true)}>나이 확인 중</button>
        </div>
      )}

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
              <Link key={p.id} href={wf(`/p/${p.id}`)} className="plist__link">
                {/* 본문 요약과 인원은 넘기지 않는다. 요약은 제목과 같은
                    말을 두 번 하고, 인원은 신청·수락을 두지 않아 정원이
                    아니라 희망사항이라 목록에서 거를 근거가 안 된다.
                    둘 다 상세에는 그대로 있다.

                    댓글 수는 글자 줄이 아니라 오른쪽 말풍선으로 나간다 */}
                <PostCard
                  state={p.status}
                  reason={p.closedReason}
                  title={p.title}
                  when={whenShort(p.meetAt)}
                  where={p.meetPoint.place}
                  image={p.imageUrl}
                  comments={p.commentCount}
                />
              </Link>
            ))}

            {/*
              스크롤로 자동으로 부르지 않고 버튼을 둔다.

              자동이면 목록 끝에 있는 글쓰기 버튼과 하단 탭에 닿기 전에
              계속 새 줄이 밀려 들어와, 아래로 가려던 사람이 못 간다.
              당근·번개장터도 목록이 길어지면 버튼을 쓴다.

              **검색 중에는 감춘다.** 지금 거르기가 받아온 것 안에서만
              돌아서, 더 받으면 결과가 갑자기 늘어나는 것처럼 보인다.
              무엇이 기준인지 알 수 없는 화면이 된다.
            */}
            {cursor && !q.trim() && (
              <div className="plist__more">
                <Button tone="ghost" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? '불러오는 중' : '더 보기'}
                </Button>
              </div>
            )}
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

      {/* 막힌 사유에 따라 시트가 갈린다. 로그인하라는 말과 나이 확인
          중이라는 말은 사용자가 할 일이 정반대다. 하나로 뭉뚱그리면
          이미 로그인한 사람에게 또 로그인하라고 하게 된다 */}
      {ask && (
        hold ? (
          <Sheet
            title="나이 확인 중이에요"
            desc="확인이 끝날 때까지 글과 댓글을 쓸 수 없어요. 답을 주시면 바로 풀립니다. 읽는 것은 그대로 하실 수 있어요."
            foot={
              <>
                <Button tone="ghost" onClick={() => setAsk(false)}>닫기</Button>
                <a className="btn btn--primary" href="mailto:help@duckmoim.com">
                  확인해주기
                </a>
              </>
            }
          />
        ) : (
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
        )
      )}
    </PageShell>
  )
}
