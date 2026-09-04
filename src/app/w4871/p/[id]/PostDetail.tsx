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
import { canWrite, isClosed, isPlaceholder, LAST_SEEN_LABEL, type CompanionPost, type PostAuthor, type PostComment, type Sanction, type Viewer, type ViewerRole } from '@/types'
import { PageShell } from '@/components/ui/PageShell'
import { Button, Badge, Who, Blank, Sheet } from '@/components/ui/Basics'
import { Field, TextArea, Checkbox } from '@/components/ui/Field'
import { ReportSheet } from '@/components/ui/ReportSheet'
import { Comment, LockMark } from '@/components/ui/Post'
import { PersonSheet } from '@/components/ui/PersonSheet'
import { WriteGate } from '@/components/ui/SanctionNotice'
import { PlaceMap } from '@/components/ui/PlaceMap'
import { asServerWouldSend, threaded } from '@/lib/comment-perm'
import { wf } from '@/lib/wireframe'
import { whenText, dateOnly, shortTime } from '@/lib/when'


const ROLES: { key: ViewerRole; id: string | null; label: string; sanction?: Sanction }[] = [
  { key: 'guest', id: null, label: '비회원' },
  { key: 'member', id: 'u_b', label: '일반 회원' },
  { key: 'member', id: 'u_a', label: '댓글 작성자' },
  { key: 'host', id: 'u_host', label: '방장' },
  /* 나이 확인 대기. 읽는 것은 그대로 되고 쓰는 것만 막힌다는 것을
     여기서 확인한다. 정지·영구는 프로필 화면에서 본다. 그쪽은 화면을
     통째로 가려서 모집글 상세까지 올 일이 없다 */
  {
    key: 'member',
    id: 'u_b',
    label: '나이 확인 중',
    sanction: {
      kind: 'AGE_HOLD',
      reason: '가입할 때 적으신 출생연도가 맞는지 확인하려고 합니다.',
      issuedAt: '2026-09-01T18:20',
    },
  },
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
  | { k: 'cancel' }
  | { k: 'report' }
  | { k: 'report-comment' }
  | { k: 'delete'; id: string }
  /* 아바타를 눌러 연 사람 시트. 누구인지 같이 들고 다녀야 시트가
     열린 것과 보고 있는 사람이 어긋나지 않는다 */
  | { k: 'person'; user: PostAuthor; isMe: boolean }
  | { k: 'report-user'; name: string }

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
  const viewer: Viewer = {
    role: ROLES[pick].key,
    userId: ROLES[pick].id,
    sanction: ROLES[pick].sanction ?? null,
  }

  const [draft, setDraft] = useState('')
  const [secret, setSecret] = useState(false)
  /** 답글을 다는 대상. null 이면 새 댓글이다 */
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  /* 방금 내가 지운 댓글. API 가 붙으면 서버가 state 로 내려주므로 없어진다 */
  const [erased, setErased] = useState<string[]>([])
  /* 방금 내가 고친 댓글. 위와 같은 이유로 임시다 */
  const [edited, setEdited] = useState<Record<string, string>>({})
  /** 지금 고치고 있는 댓글. null 이면 아무것도 안 고치는 중 */
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  /* 'report' 는 모집글 신고, 'report-comment' 는 댓글 신고다. 하나로
     묶어 뒀더니 댓글의 신고를 눌러도 모집글 신고 시트가 떴다.
     ReportSheet 는 처음부터 셋(유저·글·댓글)을 받게 되어 있었고
     부르는 쪽이 target 을 안 넘긴 것이 원인이었다 */
  const [ask, setAsk] = useState<Ask>(null)
  /** 취소 사유. 시트가 닫히면 비운다 */
  const [cancelWhy, setCancelWhy] = useState('')

  const isHost = viewer.userId === hostId
  const isGuest = !viewer.userId
  /* 나이 확인 중이면 읽기는 그대로 두고 쓰기만 막는다 (처리방침 제10조).
     kind 를 여기서 비교하지 않는 이유는 게이트가 여러 화면에 흩어져
     있어서다. 판정은 types.ts 한 곳에서만 한다 */
  const noWrite = !canWrite(viewer.sanction)

  const gate = (why: LoginWhy) => setAsk({ k: 'login', why })

  /* 서버가 보냈을 모습으로 만든 뒤 계층 정렬한다. API 가 붙으면
     asServerWouldSend 만 빠지고 나머지는 그대로다 */
  const list = useMemo(() => {
    /* 고친 본문을 먼저 갈아끼운다. **반드시 권한 필터보다 앞이어야
       한다.** 뒤에 놓으면 서버가 지운 content 를 화면이 도로 끼워넣는
       꼴이 되어, 비밀 댓글이 볼 권한 없는 사람에게 열린다.
       secret 은 건드리지 않는다. 작성 후 비밀 여부는 못 바꾼다
       (명세 CM-03·CM-09) */
    const mine = comments.map((c) => (c.id in edited ? { ...c, content: edited[c.id] } : c))

    return threaded(asServerWouldSend(mine, viewer, hostId)).map((c) =>
      /* 지운 댓글도 자리는 남는다. 없애면 아래 대댓글이 고아가 된다 */
      erased.includes(c.id) ? { ...c, state: 'DELETED' as const } : c,
    )
  }, [comments, viewer.userId, hostId, erased, edited])

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
    /* 고치던 중에 지웠다면 입력칸도 접는다 */
    setEditing((e) => (e?.id === id ? null : e))
    setAsk(null)
  }

  /* 고치기는 본문만 바꾼다. 비밀 여부는 작성 후 못 바꾼다 (CM-03).
     그래서 여기에 체크박스가 없다. 비밀 댓글도 본문은 고칠 수 있다 */
  const saveEdit = () => {
    if (!editing) return
    const body = editing.draft.trim()
    if (!body || body.length > 500) return
    /* 아직 API 가 없다. 붙으면 PATCH 하고 목록을 다시 읽는다 */
    setEdited((prev) => ({ ...prev, [editing.id]: body }))
    setEditing(null)
  }

  const submit = () => {
    if (isGuest) return gate('comment')
    /* 아직 API 가 없다. 붙으면 여기서 POST 하고 목록을 다시 읽는다.
       parentId 는 replyTo?.id 로 나간다 */
    setDraft('')
    setSecret(false)
    setReplyTo(null)
  }

  return (
    <PageShell
      title="동행 구해요"
      right={
        isHost ? (
          /* 끝난 글에는 둘 다 남기지 않는다. 되돌릴 수 없다고
             말해놓고 다시 누를 수 있게 두는 셈이 된다.

             **완료와 취소를 갈라둔다.** 이미 댓글을 단 사람에게 둘은
             정반대 소식이다. 완료는 "사람을 다 구했다" 이고 취소는
             "이 모임이 없어졌다" 다. 상태는 둘 다 CLOSED 지만
             closedReason 이 갈린다 */
          post.status === 'OPEN' && (
            <span className="pshell__acts">
              <Button size="sm" tone="ghost" onClick={() => setAsk({ k: 'cancel' })}>
                취소
              </Button>
              <Button size="sm" tone="ghost" onClick={() => setAsk({ k: 'done' })}>
                모집 완료
              </Button>
            </span>
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
      {post.eventImageUrl && (
        <img className="post__cover" src={post.eventImageUrl} alt="" />
      )}

      <article className="post">
        <div className="post__tags">
          <Badge state={post.status} />
          {post.eventId && post.eventTitle && (
            <a className="post__event" href={`/e/${post.eventId}`}>
              {post.eventTitle}
            </a>
          )}
        </div>

        <div className="post__who">
          <Who
            onPress={() =>
              setAsk({ k: 'person', user: post.author, isMe: post.author.id === viewer.userId })
            }
            name={post.author.nickname}
            src={post.author.imageUrl ?? undefined}
            sub={[
              post.author.lastSeen && LAST_SEEN_LABEL[post.author.lastSeen],
              dateOnly(post.createdAt),
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        </div>

        <h1 className="post__title">{post.title}</h1>

        <div className="post__map">
          <PlaceMap
            lat={post.meetPoint.lat}
            lng={post.meetPoint.lng}
            label={post.meetPoint.place}
          />
        </div>

        {/* 두 줄로 끝낸다. 날짜와 인원이 위, 장소와 마감이 아래다.
            넷을 다 굵게 쓰면 제목과 무게가 비슷해져 둘 다 안 읽힌다 */}
        <p className="post__when">
          {whenText(post.meetAt)}
          {post.capacity ? ` · ${post.capacity}명 모집` : ''}
        </p>
        <p className="post__sub">
          {post.meetPoint.place} · {dateOnly(post.closesAt)} 마감
        </p>

        <div className="post__body">{post.content}</div>


        <div className="post__count">
          <span>댓글 <b>{post.commentCount}</b></span>
          {post.status === 'CLOSED' && post.closedReason === 'MANUAL' && <span>모집이 끝났어요</span>}
          {post.status === 'CLOSED' && post.closedReason === 'MEET_TIME_PASSED' && <span>행사가 끝났어요</span>}
          {post.status === 'CLOSED' && post.closedReason === 'CANCELED' && <span>취소된 모집이에요</span>}

          {/* 글 자체를 신고하는 자리. 헤더에도 있지만 거기는 방장일 때
             「모집 완료」 로 바뀌어 사라지고, 무엇을 신고하는지도
             갈리지 않는다. 본문 바로 아래라야 「이 글」 임이 분명하다 */}
          {!isHost && (
            <button
              type="button"
              className="post__report"
              onClick={() => (isGuest ? gate('report') : setAsk({ k: 'report' }))}
            >
              이 글 신고
            </button>
          )}
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
              name={isPlaceholder(c.status) ? '' : c.author.nickname}
              src={c.author.imageUrl ?? undefined}
              time={shortTime(c.createdAt)}
              text={c.content ?? undefined}
              reply={!!c.parentId}
              secret={c.secret}
              state={c.status}
              host={c.author.id === hostId}
              edited={c.id in edited}
              onAuthor={
                isPlaceholder(c.status)
                  ? undefined
                  : () =>
                      setAsk({
                        k: 'person',
                        user: c.author,
                        isMe: c.author.id === viewer.userId,
                      })
              }
              edit={
                editing?.id === c.id ? (
                  <div className="cmt__edit">
                    <Field>
                      <TextArea
                        autoFocus
                        value={editing.draft}
                        onChange={(e) => setEditing({ id: c.id, draft: e.target.value })}
                        rows={2}
                        placeholder="댓글을 고쳐보세요"
                      />
                    </Field>
                    <div className="cmt__editopts">
                      {/* 비밀 여부는 여기서 못 바꾼다. 공개로 바꾸면
                          비밀인 줄 알고 적은 연락처가 그대로 열린다 */}
                      {c.secret && (
                        <span className="cmt__lock">
                          <LockMark />비밀 유지
                        </span>
                      )}
                      <span
                        className={`write__count${editing.draft.length > 500 ? ' write__count--over' : ''}`}
                      >
                        {editing.draft.length}/500
                      </span>
                      <Button size="sm" tone="ghost" onClick={() => setEditing(null)}>
                        취소
                      </Button>
                      <Button
                        size="sm"
                        disabled={!editing.draft.trim() || editing.draft.length > 500}
                        onClick={saveEdit}
                      >
                        저장
                      </Button>
                    </div>
                  </div>
                ) : undefined
              }
              acts={
                /* **서버가 준 목록대로만 그린다** (CM-18). 여기서
                   `c.author.id === viewer.userId` 같은 판정을 하지 않는다.
                   같은 규칙이 두 곳에 살면 한쪽만 고쳤을 때 조용히
                   어긋나고, 본인 댓글에 신고 버튼이 뜨는 종류의 버그가
                   거기서 나온다.

                   비회원은 목록이 비어서 아무것도 안 그려진다. 로그인
                   게이트는 아래 입력칸 자리가 따로 세운다 */
                c.availableActions.length === 0 ? undefined : (
                  <>
                    {c.availableActions.includes('REPLY') && (
                      <button onClick={() => openReply(c.id, c.author.nickname)}>답글</button>
                    )}
                    {c.availableActions.includes('EDIT') && (
                      <button onClick={() => setEditing({ id: c.id, draft: c.content ?? '' })}>
                        수정
                      </button>
                    )}
                    {c.availableActions.includes('DELETE') && (
                      /* 지우는 것은 되돌릴 수 없다. 모집 완료와 같이 한 번 묻는다 */
                      <button onClick={() => setAsk({ k: 'delete', id: c.id })}>삭제</button>
                    )}
                    {c.availableActions.includes('REPORT') && (
                      <button onClick={() => setAsk({ k: 'report-comment' })}>신고</button>
                    )}
                  </>
                )
              }            />
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
        {isClosed(post.status) ? (
          <p className="write__gate">
            {post.closedReason === 'CANCELED'
              ? '취소된 모집이라 댓글을 받지 않아요'
              : post.closedReason === 'MANUAL'
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
        ) : noWrite && viewer.sanction ? (
          /* 나이 확인 게이트. 비회원 게이트와 같은 자리다. 로그인은
             되어 있는데 쓰기만 막힌 상태라, 로그인하라고 하면 이미
             한 일을 또 하라는 말이 된다 */
          <WriteGate sanction={viewer.sanction} what="댓글" />
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

      {/* 취소는 사유가 필수다 (types.ts cancelReason).
          이미 댓글을 단 사람이 왜 없어졌는지 알아야 하기 때문이다.
          완료와 달리 상대가 헛물을 켠 셈이라 한 줄이라도 남겨야 한다 */}
      {ask?.k === 'cancel' && (
        <Sheet
          title="모집을 취소할까요?"
          desc="댓글을 남긴 분들에게 사유가 그대로 보입니다. 되돌릴 수 없어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>아니요</Button>
              <Button
                tone="danger"
                /* 사유 없이는 못 누른다. 「취소되었습니다」 만 뜨면
                   기다리던 사람은 아무것도 못 알아본다 */
                disabled={!cancelWhy.trim()}
                onClick={() => {
                  /* API 가 붙으면 여기서 POST 한다.
                     closedReason = CANCELED, cancelReason = 사유 */
                  setAsk(null)
                  setCancelWhy('')
                }}
              >
                취소할게요
              </Button>
            </>
          }
        >
          <Field
            label="취소 사유"
            hint="댓글을 남긴 분들에게 보여요"
            count={[cancelWhy.length, 100]}
          >
            <TextArea
              autoFocus
              placeholder="갑자기 일이 생겨서 못 가게 됐어요"
              value={cancelWhy}
              onChange={(e) => setCancelWhy(e.target.value)}
              rows={2}
            />
          </Field>
        </Sheet>
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

      {ask?.k === 'person' && (
        <PersonSheet
          user={ask.user}
          isMe={ask.isMe}
          onClose={() => setAsk(null)}
          /* 시트 위에 시트를 쌓지 않는다. 사람 시트를 닫고 신고 시트를
             연다. 겹치면 뒤엣것을 닫았을 때 앞엣것이 남는다 */
          onReport={() =>
            isGuest ? gate('report') : setAsk({ k: 'report-user', name: ask.user.nickname })
          }
        />
      )}

      {ask?.k === 'report-user' && (
        <ReportSheet target="user" name={ask.name} onClose={() => setAsk(null)} />
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
