'use client'

/**
 * 공개 프로필.
 *
 * 낯선 사람을 만나기 전에 상대를 가늠하는 유일한 화면이다. 그런데
 * 보여줄 것이 별로 없다. 후기도 신뢰점수도 1차에 없고 성별·연령은
 * 노출하지 않기로 했다 (Q-02).
 *
 * 남은 것은 셋이다. 닉네임 · 한줄소개 · 완료한 동행 횟수.
 * 부족하다는 것을 감추지 않고, 대신 그 사람이 쓴 글을 같이 보여준다.
 * 어떤 글을 쓰는 사람인지가 숫자보다 많은 것을 말해준다.
 *
 * 내 프로필이면 수정 버튼이, 남이면 신고·차단이 뜬다.
 */
import { useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Button, Badge, Blank, Sheet } from '@/components/ui/Basics'
import { ReportSheet } from '@/components/ui/ReportSheet'
import type { PostState } from '@/types'

export type ProfileData = {
  id: string
  nickname: string
  image_url?: string | null
  bio?: string | null
  done_count: number
  joined_at: string
  posts: { id: string; title: string; state: PostState; meet_at: string }[]
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

export default function Profile({ user }: { user: ProfileData }) {
  /* 로그인이 없어 내 프로필인지 알 수 없다. 개발용으로 바꿔본다 */
  const [mine, setMine] = useState(false)
  const [ask, setAsk] = useState<null | 'report' | 'block'>(null)

  return (
    <PageShell title="프로필">
      <div className="whoami">
        <b>보는 사람</b>
        <button aria-pressed={!mine} onClick={() => setMine(false)}>남</button>
        <button aria-pressed={mine} onClick={() => setMine(true)}>나</button>
      </div>

      {/* 당근 중고거래 상세의 판매자 행과 같은 배치다. 아바타가 왼쪽,
          이름과 숫자가 그 오른쪽. 가운데 정렬을 쓰지 않는 이유는 다른
          화면이 전부 왼쪽에서 시작하기 때문이다 */}
      <header className="prof">
        <div className="prof__id">
          <Avatar name={user.nickname} src={user.image_url ?? undefined} lg />
          <div className="prof__idmain">
            <h1 className="prof__name">{user.nickname}</h1>

            {/* 보여줄 숫자가 이것 하나뿐이다. 크게 부풀리지 않는다 */}
            <p className="prof__meta meta">
              <span>동행 {user.done_count}회</span>
              <span>{monthOf(user.joined_at)}부터</span>
            </p>
          </div>
        </div>

        {user.bio ? (
          <p className="prof__bio">{user.bio}</p>
        ) : (
          <p className="prof__bio prof__bio--none">소개가 아직 없어요</p>
        )}

        <div className="prof__acts">
          {mine ? (
            <Button size="sm" tone="ghost">프로필 수정</Button>
          ) : (
            <>
              <Button size="sm" tone="ghost" onClick={() => setAsk('report')}>신고</Button>
              <Button size="sm" tone="ghost" onClick={() => setAsk('block')}>차단</Button>
            </>
          )}
        </div>
      </header>

      <section className="prof__posts">
        <h2 className="prof__h2">쓴 모집글</h2>

        {user.posts.length === 0 ? (
          <Blank title="아직 쓴 글이 없어요" art={false} />
        ) : (
          <ul className="mine">
            {user.posts.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} className="mine__row">
                  <p className="mine__title">
                    {p.state === 'done' && <Badge state={p.state} />}
                    {p.title}
                  </p>
                  <p className="mine__sub meta">
                    <span>{whenShort(p.meet_at)}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ask === 'report' && (
        <ReportSheet target="user" name={user.nickname} onClose={() => setAsk(null)} />
      )}

      {ask === 'block' && (
        <Sheet
          title={`${user.nickname} 님을 차단할까요?`}
          /* 차단은 양방향이다. 내가 안 보이는 만큼 나도 안 보인다 (SF-03) */
          desc="서로의 글과 댓글이 보이지 않게 됩니다. 상대에게는 알리지 않아요. 설정에서 되돌릴 수 있습니다."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>취소</Button>
              <Button tone="danger" onClick={() => setAsk(null)}>차단</Button>
            </>
          }
        />
      )}
    </PageShell>
  )
}
