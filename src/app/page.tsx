import HomeApp from '@/components/HomeApp'

/**
 * 실서비스 메인.
 *
 * 화면 본체는 `components/HomeApp.tsx` 에 있고 `/w4871/home` 과 같은
 * 것을 쓴다. 여기서는 껍데기만 고른다. 헤더와 탭 셋이다.
 */
export default function Page() {
  return <HomeApp chrome="header" />
}
