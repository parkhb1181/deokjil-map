'use client'

/**
 * 채팅방 (CH-02 ~ CH-04 · CH-09 · CH-10 · SF-03 · SF-08).
 *
 * 1차의 비밀 댓글이 하던 일을 대신한다. 지금은 사람들이 비밀 댓글에
 * 카톡 아이디와 전화번호를 **평문으로** 적고 그것이 우리 DB 에 쌓인다.
 * 이 화면이 그 자리를 없애는 것이 목적이다.
 *
 * **방은 둘 중 하나다.**
 *
 * 1:1 은 댓글에서 상대를 지정해 연다 (CH-01). 단체는 **방장이 댓글 단
 * 사람 중에서 골라 부른다** — 글 하나에 방 하나이고, 정원(PO-02)이 곧
 * 방 인원이 된다. 승인·수락 절차를 따로 만들지 않은 자리를 이 초대가
 * 대신한다. 방장만 누르므로 절차가 한 번에 끝난다.
 *
 * 그래서 화면이 갈리는 곳이 셋이다. 제목(상대 이름 vs 글 제목),
 * 말풍선 이름, 그리고 더보기 — 단체에서는 신고·차단이 **누구를** 인지
 * 먼저 골라야 한다.
 *
 * 맨 위에 모집글 요약을 둔다. 상대가 여럿이면 닉네임만으로는 어느
 * 약속인지 알 수 없고, 약속 시각을 확인하려고 뒤로 나갔다 오게 된다.
 *
 * 서버가 아직 없다. 보낸 메시지는 화면에만 쌓이고 새로고침하면 사라진다.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Button, Sheet } from '@/components/ui/Basics'
import { ReportSheet } from '@/components/ui/ReportSheet'
import {
  ChatBubble,
  ChatDay,
  ChatFirst,
  ChatNotice,
  clock,
  dayLabel,
  type ChatMessage,
} from '@/components/ui/Chat'
import { wf } from '@/lib/wireframe'
import raw from '@/data/chat.sample.json'

/** '2026-09-14T09:00' → '9월 14일 (일) 오전 9:00' */
function whenText(iso: string) {
  const [d, t] = iso.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  const dow = '일월화수목금토'[new Date(y, m - 1, day).getDay()]
  const ampm = hh < 12 ? '오전' : '오후'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${m}월 ${day}일 (${dow}) ${ampm} ${h12}:${String(mm).padStart(2, '0')}`
}

/** 최대 글자수. 서버와 같은 값이어야 한다 (CH-02) */
const MAX = 1000

/** 사람 하나. 목데이터 모양이 방마다 조금씩 달라 여기서 좁힌다 */
type Member = { id: string; nickname: string; imageUrl?: string | null }

export default function ChatRoom({ roomId }: { roomId: string }) {
  const room = raw.rooms.find((r) => r.id === roomId) ?? raw.rooms[0]
  const me = raw.me
  const group = room.kind === 'GROUP'

  /* 나를 뺀 사람들. 신고·차단은 나에게 할 수 없다 */
  const others: Member[] = (room.members ?? [room.partner]).filter((m) => m.id !== me)
  const nameOf = (id: string) => others.find((m) => m.id === id)?.nickname ?? id

  const [msgs, setMsgs] = useState<ChatMessage[]>(room.messages)
  const [draft, setDraft] = useState('')
  const [blocked, setBlocked] = useState(room.status === 'BLOCKED')
  const [first, setFirst] = useState(msgs.length === 0)
  const [ask, setAsk] = useState<null | 'report' | 'block'>(null)
  const [menu, setMenu] = useState(false)
  /**
   * 신고·차단 대상.
   *
   * 1:1 이면 상대가 하나뿐이라 고를 것이 없다. 단체는 더보기에서
   * **누구인지 먼저 고르고** 그다음 신고·차단으로 간다.
   */
  const [who, setWho] = useState<Member | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  /* 들어오면 맨 아래다. 채팅은 마지막 줄이 지금이라 위에서 시작하면
     매번 끝까지 내려야 한다 */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs.length])

  const send = () => {
    const text = draft.trim()
    if (!text || text.length > MAX || blocked) return
    /* API 자리. POST /api/v1/chat/rooms/{roomId}/messages { text }
       지금은 화면에만 쌓는다 */
    setMsgs((v) => [
      ...v,
      { id: `tmp${v.length}`, from: me, text, at: new Date().toISOString().slice(0, 16) },
    ])
    setDraft('')
  }

  return (
    <PageShell
      fill
      /* 단체는 사람 이름을 못 쓴다. 글 제목이 곧 방 이름이다 —
         방이 글 하나에 하나라서 그것이 가장 짧게 구분된다 */
      title={group ? room.postTitle : room.partner.nickname}
      right={
        <Button size="sm" tone="ghost" onClick={() => setMenu(true)}>
          더보기
        </Button>
      }
    >
      {/* 어느 약속인지. 시각을 확인하려고 뒤로 나갔다 오지 않게 한다 */}
      <Link className="croom__on" href={wf(`/p/${room.postId}`)}>
        <span className="croom__ontitle">{room.postTitle}</span>
        <span className="croom__onwhen">{whenText(room.meetAt)}</span>
      </Link>

      <ChatNotice />

      <div className="croom">
        {first && <ChatFirst onClose={() => setFirst(false)} />}

        {msgs.map((m, i) => {
          const prev = msgs[i - 1]
          const nextMsg = msgs[i + 1]
          const newDay = !prev || prev.at.split('T')[0] !== m.at.split('T')[0]
          /* 같은 사람이 같은 분에 연달아 보낸 묶음의 마지막에만 시각을
             붙인다. 줄마다 붙이면 같은 시각이 세 번 나온다 */
          const tail =
            !nextMsg ||
            nextMsg.from !== m.from ||
            nextMsg.at.slice(0, 16) !== m.at.slice(0, 16)

          /* 단체방에서 남의 말풍선 묶음 첫 줄에만 이름을 붙인다.
             날이 바뀌면 다시 붙인다 — 어제 마지막으로 말한 사람을
             기억하고 있으라고 할 수 없다 */
          const head = !prev || prev.from !== m.from || newDay
          const label = group && m.from !== me && head ? nameOf(m.from) : undefined

          return (
            <div key={m.id}>
              {newDay && <ChatDay label={dayLabel(m.at)} />}
              <ChatBubble
                text={m.text}
                mine={m.from === me}
                time={clock(m.at)}
                tail={tail}
                who={label}
              />
            </div>
          )
        })}

        <div ref={endRef} />
      </div>

      {/* 입력칸은 화면 아래에 붙인다. 댓글과 다른 자리다 — 댓글은 읽는
          글의 끝이지만 채팅은 읽는 내내 쓰는 자리라 따라다녀야 한다 */}
      <div className="cwrite">
        {blocked ? (
          <p className="cwrite__gate">
            차단한 상대예요. 지난 대화는 남지만 새 메시지는 주고받지 않아요.
          </p>
        ) : (
          <>
            <textarea
              className="cwrite__box"
              rows={1}
              placeholder="메시지 보내기"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                /* Enter 는 줄바꿈이 아니라 전송이다. 짧은 말을 여러 번
                   보내는 자리라 매번 버튼까지 손을 옮기면 느리다.
                   줄을 바꾸고 싶으면 Shift 를 같이 누른다 */
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            {/* 크기를 지정하지 않는다. 기본 버튼이 입력칸과 같은
               --tap 높이라 나란히 섰을 때 밑선이 맞는다 */}
            <Button
              className="cwrite__send"
              disabled={!draft.trim() || draft.length > MAX}
              onClick={send}
            >
              전송
            </Button>
          </>
        )}
      </div>

      {/*
        단체방의 더보기는 사람을 먼저 고른다.

        1:1 이면 상대가 하나뿐이라 「신고」 가 곧 그 사람을 가리키는데,
        셋이 있는 방에서 같은 버튼을 누르면 누구를 신고하는지가 없다.
        사유를 고르는 화면까지 가서야 대상이 빠진 것을 알면 처음부터
        다시 해야 한다.
      */}
      {menu && group && (
        <Sheet
          title={`대화 상대 ${others.length}명`}
          desc="신고하거나 차단할 사람을 고르세요. 상대에게는 알리지 않아요."
          foot={
            <Button tone="ghost" onClick={() => setMenu(false)}>
              닫기
            </Button>
          }
        >
          <ul className="croom__people">
            {others.map((m) => (
              <li key={m.id} className="croom__person">
                <Avatar name={m.nickname} src={m.imageUrl ?? undefined} />
                <span className="croom__pname">
                  {m.nickname}
                  {/* 방장을 표시한다. 부른 사람이 누구인지 알아야
                      내보내기가 누구 권한인지 읽힌다 */}
                  {m.id === room.host?.id && <b className="croom__host">방장</b>}
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
                  <Button
                    size="sm"
                    tone="danger"
                    onClick={() => {
                      setMenu(false)
                      setWho(m)
                      setAsk('block')
                    }}
                  >
                    차단
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {menu && !group && (
        <Sheet
          title={`${room.partner.nickname} 님`}
          desc="신고와 차단은 상대에게 알리지 않아요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setMenu(false)}>
                닫기
              </Button>
              <Button
                tone="ghost"
                onClick={() => {
                  setMenu(false)
                  setWho(room.partner)
                  setAsk('report')
                }}
              >
                신고
              </Button>
              <Button
                tone="danger"
                onClick={() => {
                  setMenu(false)
                  setWho(room.partner)
                  setAsk('block')
                }}
              >
                차단
              </Button>
            </>
          }
        >
          <div className="croom__who">
            <Avatar name={room.partner.nickname} src={room.partner.imageUrl ?? undefined} lg />
            <Link className="croom__prof" href={wf(`/u/${room.partner.id}`)}>
              프로필 보기
            </Link>
          </div>
        </Sheet>
      )}

      {ask === 'report' && (
        <ReportSheet
          target="chat"
          targetId={who?.id}
          name={who?.nickname}
          onClose={() => {
            setAsk(null)
            setWho(null)
          }}
        />
      )}

      {ask === 'block' && (
        <Sheet
          title={`${who?.nickname ?? room.partner.nickname} 님을 차단할까요?`}
          /*
           * 단방향 선언이지만 효과는 양방향이다. 한쪽만 안 보이면
           * 차단한 사람이 일방적으로 관찰당하는 상태가 된다 (SF-03).
           *
           * 단체방에서는 방이 닫히지 않는다. 한 사람을 차단해도 남은
           * 사람들과의 대화는 이어지고, 차단한 사람의 말만 안 보인다.
           * 방을 통째로 막으면 한 명 때문에 약속 자체를 잃는다.
           */
          desc={
            group
              ? '이 사람의 글·댓글·메시지가 보이지 않게 됩니다. 방은 그대로 남고 남은 분들과는 계속 이야기할 수 있어요. 상대에게는 알리지 않고, 내 활동에서 되돌릴 수 있습니다.'
              : '서로의 글·댓글·채팅이 보이지 않게 됩니다. 지난 대화는 남고 새 메시지만 막혀요. 상대에게는 알리지 않고, 내 활동에서 되돌릴 수 있습니다.'
          }
          foot={
            <>
              <Button
                tone="ghost"
                onClick={() => {
                  setAsk(null)
                  setWho(null)
                }}
              >
                취소
              </Button>
              <Button
                tone="danger"
                onClick={() => {
                  /* 단체는 입력칸을 잠그지 않는다. 남은 사람과는 계속 쓴다 */
                  if (!group) setBlocked(true)
                  setAsk(null)
                  setWho(null)
                }}
              >
                차단
              </Button>
            </>
          }
        />
      )}
    </PageShell>
  )
}
