import type { Metadata } from 'next'
import Link from 'next/link'
import { wf } from '@/lib/wireframe'

/**
 * 온보딩 색인.
 *
 * 팀에 화면을 보여줄 때 여기서 시작한다. 절반은 다른 화면 안에서만
 * 열려서(모집글 상세 안의 로그인 게이트) 주소를 모르면 못 본다.
 * 그 목록이 슬랙 스레드에 흩어져 있었다.
 *
 * 글자만 늘어놓았더니 어느 줄이 어느 화면인지 눈으로 못 골랐다.
 * 이름을 읽고 화면을 떠올려야 하는데 처음 보는 사람은 떠올릴 것이
 * 없다. 그래서 사진을 앞에 둔다. 설명은 사진이 못 말하는 것만 적는다.
 *
 * 사진은 scripts/screen-shots.mjs 가 찍는다. 화면을 고치면 다시 돌린다.
 *
 * 색인에서 뺀다. 팀 내부용이라 검색으로 들어올 화면이 아니다.
 */
export const metadata: Metadata = {
  title: '화면 목록 · 덕모임',
  robots: { index: false, follow: false },
}

type Row = {
  href: string
  name: string
  /** public/shots/<shot>.webp */
  shot: string
  /** 명세 ID */
  spec: string
  /** 사진만 봐서는 모를 것만 적는다. 없으면 비운다 */
  desc?: string
  data: '실데이터' | '목데이터' | '섞임' | '빈 화면'
}

type Group = {
  title: string
  /** 묶음을 설명할 것이 있을 때만 */
  lead?: string
  rows: Row[]
}

const GROUPS: Group[] = [
  {
    title: '들어오는 길',
    lead: '검색으로 들어오는 쪽. 원래 있던 화면들입니다.',
    rows: [
      {
        /* 실서비스 주소(/)가 아니라 와이어프레임 쪽을 가리킨다.
           그쪽이라야 로그인 버튼과 하단 탭의 동행이 보인다. duckmoim.com
           은 와이어프레임 플래그 없이 빌드되어서 / 로 보내면 그 둘이
           빠진 화면이 나온다 */
        href: wf('/home'),
        name: '지도 · 목록',
        shot: 'home',
        spec: 'PoC',
        data: '실데이터',
      },
      {
        href: '/e/pg_8417',
        name: '이벤트 상세',
        shot: 'event',
        spec: 'EV-07',
        desc: '아래에 동행글 자리가 붙었습니다',
        data: '실데이터',
      },
      {
        href: '/a/성호',
        name: '아티스트로 모아보기',
        shot: 'artist',
        spec: 'SEO',
        desc: '검색 유입용',
        data: '실데이터',
      },
    ],
  },
  {
    title: '동행',
    lead: '이번에 만든 부분입니다.',
    rows: [
      {
        href: wf('/p'),
        name: '모집글 목록',
        shot: 'posts',
        spec: 'PO-02',
        data: '섞임',
      },
      {
        href: wf('/p/p1'),
        name: '모집글 상세',
        shot: 'post',
        spec: 'PO-03 · CM',
        desc: '댓글과 비밀 댓글이 여기 다 있습니다. 「보는 사람」 에 나이 확인 중이 있어요',
        data: '목데이터',
      },
      {
        href: wf('/p/new'),
        name: '모집글 쓰기',
        shot: 'post-new',
        spec: 'PO-01',
        desc: '쓰는 칸은 다섯 개. 만날 자리는 지도에 찍습니다',
        data: '섞임',
      },
    ],
  },
  {
    title: '계정',
    rows: [
      {
        href: wf('/login'),
        name: '로그인',
        shot: 'login',
        spec: 'AU-01',
        desc: '카카오만 있습니다',
        data: '빈 화면',
      },
      {
        href: wf('/welcome'),
        name: '가입 정보 입력',
        shot: 'welcome',
        spec: 'AU-02',
        desc: '닉네임이랑 출생연도. 2011년생보다 늦으면 왜 막히는지 뜹니다',
        data: '빈 화면',
      },
      {
        href: wf('/me/edit'),
        name: '프로필 수정',
        shot: 'me-edit',
        spec: 'AU-04',
        data: '목데이터',
      },
      {
        /* 내 활동(/me)과 한 화면이 됐다. 「보는 사람」 을 「나」 로 넘기면
           제재 안내·내 댓글 탭까지 그대로 뜬다. 줄을 둘로 두면 같은
           화면을 두 번 여는 셈이라 하나로 줄였다 */
        href: wf('/u/u_host'),
        name: '프로필',
        shot: 'profile',
        spec: 'AU-09 · AU-10',
        desc: '내 것도 남의 것도 같은 화면. 「제재」 를 넘기면 나이 확인·정지가 보입니다',
        data: '목데이터',
      },
    ],
  },
  {
    title: '나머지',
    rows: [
      {
        href: wf('/admin15616'),
        name: '백오피스',
        shot: 'admin',
        spec: 'AD',
        desc: '신고 · 제재 · 기록 세 탭. 「일반 계정」 으로 넘기면 403 이 뜹니다. 여기만 PC 화면이에요',
        data: '목데이터',
      },
      {
        href: '/terms',
        name: '이용약관',
        shot: 'terms',
        spec: '명세 밖',
        desc: '실서비스 주소입니다. 푸터에서 이어집니다',
        data: '실데이터',
      },
      {
        href: '/privacy',
        name: '개인정보 처리방침',
        shot: 'privacy',
        spec: '명세 밖',
        desc: '실서비스 주소입니다. 푸터에서 이어집니다',
        data: '실데이터',
      },
      {
        href: wf('/dev/gallery'),
        name: '컴포넌트 갤러리',
        shot: 'gallery',
        spec: '개발용',
        desc: '버튼이랑 입력칸 모아둔 곳',
        data: '빈 화면',
      },
      {
        href: '/없는주소',
        name: '404',
        shot: 'notfound',
        spec: '명세 밖',
        data: '빈 화면',
      },
    ],
  },
]

const TOTAL = GROUPS.reduce((n, g) => n + g.rows.length, 0)

export default function Page() {

  return (
    <div className="ob">
      <header className="ob__head">
        <img className="ob__mark" src="/duck-face.webp" alt="" width={64} height={64} />
        <h1 className="ob__title">화면 목록</h1>
        <p className="ob__lead">
          지금까지 만든 화면 {TOTAL}개입니다. 눌러서 들어가볼 수 있고, 로그인을
          누르면 가입까지 넘어갑니다.
        </p>
        <p className="ob__note">
          <b>이 페이지가 유일한 입구입니다.</b> 아래 화면들은 주소를 일부러
          어렵게 뒀고 실서비스 화면에서 이어지는 링크도 없습니다. 즐겨찾기 해두세요.
        </p>
        <p className="ob__note">
          사진 위의 표시는 그 화면에 뜨는 값이 어디서 온 건지입니다.{' '}
          <b>실데이터</b>는 크롤러가 모은 204건, <b>목데이터</b>는 화면 확인용으로
          적어둔 값입니다.
        </p>
      </header>

      {GROUPS.map((g) => (
        <section className="ob__sec" key={g.title}>
          <h2 className="ob__h">{g.title}</h2>
          {g.lead && <p className="ob__seclead">{g.lead}</p>}

          <ul className="ob__grid">
            {g.rows.map((r) => (
              <li key={r.href}>
                <Link className="ob__card" href={r.href}>
                  <span className="ob__shot">
                    {/* 사진은 화면 위쪽만 잘라 담았다. 어느 화면인지
                        알아보는 데는 머리가 보이면 충분하고, 통째로
                        담으면 한 칸이 세로로 길어져 격자가 무너진다 */}
                    <img src={`/shots/${r.shot}.webp`} alt="" loading="lazy" />
                    {/* 표시를 사진 위에 얹어 한 줄을 아낀다. 밑에 두면
                        카드마다 줄이 하나씩 늘어 열일곱 줄이 된다 */}
                    <span className={`ob__tag ob__tag--${tagKey(r.data)}`}>{r.data}</span>
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
      ))}

      <section className="ob__sec">
        <h2 className="ob__h">아직 없는 것</h2>
        <div className="ob__miss">
          <p>
            <b>서버가 없습니다.</b> 카카오를 눌러도 진짜 로그인은 하지 않고 다음
            화면으로만 넘어갑니다. 글을 올려도 저장되지 않고, 새로고침하면
            사라집니다.
          </p>
          <p>
            알림, 신청·수락, 유저 차단, 댓글 답글을 1차에서 뺐습니다. 연락은
            비밀 댓글로 주고받고, 누가 왔는지는 내 활동 화면에서 직접
            확인합니다. 댓글은 답글 없이 평평하게 쌓입니다.
          </p>
          <p>
            백오피스는 주소만 어렵게 해뒀습니다. 링크를 아는 사람은 그대로
            들어옵니다 (Q-13).
          </p>
        </div>
        <p className="ob__docs">
          더 자세한 건 <code>docs/FRONTEND.md</code> 와{' '}
          <code>docs/design/SCALE.md</code> 에 있습니다.
        </p>
      </section>
    </div>
  )
}

/** 한글 라벨을 클래스에 바로 쓸 수 없어 짧은 열쇠로 바꾼다 */
function tagKey(d: Row['data']) {
  return d === '실데이터' ? 'real' : d === '목데이터' ? 'mock' : d === '섞임' ? 'mix' : 'none'
}
