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
    name: '덕모임 - 생카·팝업 정보 및 모임',
    short_name: '덕모임',
    description: '오늘 서울 어디서 뭐 하는지 한눈에. 생일카페와 팝업을 지역·날짜로 모아 봅니다.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffafc',
    theme_color: '#fffafc',
    lang: 'ko',
    /*
     * 홈 화면 아이콘을 여기서 준다.
     *
     * 선언이 없으면 안드로이드가 탭 파비콘(`src/app/icon.png`)을 대신
     * 끌어다 쓴다. 그래서 그 파일이 512 짜리 295KB 였고, 정작 탭에서는
     * 32px 로 줄여 그리는 그림을 **모든 방문자가 통째로 받고 있었다.**
     * 사이트에서 제일 큰 파일이 파비콘이었다.
     *
     * 두 자리를 나눈다. 탭은 96px 5KB 로 충분하고, 512 는 홈 화면에
     * 추가하는 사람만 받으면 된다. 줄여서 화질이 상하는 것이 아니다 —
     * 무손실로는 1바이트도 안 줄어드는 그림이라 크기를 낮추는 쪽이
     * 답이었다. 색을 줄이는 손실 압축은 오리가 3D 렌더라 그라데이션에
     * 띠가 생긴다.
     */
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
