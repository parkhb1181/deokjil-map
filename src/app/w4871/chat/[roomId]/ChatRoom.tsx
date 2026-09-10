'use client'

/**
 * 채팅방 (CH-02 ~ CH-04 · CH-09 · CH-10 · SF-03 · SF-08).
 *
 * 1차의 비밀 댓글이 하던 일을 대신한다. 지금은 사람들이 비밀 댓글에
 * 카톡 아이디와 전화번호를 **평문으로** 적고 그것이 우리 DB 에 쌓인다.
 * 이 화면이 그 자리를 없애는 것이 목적이다.
 *
 * **방은 한 가지다.** 글 하나에 방 하나이고, 방장이 댓글 단 사람 중에서
 * 골라 부른다 (CH-01). 모집 정원(PO-02)이 곧 방 인원이 된다. 승인·수락
 * 절차를 따로 만들지 않은 자리를 이 초대가 대신한다 — 방장만 누르므로
 * 절차가 한 번에 끝난다.
 *
 * 둘만 있는 방도 같은 화면이다. 1:1 을 따로 두지 않는다 — 갈라 두면
 * 제목·말풍선 이름·신고 대상이 전부 두 벌이 되는데, 정작 둘뿐인 방은
 * 사람이 하나 적을 뿐 나머지가 같다.
 *
 * 신고·차단은 **누구를** 인지 먼저 고른다. 여럿이 있는 방에서 「신고」
 * 하나만 있으면 대상이 없다.
 *
 * 차단해도 방은 닫히지 않는다. 그 사람의 말만 가려지고 남은 사람과의
 * 대화는 이어진다 — 방을 통째로 막으면 한 명 때문에 약속을 잃는다.
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

/** 사람 하나 */
type Member = { id: string; nickname: string; imageUrl?: string | null }

export default function ChatRoom({ roomId }: { roomId: string }) {
  const room = raw.rooms.find((r) => r.id === roomId) ?? raw.rooms[0]
  const me = raw.me

  /* 나를 뺀 사람들. 신고·차단은 나에게 할 수 없다 */
  const others: Member[] = room.members.filter((m) => m.id !== me)
  const nameOf = (id: string) => others.find((m) => m.id === id)?.nickname ?? id

  const [msgs, setMsgs] = useState<ChatMessage[]>(room.messages)
  const [draft, setDraft] = useState('')
  /**
   * 내가 차단한 사람.
   *
   * 방이 닫히는 것이 아니라 이 사람들의 말만 가려진다 (SF-03). 목데이터에
   * 미리 넣어둔 값으로 시작한다 — 차단해 둔 방이 어떻게 보이는지 직접
   * 눌러보지 않고도 확인할 수 있어야 한다.
   */
  const [hidden, setHidden] = useState<string[]>(room.blocked)
  const [first, setFirst] = useState(msgs.length === 0)
  const [ask, setAsk] = useState<null | 'report' | 'block'>(null)
  const [menu, setMenu] = useState(false)
  /** 신고·차단 대상. 더보기에서 **누구인지 먼저 고르고** 그다음으로 간다 */
  const [who, setWho] = useState<Member | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  /* 차단한 사람의 말은 지우는 것이 아니라 가린다. 신고가 들어왔을 때
     판단할 재료라서 원본은 남아 있어야 한다 */
  const shown = msgs.filter((m) => !hidden.includes(m.from))

  /* 들어오면 맨 아래다. 채팅은 마지막 줄이 지금이라 위에서 시작하면
     매번 끝까지 내려야 한다 */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [shown.length])

  const send = () => {
    const text = draft.trim()
    if (!text || text.length > MAX) return
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
      /* 사람 이름을 못 쓴다. 글 제목이 곧 방 이름이다 — 방이 글 하나에
         하나라서 그것이 가장 짧게 구분된다 */
      title={room.postTitle}
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

        {/* 대화가 비어 보이는 이유를 방 안에 적어 둔다. 없으면 남의 말이
            중간부터 시작하는 것처럼 읽힌다 */}
        {hidden.length > 0 && (
          <p className="croom__hid">
            차단한 {hidden.length}명의 메시지는 보이지 않아요. 내 활동의 차단 목록에서 되돌릴
            수 있어요.
          </p>
        )}

        {shown.map((m, i) => {
          const prev = shown[i - 1]
          const nextMsg = shown[i + 1]
          const newDay = !prev || prev.at.split('T')[0] !== m.at.split('T')[0]
          /* 같은 사람이 같은 분에 연달아 보낸 묶음의 마지막에만 시각을
             붙인다. 줄마다 붙이면 같은 시각이 세 번 나온다 */
          const tail =
            !nextMsg ||
            nextMsg.from !== m.from ||
            nextMsg.at.slice(0, 16) !== m.at.slice(0, 16)

          /* 남의 말풍선 묶음 첫 줄에만 이름을 붙인다. 날이 바뀌면 다시
             붙인다 — 어제 마지막으로 말한 사람을 기억하고 있으라고 할
             수 없다 */
          const head = !prev || prev.from !== m.from || newDay
          const label = m.from !== me && head ? nameOf(m.from) : undefined

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
      </div>

      {/*
        더보기는 사람을 먼저 고른다.

        「신고」 하나만 두면 셋이 있는 방에서 누구를 신고하는지가 없다.
        사유를 고르는 화면까지 가서야 대상이 빠진 것을 알면 처음부터
        다시 해야 한다.
      */}
      {menu && (
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
                  {m.id === room.host.id && <b className="croom__host">방장</b>}
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
                  {/* 이미 차단한 사람에게 또 걸 것이 없다. 푸는 자리는
                      차단 목록 하나뿐이라 여기서는 상태만 적는다 */}
                  {hidden.includes(m.id) ? (
                    <b className="croom__off">차단함</b>
                  ) : (
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
                  )}
                </span>
              </li>
            ))}
          </ul>
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
          title={`${who?.nickname} 님을 차단할까요?`}
          /*
           * 단방향 선언이지만 효과는 양방향이다. 한쪽만 안 보이면
           * 차단한 사람이 일방적으로 관찰당하는 상태가 된다 (SF-03).
           *
           * 방은 닫히지 않는다. 한 사람을 차단해도 남은 사람들과의
           * 대화는 이어지고, 차단한 사람의 말만 안 보인다. 방을 통째로
           * 막으면 한 명 때문에 약속 자체를 잃는다.
           */
          desc="이 사람의 글·댓글·메시지가 보이지 않게 됩니다. 방은 그대로 남고 남은 분들과는 계속 이야기할 수 있어요. 상대에게는 알리지 않고, 내 활동에서 되돌릴 수 있습니다."
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
                  /* API 자리. POST /api/v1/blocks { targetUserId }
                     지금은 이 방에서만 가린다 */
                  if (who) setHidden((v) => [...v, who.id])
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
