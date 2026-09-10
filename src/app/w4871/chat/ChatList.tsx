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
import { wf } from '@/lib/wireframe'
import { listTime, whenShort } from '@/lib/when'
import raw from '@/data/chat.sample.json'

/* 화면 상태를 눈으로 확인할 방법이 없어 개발용으로 바꿔본다.
   서버가 붙으면 이 막대를 지운다 */
const VIEWS = ['정상', '비었음'] as const

export default function ChatList() {
  const [view, setView] = useState<(typeof VIEWS)[number]>('정상')

  /* 목데이터 시각을 그대로 쓰면 "오늘" 판정이 배포 다음날 어긋난다.
     날짜는 useEffect 에서 확정하는 것이 규칙인데, 여기서는 목데이터의
     가장 최근 날짜를 오늘로 본다 — 서버가 붙으면 todayKey() 로 바꾼다 */
  const today = raw.rooms.reduce((a, r) => (r.lastAt > a ? r.lastAt : a), '').split('T')[0]

  /* 누군가를 차단한 방도 목록에 남는다. 차단은 그 사람의 말만 가리는
     것이지 방을 닫는 것이 아니다 — 한 명 때문에 약속을 잃게 하지 않는다 */
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

      {view === '비었음' && (
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
      )}

      {view === '정상' && (
        <ul className="clist">
          {rooms.map((r) => {
            /* 사람 이름을 못 쓴다. 방이 글 하나에 하나라 글 제목이 곧
               방 이름이다 */
            const others = r.members.filter((m) => m.id !== raw.me)
            /* 차단한 사람의 말은 미리보기에도 안 나온다. 방 안에서 가려
               놓고 목록에서만 보이면 가린 것이 아니다 */
            const blocked: string[] = r.blocked
            const last = r.messages.filter((m) => !blocked.includes(m.from)).at(-1)

            return (
            <li key={r.id}>
              <Link className="clist__row" href={wf(`/chat/${r.id}`)}>
                {/* 얼굴 하나로 대표할 수 없는 방이다. 방장 사진에
                    인원수를 얹어 「여럿」 인 것부터 읽히게 한다 */}
                <span className="clist__face">
                  <Avatar name={r.host.nickname} src={r.host.imageUrl ?? undefined} lg />
                  <span className="clist__n">{others.length + 1}</span>
                </span>

                <span className="clist__main">
                  <span className="clist__top">
                    <b className="clist__name">{r.postTitle}</b>
                    <span className="clist__when">{listTime(r.lastAt, today)}</span>
                  </span>

                  {/* 마지막 말이 누구 것인지까지 있어야 읽고 들어갈지
                      정할 수 있다 */}
                  <span className="clist__last">
                    {last &&
                      `${others.find((m) => m.id === last.from)?.nickname ?? '나'}: ${last.text}`}
                  </span>

                  {/* 언제 만나는 약속인지. 방 이름이 글 제목이라 여기에
                      제목을 또 적으면 같은 줄이 두 번 나온다 */}
                  <span className="clist__on">{whenShort(r.meetAt)} 약속</span>
                </span>

                {r.unread > 0 && <span className="clist__new">{r.unread}</span>}
              </Link>
            </li>
            )
          })}
        </ul>
      )}
    </PageShell>
  )
}
