import type { Metadata } from 'next'
import HomeApp from '@/components/HomeApp'

/**
 * 온보딩에서 누르는 메인 화면.
 *
 * 화면 본체는 `/` 와 같은 것을 쓰고, 로그인 버튼과 하단 탭의 동행이
 * 여기서만 켜진다. 그 둘이 와이어프레임 화면으로 이어지기 때문이다.
 *
 * 온보딩이 `/` 를 가리키면 팀이 그것들을 볼 수가 없었다. duckmoim.com 은
 * 와이어프레임 플래그 없이 빌드되어서, 눌러도 로그인 버튼이 없는 실서비스
 * 화면이 나왔다.
 *
 * 색인을 막는다. 같은 목록이 두 주소에 있으면 검색엔진이 어느 쪽을 본체로
 * 볼지 정해야 하고, 그 판단이 우리 뜻과 다를 수 있다. 실서비스 유입이
 * 롱테일 검색이라 그 위험을 질 이유가 없다.
 *
 * 진짜 로그인이 붙고 동행이 실서비스로 열리면 이 파일을 지운다.
 */
export const metadata: Metadata = {
  title: '지도 · 목록 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <HomeApp wireframe />
}
