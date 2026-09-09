import type { Metadata, Viewport } from 'next'
import { Jua } from 'next/font/google'
import '../../public/font/pretendard.css'
import './globals.css'
import './ui.css'
import AnalyticsScripts from '@/components/AnalyticsScripts'
import ServiceWorker from '@/components/ServiceWorker'
import { siteUrl } from '@/lib/site'

/**
 * 로고 전용 글꼴. 본문에는 쓰지 않는다.
 * 본문까지 이걸로 깔면 정보를 읽는 화면이 놀이 화면이 된다.
 * 글자 세 개만 쓰므로 한글 서브셋 중 필요한 조각만 내려온다.
 */
// subsets 를 지정하지 않는다. next/font 타입은 Jua 에 latin 만 열어두는데
// 실제로 필요한 건 한글 글리프다. preload 를 끄면 전체를 받아 쓴다
const jua = Jua({ weight: '400', display: 'swap', variable: '--font-logo', preload: false })

const TITLE = '덕모임 - 생카·팝업 정보 및 모임'
const DESCRIPTION =
  '오늘 서울 어디서 뭐 하는지 한눈에. 생일카페와 팝업을 지역·날짜로 모아 보여줍니다.'


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  // 커뮤니티 공유가 유입의 전부다. 미리보기 카드가 곧 첫 화면이다 (poc-plan 8번)
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '덕모임',
    title: TITLE,
    description: DESCRIPTION,
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  // 검색 유입은 기대하지 않지만 막지도 않는다
  robots: { index: true, follow: true },
  /**
   * 검색엔진 소유확인.
   *
   * 파일 업로드 대신 메타태그를 쓴다. public/ 에 확인용 파일을 흩뿌리면
   * 어느 것이 무엇인지 나중에 알 수 없고, 지우면 소유확인이 조용히 풀린다.
   * 여기 모아두면 한 파일만 보면 된다.
   *
   * 네이버는 서치어드바이저에서 발급받은 값을 other 에 넣는다:
   *   other: { 'naver-site-verification': '발급값' }
   */
  verification: {
    google: 'jg_M-Yy2R7r62UJFFUvHj6jrkmjG9qdLFTd9-ZEzm28',
    other: { 'naver-site-verification': 'f58ab40d48225f8d4f01fd0328d8ed9f656a9c1f' },
  },
  /**
   * 홈 화면에 추가했을 때 iOS 가 읽는 값.
   *
   * **매니페스트의 `display: standalone` 만으로는 구형 iOS 가 주소창을
   * 안 지운다.** 요즘 사파리는 매니페스트를 읽지만, 이 메타를 같이 두는
   * 것이 아직 표준 관행이고 한 줄이라 손해가 없다.
   *
   * `statusBarStyle` 을 기본으로 둔다. 상단 바를 투명하게 만드는 값도
   * 있는데 그러면 시계와 배터리가 우리 헤더 위에 겹친다 — 그걸 피하려면
   * 안전영역만큼 위를 비워야 하고, 그건 화면 설계가 따라와야 하는 일이다.
   *
   * 아이폰은 **사파리에서만** 홈 화면에 추가할 수 있다. 크롬으로 열면
   * 그 메뉴가 없다.
   */
  appleWebApp: {
    capable: true,
    title: '덕모임',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // 라이트 전용, 기기 설정과 무관하게 같은 톤을 보여준다
  themeColor: '#fffafc',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={jua.variable}>
        {children}
        <AnalyticsScripts />
        <ServiceWorker />
      </body>
    </html>
  )
}
