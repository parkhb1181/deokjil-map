import type { Metadata } from 'next'
import Admin from './Admin'
import { wireframeOnly } from '@/lib/wireframe'

/**
 * 백오피스.
 *
 * 명세가 최소한만 만들라고 못박은 화면이다 (5-6 범위 원칙).
 * 별도 계정과 접근 제한이 필요한데 구현 방식은 아직 미결이다 (Q-13).
 *
 * 주소 끝의 숫자는 **보안이 아니라 자물쇠 모양이다.** 링크를 아는
 * 사람은 그대로 들어온다. 온보딩용 데모라 제재할 사람도 신고할
 * 글도 없어서 이 정도로 둔다. 지나가다 열리는 것만 막으면 된다.
 *
 * 진짜 인증이 붙기 전에 실서비스로 배포하면 안 된다. 숫자를
 * 늘린다고 나아지지 않는다. 서버가 누구인지 확인해야 한다.
 *
 * 링크는 /onboarding 에만 적어둔다. 팀은 거기서 찾는다.
 */
export const metadata: Metadata = {
  title: '백오피스 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  /* 실서비스 배포에서는 404 다 (lib/wireframe.ts) */
  wireframeOnly()

  return <Admin />
}
