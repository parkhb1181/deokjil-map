import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * 온보딩 색인.
 *
 * 팀에 화면을 보여줄 때 쓰는 목차다. 절반은 다른 화면 안에서만
 * 열려서(모집글 상세 → 로그인 게이트), 주소를 모르면 못 본다.
 * 그 목록이 슬랙 스레드에 흩어져 있었다.
 *
 * 개수는 GROUPS 에서 세므로 줄을 더해도 문장이 어긋나지 않는다.
 *
 * **정적 페이지 하나다.** 서버도 인증도 없다. 로컬에서 띄우고
 * 화면 공유로 같이 보는 용도라 그 이상이 필요 없다.
 *
 * 여기에는 "무엇이 진짜인지" 를 같이 적는다. 목데이터로 만든
 * 화면을 보고 다 됐다고 여기면, 백엔드가 붙을 때 남은 일이 갑자기
 * 나타난 것처럼 보인다.
 *
 * 색인에서 뺀다. 팀 내부용이고 검색으로 들어올 화면이 아니다.
 */
export const metadata: Metadata = {
  title: '화면 목록 · 덕모임',
  robots: { index: false, follow: false },
}

type Row = {
  href: string
  name: string
  /** 명세 ID. 어디서 나온 화면인지 */
  spec: string
  desc: string
  /** 화면에 흐르는 값이 어디서 오는가 */
  data: '실데이터' | '목데이터' | '섞임' | '빈 화면'
}

type Group = {
  title: string
  /** 이 묶음이 무엇을 하는 흐름인지 */
  lead: string
  rows: Row[]
}

const GROUPS: Group[] = [
  {
    title: '들어오는 길',
    lead: '검색으로 들어온 사람이 처음 보는 화면들. 크롤러가 모은 204건이 그대로 흐른다.',
    rows: [
      {
        href: '/',
        name: '지도 · 목록',
        spec: 'PoC',
        desc: '생카·팝업을 위치로 모아 본다. 원래 있던 앱이다',
        data: '실데이터',
      },
      {
        href: '/e/pg_8417',
        name: '이벤트 상세',
        spec: 'EV-07',
        desc: '장소·기간·특전. 아래에 동행글 블록이 붙는다',
        data: '실데이터',
      },
      {
        href: '/a/에이티즈',
        name: '아티스트 모아보기',
        spec: 'SEO',
        desc: '한 아티스트의 행사를 한 장에. 롱테일 검색 입구',
        data: '실데이터',
      },
    ],
  },
  {
    title: '동행 (이번에 만든 것)',
    lead: '같이 갈 사람을 구하는 흐름. 서버가 없어 글과 댓글은 목데이터다.',
    rows: [
      {
        href: '/p',
        name: '모집글 목록',
        spec: 'PO-02',
        desc: '행사 사진이 붙은 목록. 오른쪽 아래 글쓰기 버튼',
        data: '섞임',
      },
      {
        href: '/p/p1',
        name: '모집글 상세',
        spec: 'PO-03 · CM',
        desc: '나머지 화면의 기준이 된 화면. 댓글·비밀 댓글·신고가 다 여기 있다',
        data: '목데이터',
      },
      {
        href: '/p/new',
        name: '모집글 쓰기',
        spec: 'PO-01',
        desc: '다섯 칸. 함께 갈 행사는 204건에서 검색해 고른다',
        data: '섞임',
      },
    ],
  },
  {
    title: '계정',
    lead: '로그인부터 프로필까지. 카카오를 누르면 가입 정보 입력으로 이어진다.',
    rows: [
      {
        href: '/login',
        name: '로그인',
        spec: 'AU-01',
        desc: '카카오 하나만. 가입과 로그인을 나누지 않는다',
        data: '빈 화면',
      },
      {
        href: '/welcome',
        name: '가입 정보 입력',
        spec: 'AU-02 · AU-06',
        desc: '닉네임과 연령대만. 성별은 받지 않는다',
        data: '빈 화면',
      },
      {
        href: '/me',
        name: '내 활동',
        spec: 'AU-08',
        desc: '알림이 없어서, 댓글이 달렸는지 확인할 유일한 경로',
        data: '목데이터',
      },
      {
        href: '/me/edit',
        name: '프로필 수정',
        spec: 'AU-04',
        desc: '사진·닉네임·한줄소개. 연령대는 잠겨 있다',
        data: '목데이터',
      },
      {
        href: '/me/blocked',
        name: '차단한 사람',
        spec: 'SF-05',
        desc: '차단을 푸는 유일한 자리',
        data: '목데이터',
      },
      {
        href: '/u/u_host',
        name: '남의 프로필',
        spec: 'AU-05',
        desc: '같이 다닌 기록과 쓴 모집글. 여기서 차단·신고한다',
        data: '목데이터',
      },
    ],
  },
  {
    title: '나머지',
    lead: '자주 안 보지만 없으면 막히는 화면들.',
    rows: [
      {
        href: '/admin15616',
        name: '백오피스',
        spec: 'AD',
        desc: '신고 처리·제재·이벤트 수기 등록. 주소 끝 숫자는 자물쇠가 아니라 자물쇠 그림이다',
        data: '목데이터',
      },
      {
        href: '/terms',
        name: '이용약관',
        spec: '명세 밖',
        desc: '아직 안 썼다. 로그인이 이 문서에 동의한다고 적어두고 있다',
        data: '빈 화면',
      },
      {
        href: '/privacy',
        name: '개인정보 처리방침',
        spec: '명세 밖',
        desc: '받는 값은 정해졌고 문서로 옮기는 일이 남았다',
        data: '빈 화면',
      },
      {
        href: '/dev/gallery',
        name: '컴포넌트 갤러리',
        spec: '개발용',
        desc: '버튼·입력칸·시트를 한자리에서 본다',
        data: '빈 화면',
      },
      {
        href: '/없는주소',
        name: '404',
        spec: '명세 밖',
        desc: '없는 주소로 들어왔을 때',
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
        <img className="ob__mark" src="/duck-face.webp" alt="" width={72} height={72} />
        <h1 className="ob__title">화면 목록</h1>
        <p className="ob__lead">
          지금까지 그린 화면 {TOTAL}개입니다. 전부 눌러볼 수 있고, 화면끼리도
          이어져 있어요. 로그인 버튼을 누르면 가입까지 넘어갑니다.
        </p>
        {/* 목데이터가 무엇을 뜻하는지 한 번 말해둔다. 표에서 이 낱말을
            열다섯 번 보게 되는데 뜻을 모르면 그냥 지나간다 */}
        <p className="ob__note">
          <b>실데이터</b>는 크롤러가 모은 204건이 그대로 흐르는 것,{' '}
          <b>목데이터</b>는 화면을 보려고 손으로 적어둔 값입니다. 서버가
          붙으면 목데이터 자리만 바뀝니다.
        </p>
      </header>

      {GROUPS.map((g) => (
        <section className="ob__sec" key={g.title}>
          <h2 className="ob__h">{g.title}</h2>
          <p className="ob__seclead">{g.lead}</p>

          <ul className="ob__list">
            {g.rows.map((r) => (
              <li key={r.href}>
                <Link className="ob__row" href={r.href}>
                  <span className="ob__rowtop">
                    <span className="ob__name">{r.name}</span>
                    <span className={`ob__tag ob__tag--${tagKey(r.data)}`}>{r.data}</span>
                  </span>
                  <span className="ob__desc">{r.desc}</span>
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

      {/* 화면만 보고는 알 수 없는 것들. 여기 없으면 다 된 줄 안다 */}
      <section className="ob__sec">
        <h2 className="ob__h">아직 없는 것</h2>
        <ul className="ob__todo">
          <li>
            <b>서버와 로그인.</b> 카카오 버튼을 눌러도 실제로 인증하지 않고
            다음 화면으로만 넘어갑니다. 글을 올려도 저장되지 않습니다
          </li>
          <li>
            <b>알림.</b> 1차 범위에서 뺐습니다. 그래서 내 활동 화면이 확인할
            유일한 경로입니다
          </li>
          <li>
            <b>신청·수락.</b> 명세의 AP 16개를 통째로 뺐습니다. 댓글로
            연락하고 끝냅니다
          </li>
          <li>
            <b>백오피스 접근 제한 (Q-13).</b> 주소를 어렵게 한 것이 전부라,
            링크를 아는 사람은 그대로 들어옵니다
          </li>
        </ul>
        <p className="ob__docs">
          자세한 것은 저장소의 <code>docs/FRONTEND.md</code> 와{' '}
          <code>docs/design/SCALE.md</code> 에 적어뒀습니다.
        </p>
      </section>
    </div>
  )
}

/** 한글 라벨을 클래스에 바로 쓸 수 없어 짧은 열쇠로 바꾼다 */
function tagKey(d: Row['data']) {
  return d === '실데이터' ? 'real' : d === '목데이터' ? 'mock' : d === '섞임' ? 'mix' : 'none'
}
