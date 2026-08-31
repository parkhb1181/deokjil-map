import type { Metadata } from 'next'
import { Archivo_Black } from 'next/font/google'
import rawEvents from '@/data/events.json'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'
import { shareSlug } from '@/lib/subject-slug'
import ScrollFill from '@/components/intro/ScrollFill'
import ScrollTurntable from '@/components/intro/ScrollTurntable'
import './intro.css'

/**
 * 소개 사이트.
 *
 * 앱 본체(/)는 지도부터 뜨는 게 맞고, 여기는 밖에서 처음 들어온 사람에게
 * 무엇인지 설명하는 대문이다. 두 화면의 목적이 달라 레이아웃도 다르다.
 *
 * 구성은 Boxer Shorts Studio 계열을 따랐다. 하늘 배경 히어로, 화면 폭을
 * 채우는 워드마크, 섹션마다 뒤집히는 배경, 글자와 겹치는 오브젝트,
 * 초대형 워드마크로 닫는 푸터.
 *
 * 사진은 Unsplash 다. 아이돌 얼굴이나 굿즈 상표가 크게 나오는 컷은
 * 받아온 것 중에 있었지만 쓰지 않았다. 소속사 IP 와 초상권이 걸린다.
 * 얼굴이 식별되지 않는 것만 골랐다.
 *
 * 숫자와 목록은 events.json 에서 그때그때 만든다. 손으로 적으면 데이터가
 * 바뀐 뒤에도 옛 숫자가 남고, 그 순간 이 페이지는 거짓말이 된다.
 *
 * "오늘 열린 것" 이라고 쓰지 않는다. 이 페이지는 빌드 시점에 굳는데
 * 오늘은 매일 바뀐다. 마감 임박순은 날짜를 주장하지 않아 안전하다.
 */

const ALL = rawEvents as EventItem[]

/**
 * 회전 프레임. 위에서 내려다보는 각도로 시작해 눈높이를 지나
 * 아래에서 올려다보는 각도로 끝난다. 좌우가 아니라 상하 궤도다.
 *
 * 뷰어 화면 녹화에서 상하로만 움직이는 구간을 골라 초당 세 장씩 뽑았다.
 * 잘라내기 상자는 25컷 전체의 합집합 하나를 썼다. 컷마다 따로 자르면
 * 오리가 프레임마다 튀어서 회전이 아니라 흔들림으로 보인다.
 */
const TURN = Array.from(
  { length: 25 },
  (_, i) => `/intro/turn/${String(i).padStart(2, '0')}.webp`,
)

/** 숫자와 영문 라벨 전용. 한글 글리프가 없으므로 한국어에 쓰지 않는다 */
const archivo = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-num',
})

/** 마감이 가까운 순 */
const byEnding = [...ALL].sort((a, b) => a.ends_on.localeCompare(b.ends_on))

/**
 * 대상이 겹치지 않게 앞에서부터 고른다.
 * 마감이 가까운 세 건을 그냥 자르면 한 대상이 세 줄을 다 차지한다.
 * 실제로 그랬다. 첫 화면에서는 폭이 넓어 보이는 쪽이 맞다.
 */
const byEndingUnique = (() => {
  const seen = new Set<string>()
  return byEnding.filter((ev) => {
    const s = ev.subject.trim()
    if (seen.has(s)) return false
    seen.add(s)
    return true
  })
})()

/** 건수가 많은 대상부터 */
function topSubjects(n: number): string[] {
  const c = new Map<string, number>()
  for (const ev of ALL) {
    const s = ev.subject.trim()
    if (s) c.set(s, (c.get(s) ?? 0) + 1)
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([s]) => s)
}

export const metadata: Metadata = {
  title: '덕모임 소개',
  description:
    '서울에서 열리는 생일카페와 팝업을 매일 모아 지도 한 장에 올립니다.',
  // 아직 만드는 중이다. 완성 전에 색인되면 반쪽짜리 페이지가 검색에 남는다
  robots: { index: false, follow: false },
}

const CAN = [
  {
    n: '01',
    title: '지도로 보기',
    body: '어느 동네에 몇 곳이 열렸는지 핀으로 봅니다. 동선을 먼저 짜고 나갈 수 있습니다.',
  },
  {
    n: '02',
    title: '목록으로 보기',
    body: '대상, 지역, 기간으로 거릅니다. 끝난 것은 목록에 남기지 않습니다.',
  },
  {
    n: '03',
    title: '대상별로 보기',
    body: '한 사람의 생일카페만 모아 봅니다. 그 주소를 그대로 커뮤니티에 붙일 수 있습니다.',
  },
  {
    n: '04',
    title: '즐겨찾기',
    body: '가려는 곳에 하트를 눌러 둡니다. 로그인 없이 이 기기에 남습니다.',
  },
]

export default function IntroPage() {
  const total = ALL.length
  const subjects = new Set(ALL.map((e) => e.subject.trim()).filter(Boolean)).size
  const cafes = ALL.filter((e) => e.kind === 'birthday_cafe').length
  const popups = ALL.filter((e) => e.kind === 'popup').length
  const names = topSubjects(12)

  return (
    <main className={archivo.variable}>
      <section className="in-hero">
        <div className="in-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="덕모임" width={182} height={136} />
          <a href="/">지도 열기</a>
        </div>

        <div className="in">
          <p className="in-kicker">서울 생일카페 · 팝업</p>
          <h1 className="in-wordmark">덕모임</h1>

          <p className="in-tagline">
            하루면 닫는다.
            <br />
            찾다가 <em>그 하루</em>가 간다.
          </p>

          {/* 실제로 올라와 있는 대상 이름. 저쪽은 이 자리에 남의 클라이언트
              로고를 돌리지만 우리는 빌릴 필요가 없다 */}
          <div className="in-marquee" aria-hidden="true">
            <div className="in-marquee__row">
              {[...names, ...names].map((s, i) => (
                <span key={i}>{s}</span>
              ))}
            </div>
          </div>

          <div className="in-today">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="in-perch" src="/intro/turn/12.webp" alt="" />
            <p className="in-today__label">
              <span className="in-mono">NOW</span> 마감이 가까운 순
            </p>
            <ul>
              {byEndingUnique.slice(0, 3).map((ev) => (
                <li key={ev.id}>
                  <b>{ev.subject}</b>
                  {DISTRICT_LABELS[ev.place.district]}
                  <span>~{ev.ends_on.slice(5).replace('-', '.')}</span>
                </li>
              ))}
            </ul>
            <a className="in-cta" href="/">
              지도에서 전부 보기
            </a>
          </div>
        </div>
      </section>

      <div className="in in-stats">
        <span>
          <b>{total}</b>곳
        </span>
        <span>
          <b>{subjects}</b>명
        </span>
        <span>
          생일카페 {cafes} · 팝업 {popups}
        </span>
      </div>

      <section className="in-dark in-about">
        <div className="in">
          <ScrollTurntable frames={TURN} alt="덕모임 오리" className="in-turn" />
          <p className="in-label">ABOUT</p>
          <ScrollFill
            className="in-say"
            text="주최자 공지를 그대로 옮깁니다. 끝난 것은 지웁니다. 지난 정보는 없는 정보보다 나쁘니까요."
          />
          <p className="in-note">
            매일 새로 모으고, 종료된 건은 목록에서 뺍니다. 방문 전에는 원문을 한
            번 더 확인해 주세요. 각 상세 화면에 주최자 링크를 그대로 답니다.
          </p>
        </div>
      </section>

      <section className="in-dark in-now">
        <div className="in">
          <p className="in-label">NOW OPEN</p>
          <h2>지금 열려 있는 곳</h2>
          <div className="in-rail">
            {byEndingUnique.slice(0, 8).map((ev) => (
              <a className="in-card" key={ev.id} href={`/e/${encodeURIComponent(ev.id)}`}>
                <span className="in-card__kind">{EVENT_KIND_LABELS[ev.kind]}</span>
                <p className="in-card__subject">{ev.subject}</p>
                <p className="in-card__place">
                  {DISTRICT_LABELS[ev.place.district]} · {ev.place.name}
                </p>
                <p className="in-card__ends">~{ev.ends_on}</p>
              </a>
            ))}
          </div>
          <a className="in-more" href={`/a/${shareSlug(names[0])}`}>
            {names[0]} 전부 보기
          </a>
        </div>
      </section>

      <section className="in-dark in-can">
        <div className="in">
          <p className="in-label">WHAT YOU CAN DO</p>
          <h2>할 수 있는 것</h2>
          <div className="in-cards">
            {CAN.map((c) => (
              <div className="in-can-card" key={c.n}>
                <b>{c.n}</b>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="in-dark in-end">
        <div className="in">
          <a className="in-cta" href="/">
            지도 열기
          </a>
          <h2>덕모임</h2>
          <p>
            주최자 공지 기반 · 방문 전 원문 확인 권장 ·{' '}
            <a href="/">duckmoim.com</a>
          </p>
        </div>
      </section>
    </main>
  )
}
