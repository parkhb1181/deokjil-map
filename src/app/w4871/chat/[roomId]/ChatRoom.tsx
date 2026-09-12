'use client'

/**
 * 채팅방 (CH-04 · CH-06 ~ CH-09 · CH-12 · CH-20 · CH-22).
 *
 * 1차의 비밀 댓글이 하던 일을 대신한다. 지금은 사람들이 비밀 댓글에
 * 카톡 아이디와 전화번호를 **평문으로** 적고 그것이 우리 DB 에 쌓인다.
 * 이 화면이 그 자리를 없애는 것이 목적이다.
 *
 * **방은 한 가지다.** 글 하나에 방 하나이고, 방장이 댓글 단 사람 중에서
 * 골라 부른다 (CH-01). 승인·수락 절차를 따로 만들지 않은 자리를 이
 * 초대가 대신한다 — 방장만 누르므로 절차가 한 번에 끝난다.
 *
 * 둘만 있는 방도 같은 화면이다. 1:1 을 따로 두지 않는다 — 갈라 두면
 * 제목·말풍선 이름·신고 대상이 전부 두 벌이 되는데, 정작 둘뿐인 방은
 * 사람이 하나 적을 뿐 나머지가 같다.
 *
 * 신고는 **누구를** 인지 먼저 고른다. 여럿이 있는 방에서 「신고」 하나만
 * 있으면 대상이 없다. 차단은 2차에서 뺐다 (위키 2차 명세서).
 *
 * 맨 위에 모집글 요약을 둔다. 상대가 여럿이면 닉네임만으로는 어느
 * 약속인지 알 수 없고, 약속 시각을 확인하려고 뒤로 나갔다 오게 된다.
 *
 * ─────────────────────────────────────────────────────────
 * **서버가 있으면 서버, 없으면 목데이터.** 그리는 부분(`RoomScreen`)은
 * 같고 데이터를 어디서 가져오느냐만 다르다.
 *
 * **실시간이 아직 없다.** CH-10 (SSE) 이 서버에 없어서 5초마다 최근
 * 장을 다시 받아 없는 것만 끼운다. 붙으면 그 폴링 하나만 바꾼다.
 * 화면이 안 보일 때(다른 탭)는 안 묻는다 — 열어 둔 채 잊은 방이 하루
 * 종일 서버를 두드린다.
 *
 * **보내기는 화면부터 바꾼다.** 서버 답이 오기 전에 흐린 말풍선이 서고,
 * 오면 진해진다. 안 오면 지우고 입력칸에 되돌려 놓는다 — 사라진 말을
 * 다시 치게 하는 것보다 낫다. `clientMessageId` 는 같은 말이 두 번
 * 올라가지 않게 하는 서버 쪽 장치다 (CH-07).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Blank, Button, Sheet } from '@/components/ui/Basics'
import { ReportSheet, type ReportTarget } from '@/components/ui/ReportSheet'
import { ChatBubble, ChatDay, ChatFirst, ChatNotice, clock, dayLabel, type ChatMessage } from '@/components/ui/Chat'
import { wf } from '@/lib/wireframe'
import { USE_API } from '@/lib/api/config'
import { ApiFailure } from '@/lib/api/http'
import { slotFor } from '@/lib/api/errors'
import {
  deleteMessage,
  fetchMessages,
  fetchRoom,
  leaveRoom,
  sendMessage,
  MESSAGE_MAX,
  type ChatMember,
  type ChatMsg,
  type ChatRoomDetail,
} from '@/lib/api/chat'
import { authed } from '@/lib/auth/authed'
import { useViewer } from '@/lib/auth/useViewer'
import { stamp } from '@/lib/when'
import raw from '@/data/chat.sample.json'

/** '2026-09-14T09:00' → '9월 14일 (일) 오전 9:00'. 오프셋·초가 붙어 있어도 읽는다 */
function whenText(iso: string) {
  const [d, t = ''] = iso.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(/[+\-Z]/)[0].split(':').map(Number)
  const dow = '일월화수목금토'[new Date(y, m - 1, day).getDay()]
  const ampm = hh < 12 ? '오전' : '오후'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${m}월 ${day}일 (${dow}) ${ampm} ${h12}:${String(mm).padStart(2, '0')}`
}

/** 최대 글자수. 서버와 같은 값이어야 한다 (CH-07) */
const MAX = MESSAGE_MAX

/** 사람 하나 */
type Member = { id: string; nickname: string; imageUrl?: string | null }

/** 화면에 서는 한 줄. 서버 메시지와 아직 안 올라간 내 말을 같은 모양으로 둔다 */
type Line = ChatMessage & {
  deleted?: boolean
  pending?: boolean
  /** 보낸 사람 이름. 서버 메시지에는 붙어 온다 — 나간 사람의 말도 이름이 남아야 한다 */
  who?: string
}

/* ── 그리기 ───────────────────────────────────────────── */

interface ScreenProps {
  title: string
  postId: string
  meetAt: string
  /** 내 회원번호. 모르면(아직 안 받음) 전부 남의 말로 그린다 */
  me: string | null
  /** 나를 뺀 사람들. 신고 대상이고 말풍선 이름의 출처다 */
  others: Member[]
  /** 방장. 서버 상세에는 안 와서 (chat.ts 머리말) API 경로는 null */
  hostId: string | null
  lines: Line[]
  draft: string
  onDraft: (v: string) => void
  onSend: () => void
  /** 내 말풍선에 「삭제」 를 단다. 목데이터에는 없다 */
  onDelete?: (id: string) => void
  onLeave?: () => void
  /** 지금 쓸 수 있는가 (CH-08). 아니면 입력칸 자리에 이유가 선다 */
  writable: boolean
  offReason?: string
  /** 사람 신고의 대상 종류. 서버가 채팅 신고(CH-21)를 아직 안 받아 API 경로는 사람 신고로 간다 */
  reportTarget: ReportTarget
  /** 위쪽 띠. 전송 실패 같은 것 */
  failed: string | null
  /** 목록 위. 「이전 메시지」 */
  head?: ReactNode
  /** 목록 대신 띄울 것 */
  instead?: ReactNode
}

function RoomScreen(p: ScreenProps) {
  const [first, setFirst] = useState(false)
  const [ask, setAsk] = useState<null | 'report' | 'leave'>(null)
  const [menu, setMenu] = useState(false)
  /** 신고 대상. 더보기에서 **누구인지 먼저 고르고** 그다음으로 간다 */
  const [who, setWho] = useState<Member | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const seen = useRef(false)

  /* 메시지에 이름이 붙어 오면 그것을 쓴다 (나간 사람도 이름이 남는다). 목데이터는 멤버에서 찾는다 */
  const nameOf = (m: Line) => m.who ?? p.others.find((x) => x.id === m.from)?.nickname ?? '나간 사람'

  /* 처음 열었는데 대화가 비어 있으면 안내를 띄운다 (CH-10). 한 번만 —
     비어 있을 때마다 띄우면 첫 말을 지운 사람이 안내를 두 번 본다 */
  useEffect(() => {
    if (seen.current || p.instead) return
    seen.current = true
    if (p.lines.length === 0) setFirst(true)
  }, [p.lines.length, p.instead])

  /* 들어오면 맨 아래다. 채팅은 마지막 줄이 지금이라 위에서 시작하면
     매번 끝까지 내려야 한다. 새 줄이 붙어도 따라 내려간다 */
  const lastId = p.lines.at(-1)?.id
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lastId])

  return (
    <PageShell
      fill
      /* 사람 이름을 못 쓴다. 글 제목이 곧 방 이름이다 — 방이 글 하나에
         하나라서 그것이 가장 짧게 구분된다 */
      title={p.title}
      right={
        <Button size="sm" tone="ghost" onClick={() => setMenu(true)}>
          더보기
        </Button>
      }
    >
      {/* 어느 약속인지. 시각을 확인하려고 뒤로 나갔다 오지 않게 한다 */}
      <Link className="croom__on" href={wf(`/p/${p.postId}`)}>
        <span className="croom__ontitle">{p.title}</span>
        <span className="croom__onwhen">{whenText(p.meetAt)}</span>
      </Link>

      {/* 저장 고지 (CH-22). 방 위에 늘 있다 */}
      <ChatNotice />

      {p.failed && (
        <p className="form__failed" role="alert">
          {p.failed}
        </p>
      )}

      <div className="croom">
        {p.instead ?? (
          <>
            {p.head}
            {first && <ChatFirst onClose={() => setFirst(false)} />}

            {p.lines.map((m, i) => {
              const prev = p.lines[i - 1]
              const nextMsg = p.lines[i + 1]
              const newDay = !prev || prev.at.split('T')[0] !== m.at.split('T')[0]
              /* 같은 사람이 같은 분에 연달아 보낸 묶음의 마지막에만 시각을
                 붙인다. 줄마다 붙이면 같은 시각이 세 번 나온다 */
              const tail = !nextMsg || nextMsg.from !== m.from || nextMsg.at.slice(0, 16) !== m.at.slice(0, 16)
              /* 남의 말풍선 묶음 첫 줄에만 이름을 붙인다. 날이 바뀌면 다시
                 붙인다 — 어제 마지막으로 말한 사람을 기억하고 있으라고 할
                 수 없다 */
              const head = !prev || prev.from !== m.from || newDay
              const mine = m.from === p.me
              const label = !mine && head ? nameOf(m) : undefined

              return (
                <div key={m.id}>
                  {newDay && <ChatDay label={dayLabel(m.at)} />}
                  <ChatBubble
                    text={m.text}
                    mine={mine}
                    time={clock(m.at)}
                    tail={tail}
                    who={label}
                    deleted={m.deleted}
                    pending={m.pending}
                    onDelete={mine && p.onDelete ? () => p.onDelete?.(m.id) : undefined}
                  />
                </div>
              )
            })}
          </>
        )}

        <div ref={endRef} />
      </div>

      {/* 입력칸은 화면 아래에 붙인다. 댓글과 다른 자리다 — 댓글은 읽는
          글의 끝이지만 채팅은 읽는 내내 쓰는 자리라 따라다녀야 한다 */}
      {p.writable ? (
        <div className="cwrite">
          <textarea
            className="cwrite__box"
            rows={1}
            placeholder="메시지 보내기"
            value={p.draft}
            onChange={(e) => p.onDraft(e.target.value)}
            onKeyDown={(e) => {
              /* Enter 는 줄바꿈이 아니라 전송이다. 짧은 말을 여러 번
                 보내는 자리라 매번 버튼까지 손을 옮기면 느리다.
                 줄을 바꾸고 싶으면 Shift 를 같이 누른다 */
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                p.onSend()
              }
            }}
          />
          {/* 크기를 지정하지 않는다. 기본 버튼이 입력칸과 같은
             --tap 높이라 나란히 섰을 때 밑선이 맞는다 */}
          <Button className="cwrite__send" disabled={!p.draft.trim() || p.draft.length > MAX} onClick={p.onSend}>
            전송
          </Button>
        </div>
      ) : (
        /* 왜 못 쓰는지를 입력칸 자리에 적는다. 칸만 없애면 고장으로 읽힌다 */
        !p.instead && <div className="cwrite cwrite--off">{p.offReason ?? '지금은 메시지를 보낼 수 없어요'}</div>
      )}

      {/*
        더보기는 사람을 먼저 고른다.

        「신고」 하나만 두면 셋이 있는 방에서 누구를 신고하는지가 없다.
        사유를 고르는 화면까지 가서야 대상이 빠진 것을 알면 처음부터
        다시 해야 한다.
      */}
      {menu && (
        <Sheet
          title={`대화 상대 ${p.others.length}명`}
          desc="신고할 사람을 고르세요. 상대에게는 알리지 않아요."
          foot={
            <>
              {/* 나가기는 방장이 아닐 때만 뜻이 있는데, 서버가 방장을
                  안 알려줘서 (chat.ts) 눌러 보고 409 를 받는다 */}
              {p.onLeave && (
                <Button
                  tone="danger"
                  onClick={() => {
                    setMenu(false)
                    setAsk('leave')
                  }}
                >
                  방 나가기
                </Button>
              )}
              <Button tone="ghost" onClick={() => setMenu(false)}>
                닫기
              </Button>
            </>
          }
        >
          <ul className="croom__people">
            {p.others.map((m) => (
              <li key={m.id} className="croom__person">
                <Avatar name={m.nickname} src={m.imageUrl ?? undefined} />
                <span className="croom__pname">
                  {m.nickname}
                  {/* 방장을 표시한다. 부른 사람이 누구인지 알아야 읽힌다 */}
                  {m.id === p.hostId && <b className="croom__host">방장</b>}
                </span>
                <span className="croom__pacts">
                  <Button
                    size="sm"
                    tone="ghost"
                    onClick={() => {
                      setMenu(false)
                      setWho(m)
                      setAsk('report')
                    }}
                  >
                    신고
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {ask === 'report' && (
        <ReportSheet
          target={p.reportTarget}
          targetId={who?.id}
          name={who?.nickname}
          onClose={() => {
            setAsk(null)
            setWho(null)
          }}
        />
      )}

      {ask === 'leave' && (
        <Sheet
          title="이 방을 나갈까요?"
          /* 되돌릴 수 없는 것을 먼저 말한다 (CH-02a). 나가면 방장이 다시
             부를 수 없고, 대화도 더는 안 보인다 (CH-18) */
          desc="나가면 대화가 더 보이지 않고, 방장이 다시 부를 수 없어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>
                취소
              </Button>
              <Button
                tone="danger"
                onClick={() => {
                  setAsk(null)
                  p.onLeave?.()
                }}
              >
                나가기
              </Button>
            </>
          }
        />
      )}
    </PageShell>
  )
}

/* ── 서버 ─────────────────────────────────────────────── */

function toLine(m: ChatMsg): Line {
  return {
    id: m.id,
    from: m.sender.id,
    who: m.sender.nickname,
    text: m.content ?? '',
    at: m.createdAt,
    deleted: m.status === 'DELETED',
  }
}

/** 시각 순, 같으면 번호 순. 아직 안 올라간 내 말(번호 없음)은 맨 뒤 */
function byTime(a: Line, b: Line): number {
  const t = a.at.localeCompare(b.at)
  if (t !== 0) return t
  const na = Number(a.id)
  const nb = Number(b.id)
  if (Number.isNaN(na)) return 1
  if (Number.isNaN(nb)) return -1
  return na - nb
}

/** 서버에서 온 것으로 갈아끼운다. 없던 것은 더하고, 있던 것은 (지워졌을 수 있으니) 새 상태로 */
function merge(prev: Line[], incoming: ChatMsg[]): Line[] {
  const map = new Map(prev.map((l) => [l.id, l]))
  for (const m of incoming) map.set(m.id, toLine(m))
  return [...map.values()].sort(byTime)
}

const POLL_MS = 5_000

function ApiRoom({ roomId }: { roomId: string }) {
  const router = useRouter()
  const { viewer } = useViewer({ role: 'guest', userId: null, sanction: null })
  const [room, setRoom] = useState<ChatRoomDetail | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [state, setState] = useState<'loading' | 'ready' | 'guest' | 'gone' | 'sanction' | 'error'>('loading')
  const [failed, setFailed] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [older, setOlder] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const fail = (e: unknown) => setFailed(slotFor(e).text)

  /* 첫 장. 방 상세와 최근 메시지를 같이 받는다 — 차례로 받으면 왕복이 둘 */
  useEffect(() => {
    let alive = true
    authed(async (token) => {
      const [detail, page] = await Promise.all([fetchRoom(roomId, token), fetchMessages(roomId, token)])
      return { detail, page }
    })
      .then(({ detail, page }) => {
        if (!alive) return
        setRoom(detail)
        setLines(merge([], page.items))
        setCursor(page.nextCursor)
        setHasNext(page.hasNext)
        setState('ready')
      })
      .catch((e: unknown) => {
        if (!alive) return
        if (e instanceof ApiFailure) {
          if (e.code === 'NOT_SIGNED_IN') return setState('guest')
          if (e.code === 'USER_SANCTIONED') return setState('sanction')
          if (e.httpStatus === 404 || e.code === 'CHAT_ROOM_ACCESS_DENIED') return setState('gone')
        }
        setState('error')
      })
    return () => {
      alive = false
    }
  }, [roomId])

  /*
   * 폴링. 최근 장을 다시 받아 없는 것만 끼운다 (CH-10 이 오면 이 자리가
   * SSE 로 바뀐다). 화면이 안 보이면 쉰다. 실패는 조용히 넘긴다 — 5초
   * 뒤에 다시 묻는다.
   */
  useEffect(() => {
    if (state !== 'ready') return
    let busy = false
    const tick = () => {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      authed((token) => fetchMessages(roomId, token))
        .then((page) => setLines((v) => merge(v, page.items)))
        .catch(() => undefined)
        .finally(() => {
          busy = false
        })
    }
    const id = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [roomId, state])

  const loadOlder = useCallback(() => {
    if (!cursor || older) return
    setOlder(true)
    authed((token) => fetchMessages(roomId, token, { cursor }))
      .then((page) => {
        setLines((v) => merge(v, page.items))
        setCursor(page.nextCursor)
        setHasNext(page.hasNext)
      })
      .catch(fail)
      .finally(() => setOlder(false))
  }, [roomId, cursor, older])

  const me = viewer.userId

  const send = () => {
    const text = draft.trim()
    if (!text || text.length > MAX || !me) return
    setFailed(null)
    /* 같은 말이 두 번 올라가지 않게 하는 서버 쪽 열쇠 (CH-07) */
    const cid = crypto.randomUUID()
    const tmp = `tmp:${cid}`
    setLines((v) => [...v, { id: tmp, from: me, text, at: stamp(), pending: true }])
    setDraft('')
    authed((token) => sendMessage(roomId, { clientMessageId: cid, content: text }, token))
      .then((sent) =>
        setLines((v) =>
          v.map((l) => (l.id === tmp ? { id: sent.id, from: sent.senderId, text: sent.content, at: sent.createdAt } : l)),
        ),
      )
      .catch((e: unknown) => {
        /* 못 올라갔다. 흐린 말풍선을 거두고 친 것을 입력칸에 되돌린다 */
        setLines((v) => v.filter((l) => l.id !== tmp))
        if (!draftRef.current) setDraft(text)
        fail(e)
      })
  }

  const remove = (id: string) => {
    setFailed(null)
    /* 자리표시자로 먼저 바꾼다. 서버가 거절하면 다음 폴링이 되돌린다 */
    setLines((v) => v.map((l) => (l.id === id ? { ...l, deleted: true } : l)))
    authed((token) => deleteMessage(roomId, id, token)).catch(fail)
  }

  const leave = () => {
    setFailed(null)
    authed((token) => leaveRoom(roomId, token))
      .then(() => router.replace(wf('/chat')))
      .catch(fail)
  }

  let instead: ReactNode
  if (state === 'loading') instead = <p className="croom__state">불러오는 중…</p>
  else if (state === 'guest')
    instead = (
      <Blank
        title="로그인하면 대화를 볼 수 있어요"
        action={
          <Link className="btn btn--primary btn--sm" href={wf('/login')}>
            로그인
          </Link>
        }
      />
    )
  else if (state === 'sanction')
    instead = <Blank title="제재 중에는 채팅을 볼 수 없어요" desc="내 활동에서 사유를 확인할 수 있어요" />
  else if (state === 'gone')
    instead = (
      <Blank
        title="들어갈 수 없는 방이에요"
        desc="방이 없거나 이 방의 멤버가 아니에요"
        action={
          <Link className="btn btn--primary btn--sm" href={wf('/chat')}>
            채팅 목록
          </Link>
        }
      />
    )
  else if (state === 'error')
    instead = (
      <Blank
        title="대화를 불러오지 못했어요"
        desc="연결이 불안정해요. 잠시 뒤 다시 열어주세요"
        action={
          <Button size="sm" tone="ghost" onClick={() => location.reload()}>
            다시 시도
          </Button>
        }
      />
    )

  const others: Member[] = (room?.members ?? []).filter((m: ChatMember) => m.id !== me)

  return (
    <RoomScreen
      title={room?.post.title ?? '채팅'}
      postId={room?.post.id ?? ''}
      meetAt={room?.post.meetAt ?? ''}
      me={me}
      others={others}
      hostId={null}
      lines={lines}
      draft={draft}
      onDraft={setDraft}
      onSend={send}
      onDelete={remove}
      onLeave={leave}
      writable={Boolean(room?.writable) && state === 'ready'}
      offReason="만남 후 7일이 지나 읽기만 할 수 있어요"
      reportTarget="user"
      failed={failed}
      instead={instead}
      head={
        hasNext ? (
          <div className="croom__more">
            <Button size="sm" tone="ghost" onClick={loadOlder} disabled={older}>
              {older ? '불러오는 중…' : '이전 메시지'}
            </Button>
          </div>
        ) : undefined
      }
    />
  )
}

/* ── 목데이터 ─────────────────────────────────────────── */

function MockRoom({ roomId }: { roomId: string }) {
  const room = raw.rooms.find((r) => r.id === roomId) ?? raw.rooms[0]
  const me = raw.me
  const [lines, setLines] = useState<Line[]>(room.messages)
  const [draft, setDraft] = useState('')

  const send = () => {
    const text = draft.trim()
    if (!text || text.length > MAX) return
    /* 서버가 없다. 화면에만 쌓이고 새로고침하면 사라진다 */
    setLines((v) => [...v, { id: `tmp${v.length}`, from: me, text, at: new Date().toISOString().slice(0, 16) }])
    setDraft('')
  }

  return (
    <RoomScreen
      title={room.postTitle}
      postId={room.postId}
      meetAt={room.meetAt}
      me={me}
      others={room.members.filter((m) => m.id !== me)}
      hostId={room.host.id}
      lines={lines}
      draft={draft}
      onDraft={setDraft}
      onSend={send}
      writable
      reportTarget="chat"
      failed={null}
    />
  )
}

export default function ChatRoom({ roomId }: { roomId: string }) {
  return USE_API ? <ApiRoom roomId={roomId} /> : <MockRoom roomId={roomId} />
}
