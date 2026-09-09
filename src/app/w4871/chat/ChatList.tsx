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
 * 폴링은 30초다 (CH-04). 방 안의 5초를 여기까지 가져오면 안 읽음 수
 * 하나 때문에 요청이 여섯 배가 된다.
 *
 * 서버가 아직 없다. 목데이터를 읽는다.
 */
import { useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Avatar, Blank } from '@/components/ui/Basics'
import { VerifyGate } from '@/components/ui/Chat'
import { wf } from '@/lib/wireframe'
import { listTime } from '@/lib/when'
import raw from '@/data/chat.sample.json'

/* 화면 상태를 눈으로 확인할 방법이 없어 개발용으로 바꿔본다.
   인증이 붙으면 이 막대를 지운다 */
const VIEWS = ['정상', '비었음', '미인증'] as const

export default function ChatList() {
  const [view, setView] = useState<(typeof VIEWS)[number]>('정상')

  /* 목데이터 시각을 그대로 쓰면 "오늘" 판정이 배포 다음날 어긋난다.
     날짜는 useEffect 에서 확정하는 것이 규칙인데, 여기서는 목데이터의
     가장 최근 날짜를 오늘로 본다 — 서버가 붙으면 todayKey() 로 바꾼다 */
  const today = raw.rooms.reduce((a, r) => (r.lastAt > a ? r.lastAt : a), '').split('T')[0]

  /* 차단한 방도 목록에 남는다. 지우면 지난 대화가 사라지고, 그건
     신고가 들어왔을 때 판단할 재료를 없애는 일이다 */
  const rooms = raw.rooms

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

      {view === '미인증' && <VerifyGate next={wf('/chat')} />}

      {view === '비었음' && (
        <Blank
          title="아직 나눈 대화가 없어요"
          desc="모집글 댓글에서 채팅을 걸 수 있어요"
          /* Button 은 button 이라 이동에 못 쓴다. 404 와 같이 클래스만 빌린다 */
          action={
            <Link className="btn btn--primary btn--sm" href={wf('/p')}>
              모집글 보러 가기
            </Link>
          }
        />
      )}

      {view === '정상' && (
        <ul className="clist">
          {rooms.map((r) => (
            <li key={r.id}>
              <Link className="clist__row" href={wf(`/chat/${r.id}`)}>
                <Avatar name={r.partner.nickname} src={r.partner.imageUrl ?? undefined} lg />

                <span className="clist__main">
                  <span className="clist__top">
                    <b className="clist__name">{r.partner.nickname}</b>
                    <span className="clist__when">{listTime(r.lastAt, today)}</span>
                  </span>

                  <span className="clist__last">
                    {r.status === 'BLOCKED'
                      ? '차단한 상대예요'
                      : (r.messages.at(-1)?.text ?? '')}
                  </span>

                  {/* 어느 모집글에서 만난 사람인지. 상대를 여럿 만나면
                      닉네임만으로는 어느 약속인지 알 수 없다 */}
                  <span className="clist__on">{r.postTitle}</span>
                </span>

                {r.unread > 0 && <span className="clist__new">{r.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
