import type { Metadata, Viewport } from 'next'
import './globals.css'
import AnalyticsScripts from '@/components/AnalyticsScripts'
import { siteUrl } from '@/lib/site'

const TITLE = '모여라덕 — 서울 생카·팝업 지도'
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
    siteName: '모여라덕',
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
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // 라이트 전용 — 기기 설정과 무관하게 같은 톤을 보여준다
  themeColor: '#fffafc',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <AnalyticsScripts />
      </body>
    </html>
  )
}
