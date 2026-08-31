import type { Metadata } from 'next'
import Image from 'next/image'
import rawEvents from '@/data/events.json'
import type { EventItem } from '@/types'
import ArtistRing from '@/components/intro/ArtistRing'
import ScrollFill from '@/components/intro/ScrollFill'
import ScrollTurntable from '@/components/intro/ScrollTurntable'
import './intro.css'

/**
 * 소개 사이트. 히어로 · 숫자 · ABOUT · 마무리까지가 지금 범위다.
 *
 * 앱 본체(/)는 지도부터 뜨는 게 맞고, 여기는 밖에서 처음 들어온 사람에게
 * 무엇인지 설명하는 대문이다. 두 화면의 목적이 달라 레이아웃도 다르다.
 *
 * 배치는 Boxer Shorts Studio(Framer 템플릿)를 따랐다.
 *   작은 줄(We are) → 초대형 워드마크 → 작은 설명 두 줄 → 오브젝트가 겹침
 * 저쪽은 워드마크 뒤에 하늘 사진을 깔지만 우리는 쓸 수 있는 사진이 없다.
 * 지금 데이터의 이미지는 전부 경쟁 리스팅의 포스터라 실을 수 없다.
 *
 * 숫자는 events.json 에서 그때그때 센다. 손으로 적으면 데이터가 바뀐 뒤에도
 * 옛 숫자가 남고, 그 순간 이 페이지는 거짓말이 된다.
 */

const ALL = rawEvents as EventItem[]

/**
 * 회전 프레임. 위에서 내려다보는 각도로 시작해 눈높이를 지나
 * 아래에서 올려다보는 각도로 끝난다. 좌우가 아니라 상하 궤도다.
 *
 * 뷰어 화면 녹화에서 상하로만 움직이는 구간(17~25초)을 골라
 * 초당 세 장씩 뽑았다. 손으로 잡은 정지 컷과 달리 카메라 거리와
 * 좌우 각도가 그대로라 크기가 튀지 않는다.
 *
 * 잘라내기 상자는 25컷 전체의 합집합 하나를 쓴다. 컷마다 따로 자르면
 * 오리가 프레임마다 튀어서 회전이 아니라 흔들림으로 보인다.
 */
const TURN = Array.from(
  { length: 25 },
  (_, i) => `/intro/turn/${String(i).padStart(2, '0')}.webp`,
)

/** 건수가 많은 대상부터. 링 둘레에 들어가는 만큼만 쓴다 */
function topSubjects(n: number): string[] {
  const c = new Map<string, number>()
  for (const ev of ALL) {
    const s = ev.subject.trim()
    if (s) c.set(s, (c.get(s) ?? 0) + 1)
  }
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([s]) => s)
}

export const metadata: Metadata = {
  title: '덕모임 소개',
  description:
    '서울에서 열리는 생일카페와 팝업을 매일 모아 지도 한 장에 올립니다.',
  // 아직 만드는 중이다. 완성 전에 색인되면 반쪽짜리 페이지가 검색에 남는다
  robots: { index: false, follow: false },
}

export default function IntroPage() {
  const total = ALL.length
  const subjects = new Set(ALL.map((e) => e.subject.trim()).filter(Boolean)).size
  const cafes = ALL.filter((e) => e.kind === 'birthday_cafe').length
  const popups = ALL.filter((e) => e.kind === 'popup').length

  return (
    <main>
      <section className="in-hero">
        <div className="in">
          <p className="in-eyebrow">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.6" />
            </svg>
            서울
          </p>

          <p className="in-kicker">생일카페 · 팝업</p>
          <h1 className="in-wordmark">덕모임</h1>

          <div className="in-stage">
            <ArtistRing names={topSubjects(9)} />
            <Image
              className="in-duck-hero"
              src="/intro/duck-hero.png"
              alt=""
              width={460}
              height={597}
              priority
            />
          </div>

          <p className="in-tagline">
            하루면 닫는다.
            <br />
            찾다가 <em>그 하루</em>가 간다.
          </p>

          <div className="in-herofoot">
            <a className="in-cta" href="/">
              지도 열기
            </a>
            <span className="in-cta-note">설치 없이 웹에서 바로</span>
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

      <section className="in-about">
        <div className="in">
          {/* 오리가 문장 위로 겹쳐 올라온다. 옆에 나란히 두면
              레퍼런스의 층 감각이 사라진다 */}
          <ScrollTurntable frames={TURN} alt="덕모임 오리" className="in-turn" />

          <p className="in-label">덕모임</p>

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

      <section className="in-end">
        <div className="in">
          <h2>덕모임</h2>
          <p>
            주최자 공지 기반 · <a href="/">지도 열기</a>
          </p>
        </div>
      </section>
    </main>
  )
}
