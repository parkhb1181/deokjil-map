'use client'

/**
 * 공개 프로필.
 *
 * 남의 프로필을 보는 화면이다. 답해야 하는 질문은 하나다 —
 * **이 사람이랑 만나도 되나.**
 *
 * 당근 중고거래 프로필의 순서를 따랐다. 거기도 낯선 사람을 만나기
 * 전에 상대를 가늠하는 화면이라 하는 일이 같다.
 *   신원 → 신뢰 요약(매너온도) → 이 사람이 내놓은 것
 *
 * 1차에서는 「같이 다닌 기록」을 통째로 뺐다. 동행 횟수·완료율·댓글
 * 응답이 다 여기 있었다. **도메인 모델에는 남기고 화면에서만 뺀다.**
 * PostAuthor.done_count 와 ProfileData.done_count 는 그대로 두었다.
 *
 * 연령대도 넣지 않는다. 가입 때 받아 미성년 차단에만 쓰는 값이라
 * 남에게 보여줄 이유가 없다. 쓰지도 않을 것을 공개하면 유출됐을 때
 * 잃을 것만 늘어난다.
 *
 * 그래서 남는 것은 닉네임 · 소개 · 쓴 모집글이다. 낯선 사람을 만나기
 * 전에 볼 것이 줄어드는 것은 맞는데, 표본이 0~3 인 숫자를 신뢰 신호로
 * 쓰는 것보다는 낫다는 판단이다. 되살릴 때는 이 파일과 위 타입만
 * 보면 된다.
 *
 * 신고는 헤더의 더보기에 있다. 본문에 두면 프로필을 열자마자 "이 사람을
 * 어떻게 처리할까" 가 먼저 보인다.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Badge, Blank } from '@/components/ui/Basics'
import { ReportSheet } from '@/components/ui/ReportSheet'
import { swatchOf } from '@/lib/visual'
import { isClosed, type PostState } from '@/types'

export type ProfilePost = {
  id: string
  title: string
  state: PostState
  meet_at: string
  /**
   * 만나는 구역. 모집글 자체에는 없고 붙은 행사에서 온다.
   * 조인이라 서버가 채운다. 없으면 메타 줄에서 빠진다
   */
  district?: string | null
  /**
   * 붙은 행사의 대표 사진. 우리가 복제해 두지 않고 원본 서버 주소를
   * 그대로 들고 있는다. 포스터는 저작물이다 (CLAUDE.md).
   * 행사에 안 붙은 글도 있어서 없을 수 있다
   */
  image_url?: string | null
}

export type ProfileData = {
  id: string
  nickname: string
  image_url?: string | null
  bio?: string | null
  done_count: number
  joined_at: string
  /**
   * 마지막 활동 시각. 알림이 없는 서비스라 "내 댓글을 볼 사람인가" 가
   * 여기 걸린다. 서버가 채우며 아직 응답에 없다 (docs/FRONTEND.md)
   */
  last_seen_at?: string | null
  posts: ProfilePost[]
}

function monthOf(iso: string) {
  const [y, m] = iso.split('T')[0].split('-')
  return `${y}년 ${Number(m)}월`
}

function whenShort(iso: string) {
  const [d, t] = iso.split('T')
  const [, m, day] = d.split('-')
  return `${Number(m)}/${Number(day)} ${t}`
}

/** 'YYYY-MM-DD' 두 개의 날짜 차이. 날짜만 있는 값이라 UTC 로 읽어 시차를 없앤다 */
function daysBetween(from: string, to: string) {
  const p = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  return Math.round((p(to) - p(from)) / 86400000)
}

/**
 * 마지막 활동을 사람이 읽는 말로. 정확한 시각을 적지 않는 이유는
 * 그게 필요한 정보가 아니어서다. 알고 싶은 것은 "지금 연락이 닿나" 다.
 */
function activeLabel(lastSeen: string, today: string) {
  const d = daysBetween(lastSeen.split('T')[0], today)
  if (d <= 0) return '오늘 활동'
  if (d === 1) return '어제 활동'
  if (d <= 3) return '3일 이내 활동'
  if (d <= 7) return '일주일 이내 활동'
  if (d <= 30) return '한 달 이내 활동'
  return '한 달 넘게 활동 없음'
}

export default function Profile({ user }: { user: ProfileData }) {
  /* 로그인이 없어 내 프로필인지 알 수 없다. 개발용으로 바꿔본다 */
  const [mine, setMine] = useState(false)
  const [ask, setAsk] = useState<null | 'report'>(null)

  /* 오늘 날짜는 useEffect 에서 확정한다. 서버 프리렌더 시점은 빌드
     시각이라 그대로 쓰면 배포 다음날부터 "3일 이내" 가 어긋난다 */
  const [today, setToday] = useState('')
  useEffect(() => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    setToday(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  }, [])

  const active = today && user.last_seen_at ? activeLabel(user.last_seen_at, today) : null

  /* 「모집글 N개 중 M개 완료」의 M. 방장이 닫은 것만 센다.
     행사가 끝나 저절로 닫힌 글은 이 사람이 한 일이 아니다 */
  /* 진행 중인 것이 먼저다. 그 안에서는 만나는 날이 가까운 순,
     끝난 것은 최근 것부터 */
  const posts = useMemo(
    () =>
      [...user.posts].sort((a, b) => {
        if (a.state !== b.state) return a.state === 'open' ? -1 : 1
        return a.state === 'open'
          ? a.meet_at < b.meet_at ? -1 : 1
          : a.meet_at < b.meet_at ? 1 : -1
      }),
    [user.posts],
  )

  return (
    <PageShell
      title="프로필"
      right={
        mine ? (
          /* 프로필 수정 화면은 1차에 없다 (화면 목록 12개에 없음).
             자기 상태를 확인하는 유일한 화면으로 보낸다 */
          <Link className="btn btn--ghost btn--sm" href="/me">내 활동</Link>
        ) : (
          /* 신고는 여기 넣는다. 본문에 두면 프로필을 열자마자 사람을
             어떻게 처리할지가 먼저 보인다.

             차단을 뺀 뒤로 할 것이 신고 하나라 중간 메뉴를 없앴다.
             한 줄짜리 메뉴는 누르는 횟수만 늘린다 */
          <button
            type="button"
            className="shell__more"
            aria-label="신고"
            onClick={() => setAsk('report')}
          >
            <svg viewBox="0 0 20 20" aria-hidden focusable="false">
              <circle cx="10" cy="4" r="1.6" fill="currentColor" />
              <circle cx="10" cy="10" r="1.6" fill="currentColor" />
              <circle cx="10" cy="16" r="1.6" fill="currentColor" />
            </svg>
          </button>
        )
      }
    >
      <div className="whoami">
        <b>보는 사람</b>
        <button aria-pressed={!mine} onClick={() => setMine(false)}>남</button>
        <button aria-pressed={mine} onClick={() => setMine(true)}>나</button>
      </div>

      {/* 신원. 당근 중고거래 상세의 판매자 행과 같은 배치다.
          아바타가 왼쪽, 이름과 숫자가 그 오른쪽 */}
      <header className="prof">
        <div className="prof__id">
          {/* 크기는 .prof .avatar 가 56px 로 정한다 */}
          <Avatar name={user.nickname} src={user.image_url ?? undefined} />
          <div className="prof__idmain">
            <h1 className="prof__name">{user.nickname}</h1>

            <p className="prof__meta meta">
              {/* 활동 시각은 서버가 아직 안 준다. 없으면 칸이 하나 준다 */}
              {active && <span>{active}</span>}
              <span>{monthOf(user.joined_at)} 가입</span>
            </p>
          </div>
        </div>

        {user.bio ? (
          <p className="prof__bio">{user.bio}</p>
        ) : (
          <p className="prof__bio prof__bio--none">소개가 아직 없어요</p>
        )}
      </header>

      {/* 당근의 매너온도 자리. 게이지 하나로 뭉뚱그리지 않고
          무엇을 보고 그렇게 말하는지 그대로 적는다 */}
      <section className="prof__posts">
        <h2 className="prof__h2">
          쓴 모집글 {user.posts.length > 0 && <span className="prof__count">{user.posts.length}</span>}
        </h2>

        {posts.length === 0 ? (
          <Blank title="아직 쓴 글이 없어요" art={false} />
        ) : (
          /* 전체 보기를 두지 않고 다 편다. 한 사람이 쓰는 모집글은
             당근의 판매물품처럼 열 개씩 쌓이지 않는다. 잘라두면
             갈 곳 없는 '전체 보기' 만 하나 생긴다 */
          <ul className="mine">
            {posts.map((p) => {
              const sw = swatchOf(p.title)
              return (
                <li key={p.id}>
                  <Link href={`/p/${p.id}`} className="mine__row mine__row--thumb">
                    {/* 어느 행사인지 글자보다 먼저 알려준다. 사진이 없는
                        글에 회색 네모를 두면 안 불러와진 것처럼 보여서
                        제목에서 뽑은 색을 깐다 (lib/visual.ts) */}
                    {p.image_url ? (
                      <img className="mine__thumb" src={p.image_url} alt="" loading="lazy" />
                    ) : (
                      <span
                        className="mine__thumb"
                        style={{ background: `linear-gradient(150deg, ${sw.from}, ${sw.to})` }}
                        aria-hidden
                      />
                    )}

                    <div className="mine__main">
                      <p className="mine__title">
                        {isClosed(p.state) && <Badge state={p.state} />}
                        {p.title}
                      </p>
                      {/* .meta 순서는 어디서 → 언제다 (SCALE.md) */}
                      <p className="mine__sub meta">
                        {p.district && <span>{p.district}</span>}
                        <span>{whenShort(p.meet_at)}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {ask === 'report' && (
        <ReportSheet target="user" name={user.nickname} onClose={() => setAsk(null)} />
      )}
    </PageShell>
  )
}
