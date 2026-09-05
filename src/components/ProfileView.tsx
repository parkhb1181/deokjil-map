'use client'

/**
 * 프로필 하나로 합친 화면.
 *
 * 「공개 프로필(/u/[id])」과 「내 활동(/me)」이 따로 있었다. 둘 다 하는
 * 일이 **아바타 + 닉네임 + 쓴 모집글**이고, 갈리는 것은 넷뿐이었다.
 *   나만  — 제재 안내 · 내 댓글 탭 · 프로필 수정 · 마이메뉴
 *   남만  — 신고
 *
 * 그래서 렌더러를 하나로 합쳤다. 당근 프로필도 같은 구조다.
 *
 * **다만 주소는 둘을 남긴다.** 합치고 싶은 유혹이 있지만 세 가지가 걸린다.
 *   1. 「내 댓글」에는 비밀 댓글이 들어 있다. 주소가 갈려 있으면 서버
 *      응답 자체가 달라 유출 경로가 아예 없다. 하나로 접으면 그 여유가
 *      `isMe` 불리언 하나로 줄어든다
 *   2. `/u/[id]` 는 공유되는 주소이고 `/me` 는 아니다. 색인·캐시 정책이 다르다
 *   3. 명세에서 AU-09(공개 프로필)와 AU-10(내 활동)이 다른 요구사항이다
 *
 * 합쳐서 실제로 얻는 것은 중복 제거만이 아니다. **백엔드 응답 명세가
 * 하나 준다.** `GET /users/{id}` 가 본인일 때만 댓글·제재를 더 실어
 * 보내면 된다. API 를 붙이기 전에 하는 편이 싸다.
 */
import { useMemo, useState } from 'react'
import { useViewer } from '@/lib/auth/useViewer'
import { USE_API } from '@/lib/api/config'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Badge, Blank, Button, Tabs } from '@/components/ui/Basics'
import { ReportSheet } from '@/components/ui/ReportSheet'
import { SanctionBanner, SanctionBlock } from '@/components/ui/SanctionNotice'
import { swatchOf } from '@/lib/visual'
import { canWrite, isBlocked, isClosed, LAST_SEEN_LABEL, type ClosedReason, type LastSeen, type PostState, type Sanction } from '@/types'
import { wf } from '@/lib/wireframe'
import { shortTime as whenShort } from '@/lib/when'

export type ProfilePost = {
  id: string
  title: string
  status: PostState
  closedReason?: ClosedReason | null
  meetAt: string
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
  imageUrl?: string | null
  /** 아래 둘은 내 화면에서만 쓴다. 남의 글에 몇 명이 붙었는지는 알 바 아니다 */
  commentCount?: number
  /** 마지막으로 본 뒤에 달린 댓글 수. 알림이 없으니 이 숫자가 알림이다 */
  newComments?: number
}

export type MyComment = {
  id: string
  postId: string
  postTitle: string
  body: string
  secret: boolean
  createdAt: string
  /** 내 댓글에 답글이 달렸는지 */
  replied: boolean
}

/**
 * 프로필에 싣는 값.
 *
 * **마지막 활동 시각과 가입월을 뺐다.** 「3일 이내 활동」 · 「2026년 6월
 * 가입」 이 그것이다. 둘 다 낯선 사람이 나를 가늠하는 데 쓰라고 둔
 * 값인데, 실제로는 그 사람이 언제 접속하는지와 얼마나 오래 있었는지를
 * 남에게 알려준다. 연령대를 공개 프로필에서 뺀 것과 같은 이유다.
 * 쓰지도 않을 것을 내보이면 잃을 것만 늘어난다.
 *
 * 타입에서도 뺀다. 화면에서만 가리고 응답에 남겨두면 개발자 도구로
 * 그냥 읽힌다. 서버가 애초에 안 보내야 한다.
 */
export type ProfileData = {
  id: string
  nickname: string
  imageUrl?: string | null
  bio?: string | null
  lastSeen?: LastSeen
  posts: ProfilePost[]
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

/* 로그인이 없어 서버에서 제재 상태를 못 받는다. 붙으면 지운다 */
const SANCTIONS: Record<string, Sanction | null> = {
  없음: null,
  경고: {
    kind: 'WARNED',
    reason: '모집글에 같은 내용을 반복해서 올렸습니다.',
    issuedAt: '2026-08-30T14:00',
  },
  /* 나이 확인. 사유가 본인에게 그대로 보이므로 「신고가 들어왔다」 가
     아니라 무엇을 확인하려는지를 적는다. 신고가 들어온 사실을 그대로
     옮기면 누가 신고했는지 짐작하게 되고, 그러면 보복이 온다 */
  '나이 확인': {
    kind: 'AGE_HOLD',
    reason: '가입할 때 적으신 출생연도가 맞는지 확인하려고 합니다.',
    issuedAt: '2026-09-01T18:20',
  },
  '7일 정지': {
    kind: 'SUSPENDED',
    reason: '약속한 날에 연락 없이 나타나지 않았다는 신고가 세 건 접수되었습니다.',
    until: '2026-09-08T00:00',
    issuedAt: '2026-09-01T09:00',
  },
  영구: {
    kind: 'BANNED',
    reason: '다른 이용자에게 반복적으로 불쾌한 메시지를 보냈습니다.',
    issuedAt: '2026-08-25T11:00',
  },
}

export default function ProfileView({
  user,
  isMe = false,
  comments = [],
}: {
  user: ProfileData
  /** 내 프로필이면 제재·마이메뉴·내 댓글 탭이 붙는다 */
  isMe?: boolean
  /** 내 화면에서만 쓴다. 남에게는 애초에 보내지 않는다 */
  comments?: MyComment[]
}) {
  /* 로그인이 없어 내 프로필인지 서버가 못 알려준다. 개발용으로 뒤집어
     본다. 같은 렌더러라 이 토글 하나로 두 화면을 나란히 비교할 수 있다 */
  /*
   * 내 프로필인가.
   *
   * API 가 붙으면 서버 세션의 userId 와 이 프로필의 id 를 견준다.
   * 없으면 아래 막대가 정한다.
   */
  const [devMine, setDevMine] = useState(isMe)
  const { viewer } = useViewer({ role: 'guest', userId: null, sanction: null })
  const mine = USE_API ? viewer.userId === user.id : devMine
  const [ask, setAsk] = useState<null | 'report'>(null)
  const [tab, setTab] = useState(0)
  const [empty, setEmpty] = useState(false)
  const [sanc, setSanc] = useState<keyof typeof SANCTIONS>('없음')
  /* 제재도 서버가 정한다. 남의 프로필에는 애초에 안 내려온다 */
  const sanction = USE_API ? (mine ? viewer.sanction : null) : mine ? SANCTIONS[sanc] : null

  /* 진행 중인 것이 먼저다. 그 안에서는 만나는 날이 가까운 순,
     끝난 것은 최근 것부터 */
  const posts = useMemo(
    () =>
      [...user.posts].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'OPEN' ? -1 : 1
        return a.status === 'OPEN'
          ? a.meetAt < b.meetAt ? -1 : 1
          : a.meetAt < b.meetAt ? 1 : -1
      }),
    [user.posts],
  )

  /* 정지·영구는 화면을 통째로 차지한다 (AD-04). 목록을 보여주고
     쓰기만 막으면 "왜 안 써지지" 를 알 방법이 없다.

     나이 확인은 여기 안 들어간다. 처리방침 제10조가 읽는 것은 막지
     않는다고 약속했다. 그래서 kind 를 직접 비교하지 않고 isBlocked 를
     쓴다. 「경고가 아니면 막는다」 로 두면 상태가 하나 늘 때마다
     읽기까지 막히는 쪽으로 조용히 넘어간다 */
  const blocked = isBlocked(sanction)
  /** 쓰기만 막힌 상태. 마이메뉴의 글쓰기를 여기서 막는다 */
  const noWrite = !canWrite(sanction)

  return (
    <PageShell
      title={mine ? '내 프로필' : '프로필'}
      right={
        mine ? undefined : (
          /* 점 세 개가 아니라 「신고」 라고 적는다. 차단을 뺀 뒤로
             거기서 할 수 있는 것이 신고 하나뿐인데, 점 세 개는
             무엇이 들었는지 눌러봐야 안다. 할 일이 하나면 그 이름을
             그대로 쓰는 편이 짧다 */
          <Button size="sm" tone="ghost" onClick={() => setAsk('report')}>
            신고
          </Button>
        )
      }
    >
      {/* 개발용. 서버 세션이 정하기 시작하면 안 그린다 */}
      {!USE_API && (
        <div className="whoami">
          <b>보는 사람</b>
          <button aria-pressed={!devMine} onClick={() => setDevMine(false)}>남</button>
          <button aria-pressed={devMine} onClick={() => setDevMine(true)}>나</button>
        </div>
      )}

      {mine && (
        <>
          <div className="whoami">
            <b>화면</b>
            <button aria-pressed={!empty} onClick={() => setEmpty(false)}>정상</button>
            <button aria-pressed={empty} onClick={() => setEmpty(true)}>비었음</button>
          </div>

          {/* 제재를 받은 사람에게 무엇이 보이는지 확인한다 */}
          {!USE_API && (
            <div className="whoami">
              <b>제재</b>
              {(Object.keys(SANCTIONS) as (keyof typeof SANCTIONS)[]).map((k) => (
                <button key={k} aria-pressed={sanc === k} onClick={() => setSanc(k)}>
                  {k}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {blocked && sanction && <SanctionBlock sanction={sanction} />}
      {/* 경고는 막지 않는다. 막을 거면 정지를 주면 된다 */}
      {mine && <SanctionBanner sanction={sanction} />}

      {blocked ? null : (
        <>
          {mine ? (
            /* 사진이 가운데다. 이름과 나란히 두면 목록 행처럼 읽혀 내
               프로필이 아니라 남의 목록 한 줄로 보인다. 당근도 프로필
               화면에서 사진을 가운데 크게 둔다.

               사진을 누르면 바로 고를 수 있다. 수정 화면에 들어가야만
               바꿀 수 있으면 아바타가 기본값인 채로 남는 사람이 많아진다 */
            <header className="myid">
              <label className="myid__pic">
                <Avatar name={user.nickname} src={user.imageUrl ?? undefined} lg />
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
                <p className="myid__name">{user.nickname}</p>
                <p className="myid__meta meta">
                  {user.lastSeen && <span>{LAST_SEEN_LABEL[user.lastSeen]}</span>}
                </p>
                {/* 한줄소개를 내 화면에도 띄운다. 남에게 보이는 문구라
                    내 화면에서 안 보이면 무엇이 걸려 있는지 모른 채로
                    남는다. 비어 있으면 채우라고 말해준다 */}
                {user.bio ? (
                  <p className="myid__bio">{user.bio}</p>
                ) : (
                  <p className="myid__bio myid__bio--none">한줄소개를 아직 안 썼어요</p>
                )}
              </div>

              {/* 수정 화면으로 간다. 전에는 공개 프로필로 보냈는데 그건
                  남에게 보이는 화면이라 고칠 수가 없었다 */}
              <Link className="btn btn--ghost btn--sm" href={wf('/me/edit')}>
                프로필 수정
              </Link>
            </header>
          ) : (
            /* 신원. 당근 중고거래 상세의 판매자 행과 같은 배치다.
               아바타가 왼쪽, 이름과 숫자가 그 오른쪽 */
            <header className="prof">
              <div className="prof__id">
                {/* 크기는 .prof .avatar 가 56px 로 정한다 */}
                <Avatar name={user.nickname} src={user.imageUrl ?? undefined} />
                <div className="prof__idmain">
                  <h1 className="prof__name">{user.nickname}</h1>
                  {/* 활동 시각과 가입월을 뺐다. 이유는 ProfileData 주석에 */}
                </div>
              </div>

              {user.bio ? (
                <p className="prof__bio">{user.bio}</p>
              ) : (
                <p className="prof__bio prof__bio--none">소개가 아직 없어요</p>
              )}
            </header>
          )}

          {/* 마이페이지에서 찾게 되는 것들. 여기 없으면 어디에도 없다 */}
          {mine && (
            <nav className="mymenu">
              {/* 쓰기가 막혀 있으면 들어갈 수 있는 링크로 두지 않는다.
                  눌러서 쓰기 화면까지 갔다가 거기서 막히면, 채운 것을
                  잃고 돌아온다. 막힌 것을 여기서 미리 말한다 */}
              {noWrite ? (
                <button type="button" className="mymenu__row" disabled>
                  <span>모집글 쓰기</span>
                  <span className="mymenu__note">나이 확인 중</span>
                </button>
              ) : (
                <Link className="mymenu__row" href={wf('/p/new')}>
                  <span>모집글 쓰기</span>
                  <Caret />
                </Link>
              )}
              {/* 알림이 1차에 없다. 자리를 비워두면 없는 줄 모르고 찾아
                  헤매므로 준비 중이라고 적어 둔다 */}
              <button type="button" className="mymenu__row" disabled>
                <span>알림 설정</span>
                <span className="mymenu__note">준비 중</span>
              </button>
            </nav>
          )}

          {/* 남의 화면에는 탭이 없다. 볼 것이 모집글 하나뿐이라
              탭 하나짜리 줄은 자리만 먹는다 */}
          {mine ? (
            <Tabs items={['내 모집글', '내 댓글']} on={tab} onPick={setTab} />
          ) : (
            <h2 className="prof__h2">
              쓴 모집글{' '}
              {user.posts.length > 0 && <span className="prof__count">{user.posts.length}</span>}
            </h2>
          )}

          {mine && empty ? (
            <Blank
              title={tab === 0 ? '아직 쓴 모집글이 없어요' : '아직 남긴 댓글이 없어요'}
              desc={tab === 0 ? '같이 갈 사람을 구해보세요' : '마음에 드는 글에 말을 걸어보세요'}
              action={
                /* 빈 화면에서는 이 버튼이 전부다. 눌러도 아무 일이 없으면
                   비었다는 사실만 두 번 말하는 셈이다 */
                tab === 0 ? (
                  <Link className="btn btn--primary btn--sm" href={wf('/p/new')}>
                    모집글 쓰기
                  </Link>
                ) : (
                  <Link className="btn btn--ghost btn--sm" href={wf('/p')}>
                    둘러보기
                  </Link>
                )
              }
            />
          ) : posts.length === 0 && tab === 0 ? (
            <Blank title="아직 쓴 글이 없어요" art={false} />
          ) : (
            /* 전체 보기를 두지 않고 다 편다. 한 사람이 쓰는 모집글은
               당근의 판매물품처럼 열 개씩 쌓이지 않는다. 잘라두면
               갈 곳 없는 '전체 보기' 만 하나 생긴다 */
            <ul className="mine">
              {tab === 0 &&
                posts.map((p) => {
                  const sw = swatchOf(p.title)
                  return (
                    <li key={p.id}>
                      <Link href={wf(`/p/${p.id}`)} className="mine__row mine__row--thumb">
                        {/* 어느 행사인지 글자보다 먼저 알려준다. 사진이 없는
                            글에 회색 네모를 두면 안 불러와진 것처럼 보여서
                            제목에서 뽑은 색을 깐다 (lib/visual.ts) */}
                        {p.imageUrl ? (
                          <img className="mine__thumb" src={p.imageUrl} alt="" loading="lazy" />
                        ) : (
                          <span
                            className="mine__thumb"
                            style={{ background: `linear-gradient(150deg, ${sw.from}, ${sw.to})` }}
                            aria-hidden
                          />
                        )}

                        <div className="mine__main">
                          <p className="mine__title">
                            {isClosed(p.status) && <Badge state={p.status} reason={p.closedReason} />}
                            {p.title}
                          </p>
                          {/* .meta 순서는 어디서 → 언제다 (SCALE.md).
                              내 글에서만 댓글 수가 붙는다 */}
                          <p className="mine__sub meta">
                            {!mine && p.district && <span>{p.district}</span>}
                            <span>{whenShort(p.meetAt)}</span>
                            {mine && p.commentCount !== undefined && (
                              <span>댓글 {p.commentCount}</span>
                            )}
                            {/* 알림이 없으니 이 표시가 알림 노릇을 한다 */}
                            {mine && (p.newComments ?? 0) > 0 && <em>새 댓글 {p.newComments}</em>}
                          </p>
                        </div>
                      </Link>
                    </li>
                  )
                })}

              {mine &&
                tab === 1 &&
                comments.map((c) => (
                  <li key={c.id}>
                    <Link href={wf(`/p/${c.postId}`)} className="mine__row">
                      <div className="mine__head">
                        <span className="mine__on">{c.postTitle}</span>
                      </div>
                      <p className="mine__title mine__title--sm">
                        {c.secret && <span className="cmt__lock">비밀</span>} {c.body}
                      </p>
                      <p className="mine__sub meta">
                        <span>{whenShort(c.createdAt)}</span>
                        {c.replied && <em>답글 옴</em>}
                      </p>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}

      {ask === 'report' && (
        <ReportSheet target="user" name={user.nickname} onClose={() => setAsk(null)} />
      )}
    </PageShell>
  )
}
