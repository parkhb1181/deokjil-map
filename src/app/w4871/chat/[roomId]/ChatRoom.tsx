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
 * **실시간은 SSE 다** (CH-10 · lib/api/chat-stream.ts). 방을 여는 동안
 * 스트림 하나를 열어 두고 오는 대로 끼운다. 끊기면 마지막 번호부터
 * 다시 받고(CH-11), 서버가 「너무 많다」(gap) 고 하면 목록 한 장을
 * 다시 받아 메운다. 스트림이 아예 못 붙는 동안(403 · 404)만 30초
 * 폴링으로 버틴다 — 지운 메시지의 상태 변화도 이쪽으로 따라온다.
 * 화면이 안 보일 때(다른 탭)는 폴링을 쉰다.
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
import { ReportSheet } from '@/components/ui/ReportSheet'
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
  markRead,
  sendMessage,
  toMsg,
  confirmImageUpload,
  fetchImageUrls,
  issueImageUpload,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  MESSAGE_MAX,
  type ChatMember,
  type ChatMsg,
  type ChatRoomDetail,
} from '@/lib/api/chat'
import { openStream } from '@/lib/api/chat-stream'
import { putToStorage } from '@/lib/api/users'
import { shrinkImage } from '@/lib/image-shrink'
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
  /** 사진 번호 (CH-14). 볼 주소는 따로 받는다 */
  imageId?: string | null
  /** 올리는 중인 내 사진의 미리보기. 서버 주소가 오면 버린다 */
  localUrl?: string
  /** 보낸 사람 이름. 서버 메시지에는 붙어 온다 — 나간 사람의 말도 이름이 남아야 한다 */
  who?: string
}

/* ── 그리기 ───────────────────────────────────────────── */

interface ScreenProps {
  roomId: string
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
  /** 사진을 골랐다 (CH-14). 없으면 사진 버튼이 안 선다 (목데이터) */
  onAttach?: (file: File) => void
  /** 메시지 번호 → 볼 주소. 없거나 만료된 것은 회색 자리로 그린다 */
  imageUrls?: Record<string, string>
  /** 내 말풍선에 「삭제」 를 단다. 목데이터에는 없다 */
  onDelete?: (id: string) => void
  onLeave?: () => void
  /** 지금 쓸 수 있는가 (CH-08). 아니면 입력칸 자리에 이유가 선다 */
  writable: boolean
  offReason?: string
  /** 위쪽 띠. 전송 실패 같은 것 */
  failed: string | null
  /** 목록 위. 「이전 메시지」 */
  head?: ReactNode
  /** 목록 대신 띄울 것 */
  instead?: ReactNode
}

function RoomScreen(p: ScreenProps) {
  const [first, setFirst] = useState(false)
  /**
   * 신고는 셋이다 (CH-21). 사람(더보기에서 고른 멤버) · 방 전체 · 메시지 한 건.
   * 더보기에서 **누구인지 먼저 고르고** 그다음으로 간다.
   */
  type Ask = null | 'leave' | { k: 'user'; id: string; name: string } | { k: 'room' } | { k: 'message'; id: string }
  const [ask, setAsk] = useState<Ask>(null)
  const [menu, setMenu] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const seen = useRef(false)
  /* 바닥에 붙어 있는가. 위로 올려 읽는 중이면 새 말이 와도 안 끌어내린다 */
  const stuck = useRef(true)
  const [unseen, setUnseen] = useState(false)

  /* 메시지에 이름이 붙어 오면 그것을 쓴다 (나간 사람도 이름이 남는다). 목데이터는 멤버에서 찾는다 */
  const nameOf = (m: Line) => m.who ?? p.others.find((x) => x.id === m.from)?.nickname ?? '나간 사람'

  /* 처음 열었는데 대화가 비어 있으면 안내를 띄운다 (CH-10). 한 번만 —
     비어 있을 때마다 띄우면 첫 말을 지운 사람이 안내를 두 번 본다 */
  useEffect(() => {
    if (seen.current || p.instead) return
    seen.current = true
    if (p.lines.length === 0) setFirst(true)
  }, [p.lines.length, p.instead])

  /*
   * 들어오면 맨 아래다. 채팅은 마지막 줄이 지금이라 위에서 시작하면
   * 매번 끝까지 내려야 한다.
   *
   * **새 줄이 붙었을 때는 둘 중 하나다.** 바닥 근처에 있었거나 내가 보낸
   * 말이면 따라 내려간다. 위로 올려 옛 말을 읽는 중이면 그 자리를 두고
   * 「새 메시지」 단추만 띄운다 — 읽던 줄이 화면 밖으로 튀는 것이 이
   * 화면에서 제일 화나는 일이다 (프로덕션 QA).
   */
  const last = p.lines.at(-1)
  const lastId = last?.id
  const lastMine = last?.from === p.me
  useEffect(() => {
    if (stuck.current || lastMine) {
      endRef.current?.scrollIntoView({ block: 'end' })
      setUnseen(false)
    } else if (lastId) {
      setUnseen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId])
  const onScroll = () => {
    const el = boxRef.current
    if (!el) return
    stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (stuck.current) setUnseen(false)
  }
  const jumpDown = () => {
    stuck.current = true
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    setUnseen(false)
  }

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
      {/* 어느 약속인지. 시각을 확인하려고 뒤로 나갔다 오지 않게 한다.
          아직 방을 못 받았으면(불러오는 중) 빈 값이라 안 그린다 */}
      {p.postId && p.meetAt && (
        <Link className="croom__on" href={wf(`/p/${p.postId}`)}>
          <span className="croom__ontitle">{p.title}</span>
          <span className="croom__onwhen">{whenText(p.meetAt)}</span>
        </Link>
      )}

      {/* 저장 고지 (CH-22). 방 위에 늘 있다 */}
      <ChatNotice />

      {p.failed && (
        <p className="form__failed" role="alert">
          {p.failed}
        </p>
      )}

      <div className="croom" ref={boxRef} onScroll={onScroll}>
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
                    /* 지운 메시지도 신고할 수 있다 — 본문이 남아 관리자가 본다. 아직 안 올라간 내 말은 번호가 없다 */
                    onReport={!mine && !m.pending ? () => setAsk({ k: 'message', id: m.id }) : undefined}
                    image={
                      m.imageId || m.localUrl ? { url: m.localUrl ?? p.imageUrls?.[m.id] ?? null } : undefined
                    }
                  />
                </div>
              )
            })}
          </>
        )}

        <div ref={endRef} />
      </div>
      {unseen && (
        <div className="croom__jumpwrap">
          <button type="button" className="croom__jump" onClick={jumpDown}>
            새 메시지 ↓
          </button>
        </div>
      )}

      {/* 입력칸은 화면 아래에 붙인다. 댓글과 다른 자리다 — 댓글은 읽는
          글의 끝이지만 채팅은 읽는 내내 쓰는 자리라 따라다녀야 한다 */}
      {p.writable ? (
        <div className="cwrite">
          {p.onAttach && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_TYPES.join(',')}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) p.onAttach?.(f)
                }}
              />
              {/* 사진 하나. 여러 장은 한 장씩 — 메시지 하나에 사진 하나가 계약이다 (CH-14) */}
              <button type="button" className="cwrite__attach" aria-label="사진 보내기" onClick={() => fileRef.current?.click()}>
                +
              </button>
            </>
          )}
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
              {/* 방 자체를 신고한다 (CH-21). 나간 사람도 할 수 있다 */}
              <Button
                tone="ghost"
                onClick={() => {
                  setMenu(false)
                  setAsk({ k: 'room' })
                }}
              >
                이 방 신고
              </Button>
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
                      setAsk({ k: 'user', id: m.id, name: m.nickname })
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

      {ask && ask !== 'leave' && (
        <ReportSheet
          target={ask.k}
          targetId={ask.k === 'room' ? p.roomId : ask.id}
          name={ask.k === 'user' ? ask.name : undefined}
          onClose={() => setAsk(null)}
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
    imageId: m.imageId,
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

/**
 * 내 말이 올라갔다 — 흐린 말풍선을 거두고 번호 붙은 줄로 바꾼다.
 *
 * **스트림이 먼저 도착해 있을 수 있다.** 서버는 저장하자마자 방에 뿌리고,
 * 그 한 줄이 POST 응답보다 먼저 오는 일이 흔하다 (프로덕션 QA 에서 연타
 * 두 번에 말풍선 셋). 그때 tmp 를 번호로 바꾸기만 하면 같은 번호가 둘이
 * 된다. 번호로 하나만 남기되, 스트림이 준 줄(이름이 붙어 있다)을 우선한다.
 */
function settle(prev: Line[], tmp: string, mine: Line): Line[] {
  const had = prev.find((l) => l.id === mine.id)
  const rest = prev.filter((l) => l.id !== tmp && l.id !== mine.id)
  return [...rest, had ? { ...had, localUrl: mine.localUrl ?? had.localUrl } : mine].sort(byTime)
}

/* 스트림이 못 붙었을 때만 도는 예비 폴링 */
const POLL_MS = 30_000

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

  /* 스트림이 살아 있는가. 죽어 있으면 아래 예비 폴링이 돈다 */
  const [live, setLive] = useState(false)

  /*
   * 읽은 지점 (CH-13). 방을 보고 있는 동안 가장 큰 번호를 서버에 올린다.
   * 화면이 안 보이면 안 올린다 — 안 본 것을 읽었다고 하면 배지가 거짓이 된다.
   * 같은 번호는 한 번만. 서버에 아직 없으면(404) 조용히 넘긴다.
   */
  const readUpTo = useRef<string | null>(null)
  const topId = lines.reduce<string | null>((a, l) => {
    const n = Number(l.id)
    return Number.isFinite(n) && (a === null || n > Number(a)) ? l.id : a
  }, null)
  useEffect(() => {
    if (state !== 'ready' || !topId) return
    const send = () => {
      if (readUpTo.current === topId || document.visibilityState === 'hidden') return
      readUpTo.current = topId
      authed((token) => markRead(roomId, topId, token)).catch(() => undefined)
    }
    send()
    /* 숨긴 채 받은 것은 다시 보일 때 올린다 */
    document.addEventListener('visibilitychange', send)
    return () => document.removeEventListener('visibilitychange', send)
  }, [roomId, state, topId])

  /*
   * 실시간 (CH-10 · CH-11). 첫 장을 받은 뒤에 연다 — 그래야 마지막 번호를
   * 들고 열어 그 사이에 온 것을 안 놓친다. 오는 것은 목록의 한 줄과 같은
   * 모양이라 같은 merge 로 끼운다. gap 이 오면 최근 장을 다시 받는다.
   */
  useEffect(() => {
    if (state !== 'ready') return
    const numeric = lines.map((l) => Number(l.id)).filter((n) => Number.isFinite(n))
    const lastId = numeric.length ? String(Math.max(...numeric)) : null
    /* 붙기 전까지는 예비 폴링이 돈다. 붙으면(onUp) 쉬고, 떨어지면(onDown) 다시 돈다 */
    const close = openStream<unknown>(roomId, lastId, {
      onUp: () => setLive(true),
      onDown: () => setLive(false),
      onMessage: (raw) => {
        try {
          const m = toMsg(raw)
          setLines((v) => merge(v, [m]))
        } catch {
          /* 계약과 다른 한 줄. 다음 폴링이나 재접속이 목록으로 메운다 */
        }
      },
      onGap: () => {
        authed((token) => fetchMessages(roomId, token))
          .then((page) => setLines((v) => merge(v, page.items)))
          .catch(() => undefined)
      },
      onDead: () => setLive(false),
    })
    return () => {
      close()
      setLive(false)
    }
    /* lines 는 일부러 안 본다 — 줄이 붙을 때마다 스트림을 다시 열면 안 된다 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, state])

  /*
   * 예비 폴링. 스트림이 안 붙어 있는 동안만 (아직 안 열림 · 5xx 로 재시도 중 ·
   * 403 · 404) 30초마다 최근 장을 받는다. 화면이 안 보이면 쉰다.
   * 프로덕션에서 스트림이 500 을 내던 날 이것이 없어서 새 글이 안 왔다.
   */
  useEffect(() => {
    if (state !== 'ready' || live) return
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
  }, [roomId, state, live])

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

  /*
   * 사진 주소 (CH-15). 공개 주소가 없어 볼 때마다 60초짜리를 받는다.
   * 사진이 실린 줄 중 주소가 없거나 곧 만료되는 것을 모아 한 번에 묻고,
   * 45초마다 다시 본다 — 만료 뒤 회색으로 돌아가는 것보다 미리 갈아끼운다.
   */
  const [imgs, setImgs] = useState<Record<string, { url: string; until: number }>>({})
  const imgWant = lines
    .filter((l) => l.imageId && !l.localUrl && !Number.isNaN(Number(l.id)))
    .map((l) => l.id)
    .filter((id) => !imgs[id] || imgs[id].until - Date.now() < 5_000)
    .join(',')
  useEffect(() => {
    if (state !== 'ready') return
    let alive = true
    const tick = () => {
      const ids = imgWant ? imgWant.split(',') : []
      if (ids.length === 0) return
      authed((token) => fetchImageUrls(roomId, ids, token))
        .then((got) => {
          if (!alive) return
          const now = Date.now()
          setImgs((v) => ({
            ...v,
            ...Object.fromEntries(Object.entries(got).map(([id, g]) => [id, { url: g.url, until: now + g.expiresInSeconds * 1000 }])),
          }))
        })
        .catch(() => undefined)
    }
    tick()
    const id = window.setInterval(tick, 45_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [roomId, state, imgWant])
  const imageUrls = Object.fromEntries(Object.entries(imgs).map(([id, g]) => [id, g.url]))

  /*
   * 사진 보내기 (CH-14 · CH-16). 브라우저에서 줄여(1280px jpeg) 서명을 받고
   * 저장소에 바로 올린 뒤 확정하고, 그 번호를 실어 메시지를 보낸다. EXIF 는
   * 캔버스를 거치며 이미 떨어지고, 서버 워커가 한 번 더 벗긴다. 올리는 동안
   * 미리보기가 흐리게 서고, 어디서든 실패하면 거둔다.
   */
  const attach = async (file: File) => {
    if (!me) return
    setFailed(null)
    const cid = crypto.randomUUID()
    const tmp = `tmp:${cid}`
    const text = draft.trim()
    let localUrl: string | null = null
    try {
      const small = await shrinkImage(file, { maxEdge: 1280 }).catch(() => {
        throw new ApiFailure('CHAT_IMAGE_TYPE_NOT_ALLOWED', '읽을 수 없는 사진이에요. JPG · PNG · WEBP 만 보낼 수 있어요', 400)
      })
      if (small.size > IMAGE_MAX_BYTES) throw new ApiFailure('CHAT_IMAGE_TOO_LARGE', '사진이 너무 커요', 400)
      localUrl = URL.createObjectURL(small)
      setLines((v) => [...v, { id: tmp, from: me, text, at: stamp(), pending: true, localUrl: localUrl ?? undefined }])
      setDraft('')
      const sent = await authed(async (token) => {
        const issued = await issueImageUpload(roomId, small, token)
        await putToStorage(issued.uploadUrl, small, { once: true })
        await confirmImageUpload(roomId, issued.imageId, token)
        return sendMessage(roomId, { clientMessageId: cid, content: text, imageId: issued.imageId }, token)
      })
      setLines((v) =>
        settle(v, tmp, {
          id: sent.id,
          from: sent.senderId,
          text: sent.content,
          at: sent.createdAt,
          imageId: sent.imageId,
          localUrl: localUrl ?? undefined,
        }),
      )
    } catch (e: unknown) {
      setLines((v) => v.filter((l) => l.id !== tmp))
      if (!draftRef.current) setDraft(text)
      fail(e)
    }
  }

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
      .then((sent) => setLines((v) => settle(v, tmp, { id: sent.id, from: sent.senderId, text: sent.content, at: sent.createdAt })))
      .catch((e: unknown) => {
        /* 못 올라갔다. 흐린 말풍선을 거두고 친 것을 입력칸에 되돌린다 */
        setLines((v) => v.filter((l) => l.id !== tmp))
        if (!draftRef.current) setDraft(text)
        fail(e)
      })
  }

  const remove = (id: string) => {
    setFailed(null)
    /* 자리표시자로 먼저 바꾼다. 서버가 거절하면 스트림이나 폴링이 되돌린다 */
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
      roomId={roomId}
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
      onAttach={attach}
      imageUrls={imageUrls}
      onDelete={remove}
      onLeave={leave}
      writable={Boolean(room?.writable) && state === 'ready'}
      offReason="만남 후 7일이 지나 읽기만 할 수 있어요"
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
      roomId={roomId}
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
      failed={null}
    />
  )
}

export default function ChatRoom({ roomId }: { roomId: string }) {
  return USE_API ? <ApiRoom roomId={roomId} /> : <MockRoom roomId={roomId} />
}
