import type { Metadata } from 'next'
import './landing.css'

export const metadata: Metadata = {
  title: '같이 갈 사람 구해요 — 콘서트·팝업 동행',
  description:
    '티켓은 있는데 같이 갈 사람이 없어서 접었던 날. 같은 공연을 보러 가는 사람을 찾아 함께 들어가세요.',
}

/**
 * 동행 랜딩 — 히어로.
 *
 * 앱(지도)과 다른 톤이라 스타일을 landing.css 로 분리했다.
 * globals.css 는 건드리지 않는다 — 같은 파일을 고치면 동료 작업과 충돌한다.
 *
 * 조판 근거는 dontboardme.com 실측이다 (Awwwards Site of the Year 2024).
 * 세 가지만 가져왔다 — 크림 바탕에 강한 주색 하나, 12·14 와 200 사이를 비운
 * 크기 대비, 그리고 흐르는 마퀴. 3D 가 아니라 순수 DOM 이라 재현이 된다.
 *
 * 사진은 Unsplash License. 얼굴이 크게 나오는 컷을 쓰지 않는다 —
 * 무료 스톡은 모델 릴리스를 주지 않아서, 상업 페이지에 식별 가능한 인물을
 * 크게 쓰면 초상권 문제가 생긴다.
 */
export default function LandingPage() {
  // 마퀴는 같은 목록을 두 벌 이어붙여야 이음매 없이 돈다 (translateX -50%)
  const chant = ['같이 갈 사람 구해요', '★', '혼자여도 괜찮아요', '★']

  return (
    <div className="lp">
      <header className="lp__top">
        <div className="lp__logo">TOGETHER</div>
        <nav className="lp__nav lp__mono">
          <span>ABOUT</span>
          <span>SAFETY</span>
          <span>LOGIN</span>
        </nav>
      </header>

      <section className="lp__hero">
        <div className="lp__ghost" aria-hidden>
          GO TOGETHER
        </div>

        <div className="lp__photo lp__photo--main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/together.jpg" alt="" loading="eager" decoding="async" />
        </div>
        <div className="lp__photo lp__photo--sub" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/crowd.jpg" alt="" loading="lazy" decoding="async" />
        </div>

        <h1 className="lp__title">
          혼자 가긴
          <br />
          <span className="lp__mark">좀 그래서</span>
          <br />
          <em>못 간 공연,</em>
          <br />
          몇 개예요?
        </h1>

        <p className="lp__lead">
          티켓은 있는데 같이 갈 사람이 없어서 접었던 날.
          <br />
          <b>같은 공연을 고른 사람</b>만 모아서 보여드립니다.
        </p>

        <div className="lp__cta">
          <a className="lp__btn" href="#start">
            무료로 시작하기
          </a>
          <a className="lp__btn lp__btn--ghost" href="#list">
            올라온 동행 보기
          </a>
        </div>
      </section>

      <div className="lp__marquee">
        <div className="lp__track" aria-hidden>
          {[...chant, ...chant, ...chant, ...chant].map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
