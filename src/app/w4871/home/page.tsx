import type { Metadata } from 'next'
import HomeApp from '@/components/HomeApp'

/**
 * 메인 화면의 새 껍데기를 보는 자리.
 *
 * 헤더를 걷어내고 로고를 검색줄로 내린 두 칸 구조다. 하단 탭에 동행이
 * 들어가 넷이 된다.
 *
 * 실서비스(`/`)와 화면 본체를 공유한다. 여기서 좋아 보이면 `app/page.tsx`
 * 의 `chrome` 을 `brand` 로 바꾸는 것으로 끝난다. 그때 이 파일을 지운다.
 *
 * 색인을 막는다. 같은 목록이 두 주소에 있으면 검색엔진이 어느 쪽을
 * 본체로 볼지 정해야 하고, 그 판단이 우리 뜻과 다를 수 있다. 실서비스
 * 유입이 롱테일 검색이라 그 위험을 질 이유가 없다.
 */
export const metadata: Metadata = {
  title: '메인 (새 껍데기) · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <HomeApp chrome="brand" />
}
