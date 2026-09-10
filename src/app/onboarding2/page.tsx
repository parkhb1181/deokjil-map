import type { Metadata } from 'next'
import Link from 'next/link'
import { wf } from '@/lib/wireframe'

/**
 * 2차 온보딩 색인.
 *
 * `/onboarding` 과 같은 이유로 있다. 와이어프레임 주소를 `/w4871`
 * 아래로 일부러 숨겨 뒀고 실서비스에서 이어지는 링크가 없어서,
 * 색인이 없으면 아무도 화면을 못 찾는다.
 *
 * **1차와 섞지 않고 따로 둔다.** 1차 화면은 이미 팀이 보고 지나간
 * 것이고, 2차는 아직 아무도 안 본 것이다. 한 페이지에 스물세 개를
 * 늘어놓으면 무엇이 새로 온 것인지 눈으로 못 고른다.
 *
 * 사진은 scripts/screen-shots.mjs 가 찍는다. 화면을 고치면 다시 돌린다.
 */
export const metadata: Metadata = {
  title: '2차 화면 목록 · 덕모임',
  robots: { index: false, follow: false },
}

type Row = {
  href: string
  name: string
  /** public/shots/<shot>.webp */
  shot: string
  /** SPEC-S3.md 의 요구사항 ID */
  spec: string
  /** 사진만 봐서는 모를 것만 적는다 */
  desc?: string
  data: '목데이터' | '화면만'
}

const NEW: Row[] = [
  {
    /* 흐름의 시작점이라 맨 앞에 둔다. 1차 화면이지만 여기서 채팅이
       열리므로, 이 줄이 없으면 나머지 넷이 어디서 오는지 알 수 없다 */
    href: wf('/p/p1'),
    name: '모집글 상세 — 채팅 입구',
    shot: 'post-chat',
    spec: 'CH-01',
    desc:
      '방장으로 보면 댓글마다 「초대」가 붙고, 눌러 보면 방까지 이어집니다. 위 토글을 일반 회원으로 바꾸면 사라집니다 — 부르는 것은 방장만 합니다',
    data: '목데이터',
  },
  {
    href: wf('/chat'),
    name: '채팅방 목록',
    shot: 'chat',
    spec: 'CH-05 · CH-06',
    desc: '검은 막대로 비었을 때 화면도 볼 수 있습니다',
    data: '목데이터',
  },
  {
    href: wf('/chat/r0'),
    name: '채팅방',
    shot: 'chat-room',
    spec: 'CH-01 · CH-02~04 · CH-09',
    desc:
      '방장이 댓글 단 사람 중에서 골라 부른 방입니다. 글 하나에 방 하나예요. 더보기를 누르면 신고할 사람을 먼저 고릅니다',
    data: '목데이터',
  },
  {
    href: wf('/alerts'),
    name: '알림',
    shot: 'alerts',
    spec: 'S3',
    desc: '푸시가 아니라 들어와서 보는 목록입니다. 종류 여섯 개를 한 화면에 늘어놨습니다',
    data: '목데이터',
  },
]

export default function Page() {
  return (
    <div className="ob">
      <header className="ob__head">
        <img className="ob__mark" src="/duck-face.webp" alt="" width={64} height={64} />
        <h1 className="ob__title">2차 화면 목록</h1>
        <p className="ob__lead">
          2차 MVP 로 새로 만든 화면 {NEW.length}개입니다. 눌러서 들어가볼 수 있습니다.
        </p>
        <p className="ob__note">
          <b>1차 화면은 <Link href="/onboarding">여기</Link>에 따로 있습니다.</b> 섞어 두면
          무엇이 새로 온 것인지 눈으로 고르기 어려워서 나눴습니다.
        </p>
        <p className="ob__note">
          범위와 근거는 <code>docs/SPEC-S3.md</code> 에 있습니다. 카드에 붙은 <b>AU-13</b>{' '}
          같은 표시가 그 문서의 요구사항 번호입니다.
        </p>
      </header>

      <section className="ob__sec">
        <h2 className="ob__h">새로 만든 화면</h2>
        <p className="ob__seclead">
          채팅과 그에 딸려 오는 것입니다.
        </p>
        <p className="ob__seclead">
          <b>위에서부터 순서대로 눌러 보시면 흐름이 이어집니다.</b> 모집글 댓글에서 채팅을
          열고 → 방으로 들어갑니다.
        </p>
        <p className="ob__seclead">
          <b>방은 한 가지입니다.</b> 방장이 댓글 단 사람 중에서 골라 부르고, 글 하나에 방
          하나입니다. 신청·수락 화면을 따로 만들지 않은 자리를 이 초대가 대신합니다 — 방장만
          누르므로 절차가 한 번에 끝나고, 모집글 정원이 곧 방 인원이 됩니다.
        </p>
        <p className="ob__seclead">
          1:1 방은 두지 않기로 했습니다. 갈라 두면 제목·말풍선 이름·신고 대상이 전부 두 벌이
          되는데, 정작 둘뿐인 방은 사람이 하나 적을 뿐 나머지가 같습니다. 방장과 둘만 있는
          방도 같은 화면입니다.
        </p>
        <p className="ob__seclead">
          알림도 채팅이 데려온 것입니다. 1차에서는 내 활동 내역이 그 자리를 대신했는데, 상대가
          언제 답할지 모르는 채팅에는 그게 안 통합니다 — 방을 하나씩 열어봐야 알게 됩니다.
        </p>

        <ul className="ob__grid">
          {NEW.map((r) => (
            <li key={r.href}>
              <Link className="ob__card" href={r.href}>
                <span className="ob__shot">
                  <img src={`/shots/${r.shot}.webp`} alt="" loading="lazy" />
                  <span
                    className={`ob__tag ob__tag--${r.data === '목데이터' ? 'mock' : 'none'}`}
                  >
                    {r.data}
                  </span>
                </span>
                <span className="ob__name">{r.name}</span>
                {r.desc && <span className="ob__desc">{r.desc}</span>}
                <span className="ob__meta">
                  <code>{r.href}</code>
                  <span className="ob__spec">{r.spec}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="ob__sec">
        <h2 className="ob__h">아직 없는 것</h2>
        <div className="ob__miss">
          <p>
            <b>서버가 없습니다.</b> 보낸 메시지는 화면에만 쌓이고 새로고침하면 사라집니다.
          </p>
          <p>
            <b>실시간이 아닙니다.</b> 붙일 때도 WebSocket 이 아니라 폴링으로 갑니다 — 방 안 5초,
            목록 30초. 화면은 같고 전송 계층만 다릅니다 (CH-04).
          </p>
          <p>
            <b>알림은 푸시가 아닙니다.</b> 웹이라 브라우저를 닫으면 아무것도 안 옵니다. iOS 는
            홈 화면에 추가해야 웹 푸시를 받을 수 있어서, 그 전까지는 들어와서 보는 목록이
            전부입니다. 그래서 목록보다 <b>배지</b>가 중요한데 그게 하단 탭이라 아직 없습니다.
          </p>

          <p>
            1차 화면에 붙어야 하는 것들이 아직 안 붙었습니다. 모집글 상세의{' '}
            <b>「초대」</b>, 하단 탭의 <b>안 읽음 배지</b>, 백오피스의 <b>채팅 열람</b>.
            1차 화면을 건드리는 일이라 브랜치를 나눴습니다.
          </p>
          <p>
            <b>휴대전화 인증을 넣지 않습니다.</b> 여성가족부의 랜덤채팅앱 고시가 요구하는
            것인데, 그 고시는 모르는 사람을 무작위로 이어주는 서비스를 겨냥하고 게시판에
            딸려 나오는 대화는 제외하고 있습니다. 우리 방은 모집글에 붙어 있고 방장이 댓글 단
            사람 중에서 지목해 부르므로 상대가 특정됩니다. 근거는{' '}
            <code>docs/LEGAL-REVIEW.md</code> 에 적었습니다.
          </p>
          <p>
            대신 <b>초대 없이 들어오는 문을 만들지 않습니다.</b> 링크로 입장하거나 글에서 바로
            들어가게 하면 위 근거가 무너집니다. 고시가 함께 요구하는 대화 저장(마감 후 90일)과
            신고는 그대로 넣습니다.
          </p>
        </div>
        <p className="ob__docs">
          더 자세한 건 <code>docs/SPEC-S3.md</code> 에 있습니다. 법적 근거는 그 문서 2장입니다.
        </p>
      </section>
    </div>
  )
}
