'use client'

/**
 * 채팅방 목록 (CH-05 · CH-06).
 *
 * 알림이 없는 서비스라 **여기가 "누가 답했나" 를 아는 유일한 자리**다.
 * 내 활동 내역(AU-10)이 댓글에 대해 하던 일을 채팅에 대해서 한다.
 *
 * 정렬은 마지막 메시지 시각 내림차순 하나뿐이다. 안 읽은 것을 위로
 * 올리지 않는다 — 읽고 나면 방이 아래로 뛰어서 방금 본 대화를 다시
 * 찾게 된다.
 *
 * ─────────────────────────────────────────────────────────
 * **서버가 있으면 서버, 없으면 목데이터.**
 *
 * 서버 목록에는 아직 **마지막 메시지와 안 읽은 수가 안 온다** (CH-05 ·
 * CH-13 이 약속했지만 미구현 — chat.ts 머리말). 그래서 API 경로는 그 두
 * 줄이 비고, 정렬도 약속 시각 순이다. 목데이터는 두 줄을 그린 채 두어
 * 서버가 채웠을 때의 모양을 팀이 볼 수 있게 한다.
 *
 * 폴링은 안 한다. 안 읽은 수가 안 오는 목록을 30초마다 다시 받아도
 * 바뀌는 것이 없다. 그 수가 오면 30초 폴링을 건다 — 방 안의 5초를
 * 여기까지 가져오면 요청이 여섯 배가 된다.
 */
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Blank, Button } from '@/components/ui/Basics'
import { wf } from '@/lib/wireframe'
import { listTime, whenShort } from '@/lib/when'
import { USE_API } from '@/lib/api/config'
import { ApiFailure } from '@/lib/api/http'
import { fetchRooms, type ChatRoomSummary } from '@/lib/api/chat'
import { authed } from '@/lib/auth/authed'
import raw from '@/data/chat.sample.json'

/** 한 줄. 목데이터와 서버가 같은 모양으로 온다 */
type Row = {
  id: string
  title: string
  /** 대표 얼굴. 서버 목록에는 방장이 안 와서 글 제목 첫 글자로 선다 */
  face: { name: string; imageUrl: string | null }
  count: number
  meetAt: string
  /** 없으면 줄을 비운다 */
  last: string | null
  lastAt: string | null
  unread: number
}

function Empty() {
  return (
    <Blank
      title="아직 나눈 대화가 없어요"
      desc="모집글에 댓글을 남기면 방장이 채팅방으로 부릅니다"
      /* Button 은 button 이라 이동에 못 쓴다. 404 와 같이 클래스만 빌린다 */
      action={
        <Link className="btn btn--primary btn--sm" href={wf('/p')}>
          모집글 보러 가기
        </Link>
      }
    />
  )
}

function Rows({ rows, today }: { rows: Row[]; today: string }) {
  return (
    <ul className="clist">
      {rows.map((r) => (
        <li key={r.id}>
          <Link className="clist__row" href={wf(`/chat/${r.id}`)}>
            {/* 얼굴 하나로 대표할 수 없는 방이다. 사진에 인원수를 얹어
                「여럿」 인 것부터 읽히게 한다 */}
            <span className="clist__face">
              <Avatar name={r.face.name} src={r.face.imageUrl ?? undefined} lg />
              <span className="clist__n">{r.count}</span>
            </span>

            <span className="clist__main">
              <span className="clist__top">
                {/* 사람 이름을 못 쓴다. 방이 글 하나에 하나라 글 제목이 곧
                    방 이름이다 */}
                <b className="clist__name">{r.title}</b>
                {r.lastAt && <span className="clist__when">{listTime(r.lastAt, today)}</span>}
              </span>

              {/* 마지막 말이 누구 것인지까지 있어야 읽고 들어갈지 정할 수
                  있다. 서버가 아직 안 줘서 API 경로는 빈 줄이다 */}
              {r.last && <span className="clist__last">{r.last}</span>}

              {/* 언제 만나는 약속인지. 방 이름이 글 제목이라 여기에 제목을
                  또 적으면 같은 줄이 두 번 나온다 */}
              <span className="clist__on">{whenShort(r.meetAt)} 약속</span>
            </span>

            {r.unread > 0 && <span className="clist__new">{r.unread}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/* ── 서버 ─────────────────────────────────────────────── */

function toRow(r: ChatRoomSummary): Row {
  return {
    id: r.roomId,
    title: r.postTitle,
    face: { name: r.postTitle, imageUrl: null },
    count: r.memberCount,
    meetAt: r.meetAt,
    last: null,
    lastAt: null,
    unread: 0,
  }
}

function ApiList() {
  const [rows, setRows] = useState<Row[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'guest' | 'sanction' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    authed((token) => fetchRooms(token))
      .then((rooms) => {
        if (!alive) return
        /* 마지막 메시지 시각이 안 와서 약속이 가까운 것부터. 오면 그 시각으로 바꾼다 */
        setRows(rooms.map(toRow).sort((a, b) => a.meetAt.localeCompare(b.meetAt)))
        setState('ready')
      })
      .catch((e: unknown) => {
        if (!alive) return
        if (e instanceof ApiFailure && e.code === 'NOT_SIGNED_IN') return setState('guest')
        if (e instanceof ApiFailure && e.code === 'USER_SANCTIONED') return setState('sanction')
        setState('error')
      })
    return () => {
      alive = false
    }
  }, [])

  let body: ReactNode
  if (state === 'loading') body = <p className="croom__state">불러오는 중…</p>
  else if (state === 'guest')
    body = (
      <Blank
        title="로그인하면 대화를 볼 수 있어요"
        desc="모집글에 댓글을 남기면 방장이 채팅방으로 부릅니다"
        action={
          <Link className="btn btn--primary btn--sm" href={wf('/login')}>
            로그인
          </Link>
        }
      />
    )
  else if (state === 'sanction')
    body = <Blank title="제재 중에는 채팅을 볼 수 없어요" desc="내 활동에서 사유를 확인할 수 있어요" />
  else if (state === 'error')
    body = (
      <Blank
        title="대화 목록을 불러오지 못했어요"
        desc="연결이 불안정해요. 잠시 뒤 다시 열어주세요"
        action={
          <Button size="sm" tone="ghost" onClick={() => location.reload()}>
            다시 시도
          </Button>
        }
      />
    )
  else body = rows.length === 0 ? <Empty /> : <Rows rows={rows} today="" />

  return <PageShell title="채팅">{body}</PageShell>
}

/* ── 목데이터 ─────────────────────────────────────────── */

/* 화면 상태를 눈으로 확인할 방법이 없어 개발용으로 바꿔본다.
   서버가 붙은 경로에는 이 막대가 없다 */
const VIEWS = ['정상', '비었음'] as const

function MockList() {
  const [view, setView] = useState<(typeof VIEWS)[number]>('정상')

  /* 목데이터 시각을 그대로 쓰면 "오늘" 판정이 배포 다음날 어긋난다.
     날짜는 useEffect 에서 확정하는 것이 규칙인데, 여기서는 목데이터의
     가장 최근 날짜를 오늘로 본다 */
  const today = raw.rooms.reduce((a, r) => (r.lastAt > a ? r.lastAt : a), '').split('T')[0]

  const rows: Row[] = raw.rooms.map((r) => {
    const others = r.members.filter((m) => m.id !== raw.me)
    const last = r.messages.at(-1)
    return {
      id: r.id,
      title: r.postTitle,
      face: { name: r.host.nickname, imageUrl: r.host.imageUrl },
      count: others.length + 1,
      meetAt: r.meetAt,
      last: last ? `${others.find((m) => m.id === last.from)?.nickname ?? '나'}: ${last.text}` : null,
      lastAt: r.lastAt,
      unread: r.unread,
    }
  })

  return (
    <PageShell title="채팅">
      <div className="whoami">
        <b>화면</b>
        {VIEWS.map((v) => (
          <button key={v} aria-pressed={v === view} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>

      {view === '비었음' ? <Empty /> : <Rows rows={rows} today={today} />}
    </PageShell>
  )
}

export default function ChatList() {
  return USE_API ? <ApiList /> : <MockList />
}
