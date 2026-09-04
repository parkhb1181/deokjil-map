import HomeApp from '@/components/HomeApp'
import { getAllEvents } from '@/lib/events-source'
import { IS_WIREFRAME } from '@/lib/wireframe'

/**
 * 실서비스 메인.
 *
 * 화면 본체는 `components/HomeApp.tsx` 에 있고 `/w4871/home` 과 같은
 * 것을 쓴다.
 *
 * 로그인 버튼과 동행 탭은 아직 와이어프레임 화면으로 이어져서, 진짜
 * 방문자에게 그리면 가짜 로그인과 가짜 모집글로 보낸다. 그래서 여기서는
 * 빌드 플래그를 따른다. 로컬과 미리보기 배포에서는 켜지고 실제 배포에서는
 * 꺼진다. 진짜 로그인이 붙으면(AU-01) 이 값을 참으로 고정한다.
 */
export default async function Page() {
  return <HomeApp wireframe={IS_WIREFRAME} events={await getAllEvents()} />
}
