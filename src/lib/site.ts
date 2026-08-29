/**
 * 배포 주소 한 곳.
 *
 * layout.tsx 안에 있던 계산을 꺼냈다. sitemap·robots 도 같은 값을 써야 하는데
 * 각자 갖고 있으면 도메인을 살 때 한 군데를 빠뜨린다 — 그러면 사이트맵이
 * 옛 주소를 가리키고, 검색엔진은 그 주소를 계속 긁는다.
 *
 * 우선순위: 직접 지정 > Vercel 이 넣어주는 프로덕션 도메인 > 로컬.
 * 도메인을 사면 Vercel 환경변수 NEXT_PUBLIC_SITE_URL 만 바꾸면 된다.
 */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000'
