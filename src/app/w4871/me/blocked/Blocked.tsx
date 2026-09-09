'use client'

/**
 * 차단 목록 (SF-06 · SF-04).
 *
 * **차단은 상대에게 알리지 않는다.** 알리면 보복이 오고, 그러면 아무도
 * 차단하지 않는다. 신고를 알리지 않는 것과 같은 이유다.
 *
 * 알리지 않는 대신 되돌리는 자리가 있어야 한다. 그게 여기 하나뿐이라,
 * 내 활동에서 한 번에 닿아야 한다.
 *
 * 차단 사유를 받지 않는다. 받아도 쓸 데가 없고, 사유를 고르게 하면
 * 차단이 신고처럼 느껴져 문턱이 생긴다. 문제가 되는 사람은 신고로
 * 따로 접수된다.
 *
 * 서버가 아직 없다. 목데이터를 읽는다.
 */
import { useState } from 'react'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Blank, Button, Sheet } from '@/components/ui/Basics'

type Blockee = {
  id: string
  nickname: string
  imageUrl: string | null
  /** 'YYYY-MM-DD' */
  at: string
}

const MOCK: Blockee[] = [
  { id: 'u_night', nickname: '밤샘예매', imageUrl: '/avatar/a3.webp', at: '2026-08-28' },
  { id: 'u_ad', nickname: '광고봇계정', imageUrl: null, at: '2026-08-21' },
]

/** '2026-08-28' → '8월 28일' */
function dateText(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

const VIEWS = ['정상', '비었음'] as const

export default function Blocked() {
  const [view, setView] = useState<(typeof VIEWS)[number]>('정상')
  const [list, setList] = useState(MOCK)
  const [ask, setAsk] = useState<Blockee | null>(null)

  const unblock = (u: Blockee) => {
    /* API 자리. DELETE /api/v1/users/me/blocks/{userId} */
    setList((v) => v.filter((x) => x.id !== u.id))
    setAsk(null)
  }

  const rows = view === '비었음' ? [] : list

  return (
    <PageShell title="차단 목록">
      <div className="whoami">
        <b>화면</b>
        {VIEWS.map((v) => (
          <button key={v} aria-pressed={v === view} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Blank
          title="차단한 사람이 없어요"
          desc="채팅이나 프로필에서 차단할 수 있어요"
        />
      ) : (
        <>
          {/* 차단이 무엇을 하는지 목록 위에 한 줄로 둔다. 되돌리러 온
              사람이 「내가 뭘 막아둔 거였지」 를 여기서 알게 된다 */}
          <p className="blk__lead">
            서로의 글·댓글·채팅이 보이지 않습니다. 상대에게는 알리지 않아요.
          </p>

          <ul className="blk">
            {list.map((u) => (
              <li key={u.id} className="blk__row">
                <Avatar name={u.nickname} src={u.imageUrl ?? undefined} lg />
                <span className="blk__main">
                  <b className="blk__name">{u.nickname}</b>
                  <span className="blk__when">{dateText(u.at)}부터</span>
                </span>
                <Button size="sm" tone="ghost" onClick={() => setAsk(u)}>
                  차단 해제
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {ask && (
        <Sheet
          title={`${ask.nickname} 님의 차단을 풀까요?`}
          desc="서로의 글과 댓글이 다시 보이고, 지난 채팅방에서 새 메시지를 주고받을 수 있게 됩니다."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>
                취소
              </Button>
              <Button onClick={() => unblock(ask)}>차단 해제</Button>
            </>
          }
        />
      )}
    </PageShell>
  )
}
