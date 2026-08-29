import type { MetadataRoute } from 'next'

/**
 * PWA manifest. 홈 화면에 추가했을 때 브라우저 크롬 없이 뜨게 한다.
 *
 * 현장에서 열어보는 앱이라 홈 화면 추가가 재방문 경로가 된다 (지표 5).
 * 색은 globals.css 의 --bg 와 같은 값이다. 스플래시와 첫 화면의 톤이
 * 어긋나면 로딩이 실제보다 길게 느껴진다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '덕모임 · 서울 생카 팝업 지도',
    short_name: '덕모임',
    description: '오늘 서울 어디서 뭐 하는지 한눈에. 생일카페와 팝업을 지역·날짜로 모아 봅니다.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffafc',
    theme_color: '#fffafc',
    lang: 'ko',
  }
}
