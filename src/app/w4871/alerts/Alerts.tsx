'use client'

/**
 * 알림 목록 (S3).
 *
 * ─────────────────────────────────────────────────────────
 * **푸시가 아니다.**
 *
 * 이름만 보면 앱을 닫아도 소리가 울릴 것 같지만 그렇지 않다. 웹이라
 * 브라우저를 닫으면 아무것도 오지 않고, iOS 는 홈 화면에 추가해야
 * 웹 푸시를 받을 수 있다. 여기 있는 것은 **들어와서 보는 목록**이다.
 *
 * 그래서 이 화면보다 **배지가 먼저 일한다.** 목록은 배지를 누른 사람에게
 * 무엇이 왔는지 알려주는 자리일 뿐이고, 들어올 이유를 만드는 것은 숫자다.
 * 배지를 하단 탭에 다는 일이 1차 화면을 건드려서 이 브랜치에 없다 —
 * 그것 없이는 이 화면이 반쪽이다.
 *
 * ─────────────────────────────────────────────────────────
 * **묶는다.**
 *
 * 같은 방, 같은 글에서 온 것은 한 줄로 접고 개수만 센다. 안 묶으면 한
 * 사람이 메시지 다섯 개를 보냈을 때 목록이 그 사람으로 도배되고, 그 아래
 * 깔린 신고 결과나 제재를 못 본다. 묶는 축은 **누가 아니라 어디서**다 —
 * 한 방에서 둘이 주고받아도 방 하나다.
 *
 * ─────────────────────────────────────────────────────────
 * **정렬은 시각 하나다.**
 *
 * 안 읽은 것을 위로 올리지 않는다. 읽고 나면 줄이 아래로 뛰어서 방금 본
 * 것을 다시 찾게 된다. 채팅방 목록(CH-05)과 같은 판단이다.
 *
 * **보였다고 읽음이 되지 않는다.** 눌러야 읽음이다. 화면에 스치기만 해도
 * 지워지면 스크롤로 지나친 것이 사라지고, 그건 알림을 못 믿게 만든다.
 *
 * 서버가 아직 없다. 목데이터를 읽는다.
 */
import type { ReactNode } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Blank, Button } from '@/components/ui/Basics'
import { listTime } from '@/lib/when'
import { wf } from '@/lib/wireframe'
import { USE_API } from '@/lib/api/config'

/**
 * 알림 종류.
 *
 * 앞 셋은 **사람이 일으킨 것**이라 아바타가 붙고, 뒤 셋은 사람이 없어서
 * 아이콘이 그 자리에 선다. 제재를 보낸 관리자의 얼굴을 띄울 수는 없다.
 */
type ByPerson = 'CHAT' | 'COMMENT' | 'REPLY'
type BySystem = 'CLOSED' | 'REPORT' | 'SANCTION'
type Kind = ByPerson | BySystem

type Alert = {
  id: string
  /** 상대가 있는 것은 `actor` 가 같이 온다. 타입으로 둘을 묶어 둔다 */
  kind: Kind
  actor: { nickname: string; imageUrl: string | null } | null
  /** 무슨 일이 있었나. 한 줄로 끝나야 한다 */
  text: string
  /** 어느 글·어느 방인가. 상대를 여럿 만나면 이것 없이는 못 고른다 */
  on: string
  /** 눌러서 가는 곳. 갈 곳이 없으면 null 이고 줄이 링크가 되지 않는다 */
  href: string | null
  /** 묶인 개수. 1 이면 안 그린다 — 「1개」 는 아무것도 안 알려준다 */
  count: number
  /** 'YYYY-MM-DDTHH:mm' */
  at: string
  read: boolean
}

const MOCK: Alert[] = [
  {
    id: 'n1',
    kind: 'CHAT',
    actor: { nickname: '덕질하는오리', imageUrl: '/avatar/a1.webp' },
    text: '덕질하는오리 님이 메시지를 보냈어요',
    on: '에이티즈 팝업 오픈런 같이 하실 분',
    href: wf('/chat/r1'),
    count: 2,
    at: '2026-09-09T21:40',
    read: false,
  },
  {
    id: 'n2',
    kind: 'COMMENT',
    actor: { nickname: '조용한덕후', imageUrl: null },
    text: '조용한덕후 님이 내 모집글에 댓글을 남겼어요',
    on: '성수 토리든 팝업 평일 낮에 가실 분',
    href: wf('/p/p2'),
    count: 1,
    at: '2026-09-09T18:22',
    read: false,
  },
  {
    id: 'n3',
    kind: 'REPLY',
    actor: { nickname: '밤샘예매', imageUrl: '/avatar/a3.webp' },
    text: '밤샘예매 님이 내 댓글에 답했어요',
    on: '원위 팝업 첫날 같이 가요',
    href: wf('/p/p4'),
    count: 1,
    at: '2026-09-08T23:10',
    read: true,
  },
  {
    /* PO-14. 방장이 닫은 것이 아니라 시간이 지나 닫힌 것이라, 방장은
       자기가 안 한 일을 알림으로만 안다 */
    id: 'n4',
    kind: 'CLOSED',
    actor: null,
    text: '만남 시간이 지나 모집이 닫혔어요',
    on: '성수 토리든 팝업 평일 낮에 가실 분',
    href: wf('/p/p2'),
    count: 1,
    at: '2026-09-03T15:00',
    read: true,
  },
  {
    /*
     * **무엇을 했는지 말하지 않는다.** 처리 결과는 셋이지만
     * (NO_ACTION · COMMENT_BLINDED · USER_SANCTIONED) 신고자에게는
     * 「확인했다」 까지만 간다. 상대를 제재했는지 알려주면 신고가 보복
     * 여부를 확인하는 도구가 된다. 신고를 상대에게 안 알리는 것과 같은
     * 이유다.
     */
    id: 'n5',
    kind: 'REPORT',
    actor: null,
    text: '신고해주신 내용을 확인했어요',
    on: '처리 결과는 따로 알려드리지 않아요',
    href: null,
    count: 1,
    at: '2026-09-02T11:05',
    read: true,
  },
  {
    /* AD-04. 사유는 배너가 진다. 여기는 「왔다」 만 알리고 배너로 보낸다 */
    id: 'n6',
    kind: 'SANCTION',
    actor: null,
    text: '경고를 받았어요',
    on: '내 활동에서 사유를 볼 수 있어요',
    href: wf('/me'),
    count: 1,
    at: '2026-08-30T09:12',
    read: true,
  },
]

/* ── 아이콘 ───────────────────────────────────────────────
   이모지를 쓰지 않는다. 기기마다 모양이 달라 여섯 줄의 톤이
   제각각이 된다 (SanctionNotice 와 같은 규칙).

   **두 벌이다.** 아이콘 원은 48px 이라 선으로 그려도 읽히지만,
   아바타에 걸치는 뱃지는 11px 이다. 그 크기에서 선 그림은 전부 같은
   동그라미로 뭉개진다 — 한 벌로 두었더니 채팅과 댓글이 눈으로 안
   갈렸다. 작은 쪽은 면으로 채우고 실루엣을 확실히 벌린다.
   ------------------------------------------------------- */

/** 아바타에 걸치는 뱃지 (11px). 면으로 채운다 */
const PIP: Record<ByPerson, ReactNode> = {
  /* 꼬리 달린 말풍선 */
  CHAT: <path d="M3.4 4.2h13.2v8.4H8.8L5.2 16.2v-3.6H3.4z" />,
  /*
   * 펜. 댓글에도 말풍선을 쓰면 이 크기에서 채팅과 실루엣이 같아진다.
   * 「말했다」 가 아니라 「남겼다」 쪽으로 그림을 옮긴다.
   */
  COMMENT: (
    <path d="M3.6 16.4l1.1-3.6 7.7-7.7 2.5 2.5-7.7 7.7zM13.3 4.1l1.4-1.4 2.5 2.5-1.4 1.4z" />
  ),
  /* 꺾여 돌아오는 화살표. 답글은 「내 것에 붙은 것」 이라 방향이 있다 */
  REPLY: <path d="M8.6 4.4L2.8 9.6l5.8 5.2v-3.1c3.4-.1 5.9 1 7.6 3.4.2-5.2-2.4-8.2-7.6-8.6z" />,
}

/** 사람이 없는 알림의 아이콘 원 (22px). 선으로 그린다 */
const MARK: Record<BySystem, ReactNode> = {
  /* 시계. 시간이 지나서 닫혔다는 것이 요점이다 */
  CLOSED: (
    <>
      <circle cx="10" cy="10" r="6.4" />
      <path d="M10 6.3V10l2.6 1.6" />
    </>
  ),
  /* 방패. 깃발로 그리면 신고를 「하는」 그림이 되는데 이건 처리 결과다 */
  REPORT: <path d="M10 3.7l5.2 1.9v4.2c0 3-2.1 5.4-5.2 6.6-3.1-1.2-5.2-3.6-5.2-6.6V5.6z" />,
  /* 느낌표 */
  SANCTION: (
    <>
      <circle cx="10" cy="10" r="6.6" />
      <path d="M10 6.5v4.2" />
      <path d="M10 13.4h.01" />
    </>
  ),
}

function byPerson(k: Kind): k is ByPerson {
  return k === 'CHAT' || k === 'COMMENT' || k === 'REPLY'
}

/**
 * 줄 앞머리.
 *
 * 사람이 일으킨 것은 아바타가 서고 종류는 오른쪽 아래 작은 원으로 붙는다.
 * 종류를 아이콘 하나로만 두면 여섯 줄에 비슷한 동그라미가 늘어서서 누가
 * 한 일인지가 안 읽힌다 — 알림에서 먼저 궁금한 것은 「무슨 종류」 가
 * 아니라 「누가」 다.
 *
 * 지름은 둘 다 48px 이다. 다르면 왼쪽 선이 줄마다 흔들린다.
 */
function Face({ a }: { a: Alert }) {
  if (byPerson(a.kind)) {
    return (
      <span className="alr__face">
        <Avatar name={a.actor?.nickname ?? ''} src={a.actor?.imageUrl ?? undefined} lg />
        <span className="alr__pipwrap">
          <svg
            className="alr__pip"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
            focusable="false"
          >
            {PIP[a.kind]}
          </svg>
        </span>
      </span>
    )
  }
  return (
    <span className={`alr__icon alr__icon--${a.kind.toLowerCase()}`}>
      <svg
        className="alr__mark"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable="false"
      >
        {MARK[a.kind]}
      </svg>
    </span>
  )
}

/* 화면 상태를 눈으로 확인할 방법이 없어 개발용으로 바꿔본다.
   서버가 붙으면 이 막대를 지운다 */
const VIEWS = ['정상', '비었음'] as const

export default function Alerts() {
  const [view, setView] = useState<(typeof VIEWS)[number]>('정상')
  const [list, setList] = useState(MOCK)

  /*
   * **서버에 알림이 없으면 목데이터를 보여주지 않는다.**
   *
   * 이 화면은 2차 몫이라 아직 받아올 곳이 없다. 그런데 내 활동에서
   * 들어오는 자리라, 실서비스에서 열면 「덕질하는오리 님이 메시지를
   * 보냈어요」 같은 가짜 알림을 진짜로 읽게 된다. 있지도 않은 채팅
   * 이야기라 더 나쁘다.
   *
   * 화면을 지우지는 않는다. 자리를 비워두면 알림이 없는 줄 알고 찾아
   * 헤매고, 팀은 목데이터로 이 화면을 계속 봐야 한다.
   */
  if (USE_API) {
    return (
      <PageShell title="알림">
        <Blank
          title="알림은 준비 중이에요"
          desc="댓글과 답글이 오면 여기로 모을 예정이에요. 지금은 내 활동에서 확인할 수 있어요"
          action={
            <Link className="btn btn--ghost btn--sm" href={wf('/me')}>
              내 활동 보기
            </Link>
          }
        />
      </PageShell>
    )
  }

  /* 목데이터 시각을 그대로 쓰면 「오늘」 판정이 배포 다음날 어긋난다.
     렌더 중에 new Date() 를 부르지 않는 것이 규칙이라(CLAUDE.md) 여기서는
     목데이터의 가장 최근 날짜를 오늘로 본다 — 서버가 붙으면 useEffect
     에서 확정한다 */
  const today = list.reduce((a, n) => (n.at > a ? n.at : a), '').split('T')[0]

  const rows = view === '비었음' ? [] : list
  /* 비었음 화면에서도 헤더에 「전부 읽음」 이 남아 있었다. 개발용 막대
     때문에 생긴 어긋남이지만, 팀이 보는 것은 그 화면이다 */
  const unread = rows.filter((n) => !n.read).length

  const read = (id: string) => setList((v) => v.map((n) => (n.id === id ? { ...n, read: true } : n)))
  const readAll = () => setList((v) => v.map((n) => ({ ...n, read: true })))

  return (
    <PageShell
      title="알림"
      right={
        /* 안 읽은 것이 없으면 안 그린다. 눌러도 아무 일이 없는 버튼이
           헤더에 늘 서 있으면 그 자리를 안 믿게 된다 */
        unread > 0 ? (
          <Button size="sm" tone="ghost" onClick={readAll}>
            전부 읽음
          </Button>
        ) : undefined
      }
    >
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
          title="아직 알림이 없어요"
          desc="댓글과 메시지가 오면 여기에 모입니다"
          action={
            /* Button 은 button 이라 이동에 못 쓴다. 404 와 같이 클래스만 빌린다 */
            <Link className="btn btn--primary btn--sm" href={wf('/p')}>
              모집글 보러 가기
            </Link>
          }
        />
      ) : (
        <>
          {/* 푸시가 아니라는 것을 목록 위에 한 줄로 둔다. 「알림」 이라고
              적힌 화면이 있으면 켜 두면 오는 줄 알고 기다리는 사람이 생긴다 */}
          <p className="alr__lead">앱을 닫으면 오지 않아요. 들어와서 확인하는 목록입니다.</p>

          <ul className="alr">
            {rows.map((n) => {
              const body = (
                <>
                  <Face a={n} />

                  <span className="alr__main">
                    <span className="alr__top">
                      <b className="alr__text">{n.text}</b>
                      {/* 묶인 개수는 문장 옆이다. 오른쪽 끝에 두면 안 읽음
                          점과 자리를 다투고 둘 다 같은 표시로 읽힌다 */}
                      {n.count > 1 && <span className="alr__count">{n.count}</span>}
                    </span>
                    <span className="alr__on">{n.on}</span>
                    <span className="alr__when">{listTime(n.at, today)}</span>
                  </span>

                  {!n.read && <span className="alr__dot" aria-label="안 읽음" />}
                </>
              )

              const cls = `alr__row${n.read ? '' : ' alr__row--new'}`

              /* 갈 곳이 없는 알림(신고 결과)은 링크로 두지 않는다. 눌러서
                 제자리면 「눌리는 것 같은데 안 눌린다」 로 읽힌다 */
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link className={cls} href={n.href} onClick={() => read(n.id)}>
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={`${cls} alr__row--flat`}
                      onClick={() => read(n.id)}
                    >
                      {body}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          {/* 서버가 지운다. 안 적어두면 지난달 것을 찾다가 「알림이
              사라졌다」 로 문의가 들어온다 */}
          <p className="alr__foot">알림은 30일이 지나면 사라져요</p>
        </>
      )}
    </PageShell>
  )
}
