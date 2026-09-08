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
    href: wf('/verify'),
    name: '휴대전화 인증',
    shot: 'verify',
    spec: 'AU-13',
    desc: '채팅으로 가는 관문. 번호 → 인증번호 6자리. 000000 을 넣으면 실패 흐름이 보입니다',
    data: '화면만',
  },
  {
    href: wf('/chat'),
    name: '채팅방 목록',
    shot: 'chat',
    spec: 'CH-05 · CH-06',
    desc: '검은 막대로 비었음 · 미인증 화면도 볼 수 있습니다',
    data: '목데이터',
  },
  {
    href: wf('/chat/r1'),
    name: '채팅방',
    shot: 'chat-room',
    spec: 'CH-02~04 · CH-09',
    desc: '오른쪽 위 더보기에서 신고와 차단. 차단하면 입력칸이 잠깁니다',
    data: '목데이터',
  },
  {
    href: wf('/me/blocked'),
    name: '차단 목록',
    shot: 'blocked',
    spec: 'SF-06 · SF-04',
    desc: '차단은 상대에게 안 알리므로 되돌리는 자리가 여기뿐입니다',
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
          채팅과 그에 딸려 오는 것들입니다. 셋이 서로를 물고 있어서 하나만 떼어낼 수 없습니다 —
          채팅을 넣으면 휴대전화 인증이 법으로 따라오고, 차단이 없으면 빠져나갈 수 없는 대화가
          생깁니다.
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
            <b>서버가 없습니다.</b> 인증번호를 받아도 문자는 안 오고 아무 6자리나 넣으면
            통과합니다. 보낸 메시지는 화면에만 쌓이고 새로고침하면 사라집니다.
          </p>
          <p>
            <b>실시간이 아닙니다.</b> 붙일 때도 WebSocket 이 아니라 폴링으로 갑니다 — 방 안 5초,
            목록 30초. 화면은 같고 전송 계층만 다릅니다 (CH-04).
          </p>
          <p>
            1차 화면에 붙어야 하는 것들이 아직 안 붙었습니다. 모집글 상세의{' '}
            <b>「채팅하기」</b>, 하단 탭의 <b>안 읽음 배지</b>, 프로필의 <b>차단</b>, 백오피스의{' '}
            <b>채팅 열람</b>. 1차 화면을 건드리는 일이라 브랜치를 나눴습니다.
          </p>
          <p>
            <b>나이는 검증하지 못합니다.</b> 명의자 생년월일까지 보려면 본인확인기관을 거쳐야
            하는데 사업자 계약이 필요합니다. 휴대전화 인증은 「그 번호를 지금 갖고 있다」까지만
            확인합니다.
          </p>
        </div>
        <p className="ob__docs">
          더 자세한 건 <code>docs/SPEC-S3.md</code> 에 있습니다. 법적 근거는 그 문서 2장입니다.
        </p>
      </section>
    </div>
  )
}
