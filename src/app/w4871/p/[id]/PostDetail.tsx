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
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useViewer } from '@/lib/auth/useViewer'
import { USE_API } from '@/lib/api/config'
import { deleteComment, editComment, fetchComments, writeComment } from '@/lib/api/comments'
import { getAccessToken } from '@/lib/auth/session'
import { takeAfterAuth } from '@/lib/auth/after-auth'
import { closePost } from '@/lib/api/posts'
import { fetchRooms, inviteToRoom } from '@/lib/api/chat'
import { ApiFailure } from '@/lib/api/http'
import { slotFor } from '@/lib/api/errors'
import { authed } from '@/lib/auth/authed'
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
  | { k: 'report' }
  /* 어느 댓글을 신고하는지 같이 든다. 시트가 열린 것과 대상이 어긋나지 않게 */
  | { k: 'report-comment'; id: string }
  | { k: 'delete'; id: string }
  /* 채팅을 열기 전에 한 번 묻는다. 방이 생기면 상대에게 알림이 가고,
     잘못 누른 것을 되돌릴 자리가 없다 */
  | { k: 'chat'; id: string; userId: string; nickname: string }
  /* 아바타를 눌러 연 사람 시트. 누구인지 같이 들고 다녀야 시트가
     열린 것과 보고 있는 사람이 어긋나지 않는다 */
  | { k: 'person'; user: PostAuthor; isMe: boolean }
  | { k: 'report-user'; userId: string; name: string }

/* 무엇을 하려다 막혔는지에 따라 문구가 달라진다. 신고하려다 막힌
   사람에게 댓글 얘기를 하면 자기가 누른 것이 먹힌 것인지 알 수 없다 */
const LOGIN_DESC: Record<LoginWhy, string> = {
  comment: '댓글을 남기려면 로그인해주세요. 닉네임만 정하면 바로 쓸 수 있어요.',
  reply: '답글을 남기려면 로그인해주세요. 닉네임만 정하면 바로 쓸 수 있어요.',
  report: '신고하려면 로그인해주세요. 신고 사실은 상대에게 알리지 않아요.',
}

export default function PostDetail({ post, comments, hostId, noReport = false }: {
  post: CompanionPost
  comments: PostComment[]
  hostId: string
  /**
   * 신고 버튼을 아예 안 그린다. 서버에 없는 고정 완료글(lib/fixture-posts)
   * 에서만 켠다 — 없는 글을 신고하면 404 가 오고, 그걸 본 사람은
   * 서비스가 고장났다고 읽는다. 진짜 글에서는 절대 켜지 않는다.
   */
  noReport?: boolean
}) {
  const router = useRouter()
  /*
   * 보는 사람.
   *
   * API 주소가 있으면 서버 세션이 정하고, 없으면 아래 whoami 막대가
   * 정한다. 백엔드가 뜨면 막대와 이 pick 상태를 같이 지운다.
   */
  const [pick, setPick] = useState(3)
  const devViewer: Viewer = {
    role: ROLES[pick].key,
    userId: ROLES[pick].id,
    sanction: ROLES[pick].sanction ?? null,
  }
  const { viewer } = useViewer(devViewer, hostId)

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
  /* 서버가 막았을 때 띄울 문장. 댓글 칸 위에 둔다 */
  const [failed, setFailed] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  /* 행사 포스터가 안 뜬 경우. 빈 회색 블록을 남기지 않는다 */
  const [coverFailed, setCoverFailed] = useState(false)

  const isHost = viewer.userId === hostId
  const isGuest = !viewer.userId
  /* 나이 확인 중이면 읽기는 그대로 두고 쓰기만 막는다 (처리방침 제10조).
     kind 를 여기서 비교하지 않는 이유는 게이트가 여러 화면에 흩어져
     있어서다. 판정은 types.ts 한 곳에서만 한다 */
  const noWrite = !canWrite(viewer.sanction)

  const gate = (why: LoginWhy) => setAsk({ k: 'login', why })

  /**
   * 내 토큰으로 다시 받은 댓글. `null` 이면 아직 안 받았다.
   *
   * ─────────────────────────────────────────────────────────
   * **왜 두 번 받나.**
   *
   * 서버 컴포넌트에는 세션이 없다. 토큰이 `localStorage` 에 있어서
   * 브라우저만 안다. 그래서 첫 응답은 **늘 비회원 기준**이고, 비밀 댓글
   * 본문과 `availableActions` 가 비어서 온다.
   *
   * 그대로 두면 **방장이 자기 글의 비밀 댓글을 못 읽는다.** 채팅이 없어
   * 비밀 댓글이 연락처가 오가는 유일한 통로인데(CM-05), 정작 사람을
   * 골라야 하는 방장에게 안 보이면 제품이 성립하지 않는다. 2026-09-08
   * 연동 시험에서 실제로 그랬다.
   *
   * 그래서 화면이 뜬 뒤 내 토큰으로 한 번 더 받는다. 첫 화면은 서버가
   * 그린 것이 그대로 보이고(비회원에게는 그것이 정답이다), 로그인한
   * 사람에게만 채워진 목록으로 바뀐다.
   */
  const [live, setLive] = useState<PostComment[] | null>(null)

  useEffect(() => {
    if (!USE_API) return
    /* 로그인 안 했으면 서버가 준 것이 이미 정답이다. 한 번 더 부를 이유가 없다 */
    if (!getAccessToken()) return

    let alive = true
    authed((t) => fetchComments(post.id, { token: t }))
      .then((r) => alive && setLive(r.items))
      /* 실패하면 서버가 준 목록을 그대로 둔다. 읽기는 계속 되어야 한다 */
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [post.id, viewer.userId])

  const source = live ?? comments

  const list = useMemo(() => {
    /* 고친 본문을 먼저 갈아끼운다. **반드시 권한 필터보다 앞이어야
       한다.** 뒤에 놓으면 서버가 지운 content 를 화면이 도로 끼워넣는
       꼴이 되어, 비밀 댓글이 볼 권한 없는 사람에게 열린다.
       secret 은 건드리지 않는다. 작성 후 비밀 여부는 못 바꾼다
       (명세 CM-03·CM-09) */
    const mine = source.map((c) => (c.id in edited ? { ...c, content: edited[c.id] } : c))

    /*
     * **API 경로에서는 화면이 권한을 다시 판정하지 않는다.**
     *
     * `asServerWouldSend` 는 서버가 없을 때 목데이터를 걸러 주려고 만든
     * 것이다 (`comment-perm.ts` 머리말이 "API 가 붙으면 이 함수는
     * 지운다" 고 적어 두었다). 서버가 이미 본문을 빼고 보내는데 여기서
     * 또 판정하면 규칙이 두 곳에 살고, 한쪽만 고치면 조용히 어긋난다.
     * 무엇보다 **화면은 서버가 뺀 것을 되살릴 수 없다** — 걸러내기만
     * 할 뿐이라 남는 것은 규칙이 겹치는 위험뿐이다.
     */
    const shown = USE_API ? mine : asServerWouldSend(mine, viewer, hostId)

    return threaded(shown).map((c) =>
      /* 지운 댓글도 자리는 남는다. 없애면 아래 대댓글이 고아가 된다 */
      erased.includes(c.id) ? { ...c, state: 'DELETED' as const } : c,
    )
  }, [source, viewer.userId, hostId, erased, edited])

  /* 답글은 입력칸을 따로 열지 않고 맨 아래 칸을 빌려 쓴다. 댓글마다
     칸을 열면 지금 어디에 쓰고 있는지 알기 어렵고, 입력칸이 화면을
     따라다니지 않는다는 규칙과도 어긋난다 */
  const openReply = (id: string, name: string) => {
    if (isGuest) return gate('reply')
    setReplyTo({ id, name })
    boxRef.current?.focus()
  }

  /**
   * 쓰고 나면 목록을 다시 읽는다.
   *
   * **화면에서 지어내지 않는다.** 작성 응답에는 `author` 도
   * `availableActions` 도 없다 — 둘 다 보는 사람에 따라 갈리는 판정이라
   * 서버가 조회 때만 조립한다 (`lib/api/comments.ts`). 화면이 만들어
   * 끼우면 그 순간부터 권한 규칙이 두 곳에 살고, 새로고침하면 값이
   * 달라진다.
   *
   * 삭제도 마찬가지다. 아래 대댓글이 있으면 자리표시자로 남고 없으면
   * 목록에서 빠지는데(CM-11), 어느 쪽인지는 서버가 안다.
   *
   * **내 토큰으로 받는 쪽도 같이 갱신한다.** `router.refresh()` 만 하면
   * 서버 컴포넌트가 다시 도는데 그쪽은 세션이 없어 비회원 목록을 준다.
   * 위 `live` 는 그대로라 방금 쓴 댓글이 안 보이거나, 더 나쁘게는 화면이
   * 비회원 목록으로 되돌아간다.
   */
  const reload = () => {
    router.refresh()
    if (!USE_API || !getAccessToken()) return
    authed((t) => fetchComments(post.id, { token: t }))
      .then((r) => setLive(r.items))
      .catch(() => {})
  }

  const fail = (e: unknown) => setFailed(slotFor(e).text)

  /**
   * 모집 완료 (PO-07).
   *
   * **`PATCH` 로 status 를 넘기지 않는다.** 전이 규칙이 한 경로에만
   * 있어야 마감 배치(PO-14)와 같은 코드를 지난다 (도메인 3.1).
   */
  const done = () => {
    setAsk(null)
    if (!USE_API) return
    setFailed(null)
    authed((t) => closePost(post.id, t)).then(reload).catch(fail)
  }

  const erase = (id: string) => {
    /* 지운 댓글에 답글을 쓰고 있었다면 그 자리도 같이 접는다 */
    setReplyTo((r) => (r?.id === id ? null : r))
    /* 고치던 중에 지웠다면 입력칸도 접는다 */
    setEditing((e) => (e?.id === id ? null : e))
    setAsk(null)

    if (!USE_API) return setErased((prev) => [...prev, id])
    setFailed(null)
    authed((t) => deleteComment(id, t)).then(reload).catch(fail)
  }

  /* 고치기는 본문만 바꾼다. 비밀 여부는 작성 후 못 바꾼다 (CM-03).
     그래서 여기에 체크박스가 없다. 비밀 댓글도 본문은 고칠 수 있다 */
  const saveEdit = () => {
    if (!editing) return
    const body = editing.draft.trim()
    if (!body || body.length > 500) return

    if (!USE_API) {
      setEdited((prev) => ({ ...prev, [editing.id]: body }))
      setEditing(null)
      return
    }
    setFailed(null)
    authed((t) => editComment(editing.id, body, t))
      .then(() => {
        setEditing(null)
        reload()
      })
      .catch(fail)
  }

  const submit = () => {
    if (isGuest) return gate('comment')
    const body = draft.trim()
    if (!body) return

    const clear = () => {
      setDraft('')
      setSecret(false)
      setReplyTo(null)
    }

    if (!USE_API) return clear()

    setFailed(null)
    setSending(true)
    authed((t) =>
      writeComment(post.id, { content: body, parentId: replyTo?.id ?? null, secret }, t),
    )
      .then(() => {
        clear()
        reload()
      })
      .catch(fail)
      .finally(() => setSending(false))
  }

  return (
    <PageShell
      title="동행 모집"
      /*
       * 평소에는 기록대로 뒤로 간다. **로그인하고 막 돌아온 한 번만**
       * 목록으로 보낸다 — 그때 기록의 바로 뒤가 카카오 화면이라
       * 뒤로가기가 로그인 화면을 다시 띄운다 (after-auth.ts).
       *
       * 목록으로 보내는 것이 맞는 이유는, 로그인은 대부분 이 글에
       * 댓글을 쓰려다 시작하고 그 사람이 돌아가려는 곳이 동행 목록이라서다.
       */
      onBack={() => (takeAfterAuth() ? router.replace(wf('/p')) : router.back())}
      right={
        isHost ? (
          /* 끝난 글에는 남기지 않는다. 되돌릴 수 없다고 말해놓고
             다시 누를 수 있게 두는 셈이 된다.

             방장 취소는 1차 MVP 에서 뺐다 (2026-09-04). 여기 「취소」 가
             같이 있었다 */
          post.status === 'OPEN' && (
            <>
              {/* 수정도 OPEN 에서만이다 (PO-06). 계약이 CLOSED 수정을
                  409 로 막는데, 화면에 남겨두면 눌러보고 나서 튕긴다.

                  감싸는 요소를 두지 않는다. shell__right 가 이미 flex 라
                  버튼 둘이 그대로 나란히 선다 */}
              <Button size="sm" tone="ghost" onClick={() => router.push(wf(`/p/${post.id}/edit`))}>
                수정
              </Button>
              <Button size="sm" tone="ghost" onClick={() => setAsk({ k: 'done' })}>
                모집 완료
              </Button>
            </>
          )
        ) : noReport ? null : (
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
      {/* 개발용. 서버 세션이 정하기 시작하면 이 막대는 아무것도 못
          바꾸므로 그리지 않는다. 백엔드가 뜨면 통째로 지운다 */}
      {!USE_API && (
      <div className="whoami">
        <b>보는 사람</b>
        {ROLES.map((r, i) => (
          <button key={r.label} aria-pressed={i === pick} onClick={() => setPick(i)}>
            {r.label}
          </button>
        ))}
      </div>
      )}

      {/* 당근 동네생활 글의 순서를 그대로 쓴다.
          칩 → 글쓴이 → 제목 → 본문 → 카운터 → 댓글 */}
      {post.eventImageUrl && !coverFailed && (
        /*
         * 포스터는 원본 서버 주소를 그대로 들고 있다. 우리가 복제하지
         * 않기 때문에 (CLAUDE.md 「원본을 재게시하지 않는다」) 상대 서버
         * 사정으로 언제든 안 뜰 수 있다.
         *
         * **안 뜨면 자리를 비운다.** `aspect-ratio: 4/5` 에 `max-height:
         * 60vh` 라 실패하면 화면 높이의 60% 가 빈 회색으로 남고, 사용자는
         * 로딩이 멈춘 줄 알고 기다린다. 목록 카드·행사 상세·행사 고르기가
         * 이미 같은 방식으로 처리한다.
         */
        <img
          className="post__cover"
          src={post.eventImageUrl}
          alt=""
          /*
           * **`onError` 만으로는 못 잡는다.** 이 `img` 는 서버가 그려
           * 보낸 HTML 에 이미 들어 있어서, 하이드레이션으로 핸들러가
           * 붙기 전에 로딩이 끝나 있는 경우가 많다. 그때는 error 가
           * 이미 지나가 다시 오지 않는다.
           *
           * 그래서 ref 로 붙는 순간 한 번 검사한다. `complete` 인데
           * `naturalWidth` 가 0 이면 실패한 것이다.
           */
          ref={(el) => {
            if (el?.complete && el.naturalWidth === 0) setCoverFailed(true)
          }}
          onError={() => setCoverFailed(true)}
        />
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
            src={post.author.profileImageUrl ?? undefined}
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

          {/* 글 자체를 신고하는 자리. 헤더에도 있지만 거기는 방장일 때
             「모집 완료」 로 바뀌어 사라지고, 무엇을 신고하는지도
             갈리지 않는다. 본문 바로 아래라야 「이 글」 임이 분명하다 */}
          {!isHost && !noReport && (
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
              src={c.author.profileImageUrl ?? undefined}
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
                    {/*
                      두 묶음으로 나눈다.

                      **앞은 대화를 잇는 것, 뒤는 치우는 것이다.** 넷이 한 줄로
                      붙어 있으면 「삭제」 와 「초대」 가 나란히 서서, 부르려다
                      지우는 실수가 난다. 성격이 다른 것을 같은 간격으로 두면
                      눈이 구분하지 못한다.

                      내 댓글의 「수정」 은 뒤 묶음에 둔다. 내 글을 손보는
                      일이라 남에게 거는 답글·초대와 성격이 다르다.
                    */}
                    <span className="cmt__actg">
                      {c.availableActions.includes('REPLY') && (
                        <button onClick={() => openReply(c.id, c.author.nickname)}>답글</button>
                      )}
                      {/*
                        방으로 들어오는 입구 (CH-01).

                      **댓글 자리에, 방장에게만 둔다.** 신청·수락을 만들지
                      않기로 해서 댓글이 그 자리를 하고 있고, 방장이 댓글 단
                      사람 중에서 골라 부른다. 글 위쪽에 하나만 두면 누구를
                      부르는 것인지가 없다.

                      방은 글 하나에 하나다. 여럿을 불러도 같은 방으로
                      들어오고 모집 정원이 곧 방 인원이 된다. 1:1 방을 따로
                      두지 않기로 해서, 댓글 단 사람끼리 서로 거는 자리는
                      없다 — 부르는 것은 방장만 한다.

                      서버가 판정을 내려주기 전까지는 방장인지만 본다. 붙을
                      때 availableActions 의 CHAT 으로 옮긴다.
                    */}
                      {/* 자기 자신은 부를 수 없다. EDIT 이 온다는 것이 곧 내
                          댓글이라는 뜻이다. 서버가 availableActions 에 CHAT 을
                          내려주면 그쪽으로 판정이 넘어간다 — 지금은 방장인지만
                          보고, 못 부르는 사람(이미 멤버 · 나간 사람)은 서버의
                          409 를 그대로 보여준다 */}
                      {isHost && !c.availableActions.includes('EDIT') && !isPlaceholder(c.status) && (
                        <button
                          onClick={() =>
                            setAsk({ k: 'chat', id: c.id, userId: c.author.id, nickname: c.author.nickname })
                          }
                        >
                          초대
                        </button>
                      )}
                    </span>
                  </>
                )
              }
              quietActs={
                <>
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
                  <button onClick={() => setAsk({ k: 'report-comment', id: c.id })}>
                  신고
                  </button>
                  )}
                </>
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
        {isClosed(post.status) ? (
          <p className="write__gate">
            {post.closedReason === 'MANUAL'
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
            {/* 서버가 막았을 때. 입력칸 바로 위라 무엇이 실패했는지가
                누른 자리와 붙어 보인다 */}
            {failed && (
              <p className="form__failed" role="alert">
                {failed}
              </p>
            )}
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
              <Button
                size="sm"
                disabled={sending || !draft.trim() || draft.length > 500}
                onClick={submit}
              >
                {sending ? '올리는 중' : '올리기'}
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
              <Button onClick={done}>완료할게요</Button>
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

      {/*
        초대 확인.

        누르면 방에 사람이 들어오고 상대에게 알림이 간다. 내보내는 자리를
        따로 만들지 않아서 한 번 묻는다 — 삭제와 같은 이유다.

        목데이터 경로는 실제로 부르지 않고 목데이터 방(r0)으로 보낸다.
      */}
      {ask?.k === 'chat' && (
        <Sheet
          title={`${ask.nickname} 님을 채팅에 부를까요?`}
          desc="이 글의 채팅방으로 초대합니다. 방은 글 하나에 하나라, 이미 부른 분들과 같은 방에서 이야기하게 됩니다."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>
                취소
              </Button>
              <Button
                onClick={() => {
                  const target = ask
                  setAsk(null)
                  if (!USE_API) {
                    router.push(wf('/chat/r0'))
                    return
                  }
                  setFailed(null)
                  /* 방은 글마다 하나라 두 번 불러도 같은 방이다 (CH-01).
                     이미 들어와 있는 사람이면 서버가 409 를 주는데, 그건
                     실패가 아니라 「그 방으로 가면 된다」 다 — 목록에서
                     이 글의 방을 찾아 들어간다 */
                  authed((t) => inviteToRoom(post.id, target.userId, t))
                    .then((r) => router.push(wf(`/chat/${r.roomId}`)))
                    .catch(async (e: unknown) => {
                      if (e instanceof ApiFailure && e.code === 'CHAT_ALREADY_MEMBER') {
                        const room = await authed((t) => fetchRooms(t))
                          .then((rooms) => rooms.find((x) => x.postId === post.id))
                          .catch(() => undefined)
                        if (room) {
                          router.push(wf(`/chat/${room.roomId}`))
                          return
                        }
                      }
                      fail(e)
                    })
                }}
              >
                초대
              </Button>
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
            isGuest ? gate('report') : setAsk({ k: 'report-user', userId: ask.user.id, name: ask.user.nickname })
          }
        />
      )}

      {ask?.k === 'report-user' && (
        <ReportSheet target="user" targetId={ask.userId} name={ask.name} onClose={() => setAsk(null)} />
      )}

      {ask?.k === 'report' && (
        <ReportSheet target="post" targetId={post.id} onClose={() => setAsk(null)} />
      )}

      {ask?.k === 'report-comment' && (
        <ReportSheet target="comment" targetId={ask.id} onClose={() => setAsk(null)} />
      )}
    </PageShell>
  )
}
