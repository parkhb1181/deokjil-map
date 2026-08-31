'use client'

/**
 * 모집글 상세.
 *
 * 이 화면이 나머지 화면들의 본이다. 여기서 정한 것 넷을 다른
 * 화면이 그대로 가져다 쓴다.
 *   1. 페이지 껍데기 (PageShell)
 *   2. 비회원 게이트 — 보는 것은 열고 쓰는 것만 막는다
 *   3. 로딩 · 실패 · 빈 세 가지
 *   4. 권한별 분기 — 서버가 지운 필드를 화면이 어떻게 다루나
 *
 * 신청·수락을 두지 않기로 해서 사람 구하는 일이 전부 댓글에서
 * 일어난다. 비밀 댓글이 연락처를 주고받는 유일한 통로다.
 */
import { useMemo, useState } from 'react'
import type { CompanionPost, PostComment, Viewer, ViewerRole } from '@/types'
import { PageShell } from '@/components/ui/PageShell'
import { Button, Badge, Who, Blank, Sheet } from '@/components/ui/Basics'
import { Field, TextArea, Checkbox } from '@/components/ui/Field'
import { ReportSheet } from '@/components/ui/ReportSheet'
import { Comment } from '@/components/ui/Post'
import { PlaceMap } from '@/components/ui/PlaceMap'
import { asServerWouldSend, threaded } from '@/lib/comment-perm'

/** '2026-09-14T15:00' → '9월 14일 (일) 오후 3:00' */
function whenText(iso: string) {
  const [d, t] = iso.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  const dow = '일월화수목금토'[new Date(y, m - 1, day).getDay()]
  const ampm = hh < 12 ? '오전' : '오후'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${m}월 ${day}일 (${dow}) ${ampm} ${h12}:${String(mm).padStart(2, '0')}`
}

/** '2026-08-30T09:12' → '8월 30일' */
function dateOnly(iso: string) {
  const [, m, d] = iso.split('T')[0].split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

/** '2026-08-30T09:12' → '8/30 09:12' */
function shortTime(iso: string) {
  const [d, t] = iso.split('T')
  const [, m, day] = d.split('-')
  return `${Number(m)}/${Number(day)} ${t}`
}

const ROLES: { key: ViewerRole; id: string | null; label: string }[] = [
  { key: 'guest', id: null, label: '비회원' },
  { key: 'member', id: 'u_b', label: '일반 회원' },
  { key: 'member', id: 'u_a', label: '댓글 작성자' },
  { key: 'host', id: 'u_host', label: '방장' },
]

export default function PostDetail({ post, comments, hostId }: {
  post: CompanionPost
  comments: PostComment[]
  hostId: string
}) {
  /* 로그인이 없어 화면을 확인할 방법이 없다. 인증이 붙으면 이 상태와
     아래 whoami 막대를 지우고 서버 세션에서 채운다 */
  const [pick, setPick] = useState(3)
  const viewer: Viewer = { role: ROLES[pick].key, user_id: ROLES[pick].id }

  const [draft, setDraft] = useState('')
  const [secret, setSecret] = useState(false)
  /* 'report' 는 모집글 신고, 'report-comment' 는 댓글 신고다. 하나로
     묶어 뒀더니 댓글의 신고를 눌러도 모집글 신고 시트가 떴다.
     ReportSheet 는 처음부터 셋(유저·글·댓글)을 받게 되어 있었고
     부르는 쪽이 target 을 안 넘긴 것이 원인이었다 */
  const [ask, setAsk] = useState<null | 'login' | 'done' | 'report' | 'report-comment'>(null)

  const isHost = viewer.user_id === hostId
  const isGuest = !viewer.user_id

  /* 서버가 보냈을 모습으로 만든 뒤 계층 정렬한다. API 가 붙으면
     asServerWouldSend 만 빠지고 나머지는 그대로다 */
  const list = useMemo(
    () => threaded(asServerWouldSend(comments, viewer, hostId)),
    [comments, viewer.user_id, hostId],
  )

  const submit = () => {
    if (isGuest) return setAsk('login')
    /* 아직 API 가 없다. 붙으면 여기서 POST 하고 목록을 다시 읽는다 */
    setDraft('')
    setSecret(false)
  }

  return (
    <PageShell
      title="동행 구해요"
      right={
        isHost ? (
          <Button size="sm" tone="ghost" onClick={() => setAsk('done')}>
            모집 완료
          </Button>
        ) : (
          <Button size="sm" tone="ghost" onClick={() => setAsk('report')}>
            신고
          </Button>
        )
      }
    >
      {/* 개발용. 인증이 붙으면 통째로 지운다 */}
      <div className="whoami">
        <b>보는 사람</b>
        {ROLES.map((r, i) => (
          <button key={r.label} aria-pressed={i === pick} onClick={() => setPick(i)}>
            {r.label}
          </button>
        ))}
      </div>

      {/* 당근 동네생활 글의 순서를 그대로 쓴다.
          칩 → 글쓴이 → 제목 → 본문 → 카운터 → 댓글 */}
      {post.event_image_url && (
        <img className="post__cover" src={post.event_image_url} alt="" />
      )}

      <article className="post">
        <div className="post__tags">
          <Badge state={post.state} />
          {post.event_id && post.event_title && (
            <a className="post__event" href={`/e/${post.event_id}`}>
              {post.event_title}
            </a>
          )}
        </div>

        <div className="post__who">
          <Who
            name={post.author.nickname}
            src={post.author.image_url ?? undefined}
            sub={`${post.author.done_count ? `동행 ${post.author.done_count}회` : '첫 동행'} · ${dateOnly(post.created_at)}`}
          />
        </div>

        <h1 className="post__title">{post.title}</h1>

        <div className="post__map">
          <PlaceMap lat={post.meet_lat} lng={post.meet_lng} label={post.meet_place} />
        </div>

        {/* 두 줄로 끝낸다. 날짜와 인원이 위, 장소와 마감이 아래다.
            넷을 다 굵게 쓰면 제목과 무게가 비슷해져 둘 다 안 읽힌다 */}
        <p className="post__when">
          {whenText(post.meet_at)}
          {post.capacity ? ` · ${post.capacity}명 모집` : ''}
        </p>
        <p className="post__sub">
          {post.meet_place} · {dateOnly(post.closes_at)} 마감
        </p>

        <div className="post__body">{post.body}</div>


        <div className="post__count">
          <span>댓글 <b>{post.comment_count}</b></span>
          {post.state === 'done' && <span>모집이 끝났어요</span>}
        </div>
      </article>

      <section className="thread">
        <p className="thread__head">비밀 댓글은 방장과 글쓴이만 볼 수 있어요</p>

        {list.length === 0 ? (
          <Blank
            title="아직 댓글이 없어요"
            desc="먼저 말을 걸어보세요"
            art={false}
          />
        ) : (
          list.map((c) => (
            <Comment
              key={c.id}
              name={c.deleted ? '' : c.author.nickname}
              src={c.author.image_url ?? undefined}
              time={shortTime(c.created_at)}
              text={c.body ?? undefined}
              reply={!!c.parent_id}
              secret={c.secret}
              gone={c.deleted}
              host={c.author.id === hostId}
              acts={
                c.deleted ? undefined : (
                  <>
                    {!c.parent_id && <button onClick={() => isGuest && setAsk('login')}>답글</button>}
                    {c.author.id === viewer.user_id ? (
                      <button>삭제</button>
                    ) : (
                      <button onClick={() => setAsk(isGuest ? 'login' : 'report-comment')}>신고</button>
                    )}
                  </>
                )
              }
            />
          ))
        )}
      </section>

      {/* 댓글 입력은 글 맨 아래에 둔다. 화면을 따라다니면 짧은 글에서는
          본문을 가리고, 긴 글에서는 읽는 내내 자리를 뺏는다. 네이버 카페와
          당근이 둘 다 목록 끝에 둔다 */}
      <section className="write">
        {post.state === 'done' ? (
          <p className="write__gate">모집이 끝나 댓글을 받지 않아요</p>
        ) : isGuest ? (
          /* 비회원 게이트. 보는 것은 다 열고 쓰는 것만 막는다.
             눌러야 막히는 것보다 처음부터 보이는 편이 덜 답답하다 */
          <div className="write__gate">
            <p>로그인하면 댓글을 남길 수 있어요</p>
            <Button size="sm" tone="kakao" onClick={() => setAsk('login')}>
              로그인
            </Button>
          </div>
        ) : (
          <>
            <Field>
              <TextArea
                placeholder={secret ? '방장만 볼 수 있어요' : '댓글을 남겨보세요'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
              />
            </Field>
            {/* 글자수를 한 줄 통째로 쓰지 않는다. 500자를 채울 일이 드물어
                평소에는 눈에 안 띄는 편이 낫다 */}
            <div className="write__opts">
              <Checkbox
                label="비밀 댓글"
                checked={secret}
                onChange={(e) => setSecret(e.target.checked)}
              />
              <span className={`write__count${draft.length > 500 ? ' write__count--over' : ''}`}>
                {draft.length}/500
              </span>
              <Button size="sm" disabled={!draft.trim() || draft.length > 500} onClick={submit}>
                올리기
              </Button>
            </div>
          </>
        )}
      </section>

      {ask === 'login' && (
        <Sheet
          title="로그인이 필요해요"
          desc="댓글을 남기려면 로그인해주세요. 닉네임만 정하면 바로 쓸 수 있어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>나중에</Button>
              <Button tone="kakao" onClick={() => setAsk(null)}>카카오로 시작하기</Button>
            </>
          }
        />
      )}

      {ask === 'done' && (
        <Sheet
          title="모집을 완료할까요?"
          desc="완료하면 목록에서 회색으로 바뀌고 댓글을 더 받지 않아요. 되돌릴 수 없어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>아니요</Button>
              <Button onClick={() => setAsk(null)}>완료할게요</Button>
            </>
          }
        />
      )}

      {ask === 'report' && (
        <ReportSheet target="post" onClose={() => setAsk(null)} />
      )}

      {ask === 'report-comment' && (
        <ReportSheet target="comment" onClose={() => setAsk(null)} />
      )}
    </PageShell>
  )
}
