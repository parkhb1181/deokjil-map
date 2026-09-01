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
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isClosed, type CompanionPost, type PostComment, type Viewer, type ViewerRole } from '@/types'
import { PageShell } from '@/components/ui/PageShell'
import { Button, Badge, Who, Blank, Sheet } from '@/components/ui/Basics'
import { Field, TextArea, Checkbox } from '@/components/ui/Field'
import { ReportSheet } from '@/components/ui/ReportSheet'
import { Comment } from '@/components/ui/Post'
import { PlaceMap } from '@/components/ui/PlaceMap'
import { asServerWouldSend, threaded } from '@/lib/comment-perm'
import { wf } from '@/lib/wireframe'

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

/**
 * 한 번에 하나만 뜨는 물음.
 *
 * 문자열 하나로 두다가 댓글 삭제가 들어오면서 "어느 댓글인지" 를
 * 같이 들고 다녀야 해서 객체가 됐다. 대상 id 를 딴 상태로 빼두면
 * 시트가 열려 있는 것과 지울 대상이 어긋날 수 있다.
 */
type LoginWhy = 'comment' | 'reply' | 'report'

type Ask =
  | null
  | { k: 'login'; why: LoginWhy }
  | { k: 'done' }
  | { k: 'report' }
  | { k: 'report-comment' }
  | { k: 'delete'; id: string }

/* 무엇을 하려다 막혔는지에 따라 문구가 달라진다. 신고하려다 막힌
   사람에게 댓글 얘기를 하면 자기가 누른 것이 먹힌 것인지 알 수 없다 */
const LOGIN_DESC: Record<LoginWhy, string> = {
  comment: '댓글을 남기려면 로그인해주세요. 닉네임만 정하면 바로 쓸 수 있어요.',
  reply: '답글을 남기려면 로그인해주세요. 닉네임만 정하면 바로 쓸 수 있어요.',
  report: '신고하려면 로그인해주세요. 신고 사실은 상대에게 알리지 않아요.',
}

export default function PostDetail({ post, comments, hostId }: {
  post: CompanionPost
  comments: PostComment[]
  hostId: string
}) {
  const router = useRouter()
  /* 로그인이 없어 화면을 확인할 방법이 없다. 인증이 붙으면 이 상태와
     아래 whoami 막대를 지우고 서버 세션에서 채운다 */
  const [pick, setPick] = useState(3)
  const viewer: Viewer = { role: ROLES[pick].key, user_id: ROLES[pick].id }

  const [draft, setDraft] = useState('')
  const [secret, setSecret] = useState(false)
  /** 답글을 다는 대상. null 이면 새 댓글이다 */
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  /* 방금 내가 지운 댓글. API 가 붙으면 서버가 deleted 로 내려주므로 없어진다 */
  const [erased, setErased] = useState<string[]>([])
  const boxRef = useRef<HTMLTextAreaElement>(null)
  /* 'report' 는 모집글 신고, 'report-comment' 는 댓글 신고다. 하나로
     묶어 뒀더니 댓글의 신고를 눌러도 모집글 신고 시트가 떴다.
     ReportSheet 는 처음부터 셋(유저·글·댓글)을 받게 되어 있었고
     부르는 쪽이 target 을 안 넘긴 것이 원인이었다 */
  const [ask, setAsk] = useState<Ask>(null)

  const isHost = viewer.user_id === hostId
  const isGuest = !viewer.user_id

  const gate = (why: LoginWhy) => setAsk({ k: 'login', why })

  /* 서버가 보냈을 모습으로 만든 뒤 계층 정렬한다. API 가 붙으면
     asServerWouldSend 만 빠지고 나머지는 그대로다 */
  const list = useMemo(
    () =>
      threaded(asServerWouldSend(comments, viewer, hostId)).map((c) =>
        /* 지운 댓글도 자리는 남는다. 없애면 아래 대댓글이 고아가 된다 */
        erased.includes(c.id) ? { ...c, deleted: true } : c,
      ),
    [comments, viewer.user_id, hostId, erased],
  )

  /* 답글은 입력칸을 따로 열지 않고 맨 아래 칸을 빌려 쓴다. 댓글마다
     칸을 열면 지금 어디에 쓰고 있는지 알기 어렵고, 입력칸이 화면을
     따라다니지 않는다는 규칙과도 어긋난다 */
  const openReply = (id: string, name: string) => {
    if (isGuest) return gate('reply')
    setReplyTo({ id, name })
    boxRef.current?.focus()
  }

  const erase = (id: string) => {
    setErased((prev) => [...prev, id])
    /* 지운 댓글에 답글을 쓰고 있었다면 그 자리도 같이 접는다 */
    setReplyTo((r) => (r?.id === id ? null : r))
    setAsk(null)
  }

  const submit = () => {
    if (isGuest) return gate('comment')
    /* 아직 API 가 없다. 붙으면 여기서 POST 하고 목록을 다시 읽는다.
       parent_id 는 replyTo?.id 로 나간다 */
    setDraft('')
    setSecret(false)
    setReplyTo(null)
  }

  return (
    <PageShell
      title="동행 구해요"
      right={
        isHost ? (
          /* 끝난 글에는 완료 버튼을 남기지 않는다. 되돌릴 수 없다고
             말해놓고 다시 누를 수 있게 두는 셈이 된다 */
          post.state === 'open' && (
            <Button size="sm" tone="ghost" onClick={() => setAsk({ k: 'done' })}>
              모집 완료
            </Button>
          )
        ) : (
          /* 신고도 쓰는 행동이라 로그인 뒤에 한다. 댓글 신고만 막고
             여기를 열어두면 같은 행동이 자리에 따라 다르게 동작한다 */
          <Button
            size="sm"
            tone="ghost"
            onClick={() => (isGuest ? gate('report') : setAsk({ k: 'report' }))}
          >
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
          {post.state === 'ended' && <span>행사가 끝났어요</span>}
        </div>
      </article>

      <section className="thread">
        {/* 판정은 lib/comment-perm.ts 한 곳에 있다. 문구가 그 규칙과
            어긋나면 연락처를 누가 보는지 모르는 채로 적게 된다.
            볼 수 있는 사람은 셋이다. 쓴 사람 · 방장 · 부모 댓글 작성자 */}
        <p className="thread__head">
          비밀 댓글은 방장과 쓴 사람만 볼 수 있어요. 답글이면 그 댓글을 쓴 사람도 봅니다
        </p>

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
                    {/* 답글에는 답글을 달지 않는다. 깊이가 1단계라
                        그 아래가 없다 */}
                    {!c.parent_id && (
                      <button onClick={() => openReply(c.id, c.author.nickname)}>답글</button>
                    )}
                    {c.author.id === viewer.user_id ? (
                      /* 지우는 것은 되돌릴 수 없다. 모집 완료와 같이
                         한 번 묻는다 */
                      <button onClick={() => setAsk({ k: 'delete', id: c.id })}>삭제</button>
                    ) : (
                      <button onClick={() => (isGuest ? gate('report') : setAsk({ k: 'report-comment' }))}>
                        신고
                      </button>
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
        {/* 끝난 글에는 댓글을 받지 않는다. 왜 끝났는지에 따라 문구가
            다르다. "모집이 끝났다" 와 "행사가 끝났다" 는 사용자가
            할 수 있는 일이 다르다. 앞은 다음 글을 기다리면 되고
            뒤는 그 행사 자체가 지나갔다 */}
        {isClosed(post.state) ? (
          <p className="write__gate">
            {post.state === 'done'
              ? '모집이 끝나 댓글을 받지 않아요'
              : '행사가 끝나 댓글을 받지 않아요'}
          </p>
        ) : isGuest ? (
          /* 비회원 게이트. 보는 것은 다 열고 쓰는 것만 막는다.
             눌러야 막히는 것보다 처음부터 보이는 편이 덜 답답하다 */
          <div className="write__gate">
            <p>로그인하면 댓글을 남길 수 있어요</p>
            <Button size="sm" tone="kakao" onClick={() => gate('comment')}>
              로그인
            </Button>
          </div>
        ) : (
          <>
            {replyTo && (
              /* 어느 댓글에 다는 중인지 입력칸 위에 남긴다. 없으면
                 답글을 눌러놓고 새 댓글을 쓴 것으로 착각한다 */
              <p className="write__reply">
                <b>{replyTo.name}</b> 님에게 답글
                <button type="button" onClick={() => setReplyTo(null)}>
                  취소
                </button>
              </p>
            )}
            <Field>
              <TextArea
                ref={boxRef}
                /* 비밀 댓글을 누가 보는지는 자리에 따라 다르다. 루트
                   댓글은 방장뿐이고, 답글이면 부모 댓글을 쓴 사람도 본다 */
                placeholder={
                  secret
                    ? replyTo
                      ? `방장과 ${replyTo.name} 님만 볼 수 있어요`
                      : '방장만 볼 수 있어요'
                    : replyTo
                      ? '답글을 남겨보세요'
                      : '댓글을 남겨보세요'
                }
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

      {ask?.k === 'login' && (
        <Sheet
          title="로그인이 필요해요"
          desc={LOGIN_DESC[ask.why]}
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>나중에</Button>
              {/* 읽던 글을 next 로 들려 보낸다. 로그인과 가입을 마치면
                  이 자리로 돌아온다. 홈으로 떨어뜨리면 방금 읽던 글을
                  다시 찾아가야 하고, 대개는 그냥 나간다 */}
              <Button
                tone="kakao"
                onClick={() => router.push(wf(`/login?next=${encodeURIComponent(wf(`/p/${post.id}`))}`))}
              >
                카카오로 시작하기
              </Button>
            </>
          }
        />
      )}

      {ask?.k === 'done' && (
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

      {ask?.k === 'delete' && (
        <Sheet
          title="댓글을 지울까요?"
          desc="내용만 사라지고 자리는 남아요. 되돌릴 수 없어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>취소</Button>
              <Button tone="danger" onClick={() => erase(ask.id)}>지우기</Button>
            </>
          }
        />
      )}

      {ask?.k === 'report' && (
        <ReportSheet target="post" onClose={() => setAsk(null)} />
      )}

      {ask?.k === 'report-comment' && (
        <ReportSheet target="comment" onClose={() => setAsk(null)} />
      )}
    </PageShell>
  )
}
