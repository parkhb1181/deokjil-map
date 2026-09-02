import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * 와이어프레임 깃발에 **기본값을 박는다.**
   *
   * 정의되지 않은 NEXT_PUBLIC_* 은 빌드 때 문자열로 치환되지 않고
   * process.env 조회로 남는다. 그러면 조건이 접히지 않아서, 꺼진
   * 배포인데도 콘서트 목데이터 JSON 이 홈 청크에 실려 나갔다.
   * 화면에는 안 나오는데 방문자가 받아가고 있었다.
   *
   * 여기서 '0' 을 채워두면 조건이 빌드 때 false 로 접히고 가짜 데이터가
   * 통째로 떨어져 나간다. 켜려면 NEXT_PUBLIC_WIREFRAME=1 로 빌드한다.
   */
  env: {
    NEXT_PUBLIC_WIREFRAME: process.env.NEXT_PUBLIC_WIREFRAME ?? '0',
  },
  /**
   * sharp 는 네이티브 바인딩이라 번들에 넣으면 깨진다.
   * OG 이미지 생성에서 수집원 사진을 줄이는 데 쓴다.
   */
  serverExternalPackages: ['sharp'],
  /**
   * 수집원 이미지는 원본이 장당 수 MB 다(offmate 기준 1.8~8.4MB).
   * 그대로 물리면 목록 한 번 내리는 데 수백 MB 가 나가고, 사진이 늦게 떠서
   * 화면이 회색 네모로 남는 시간이 길어진다. 최적화를 켜서 카드 크기에 맞게
   * 줄여 받는다. 원본을 우리 쪽에 저장하지는 않는다.
   */
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img2.offmate.kr' },
      { protocol: 'https', hostname: 'cdn.popga.co.kr' },
    ],
    formats: ['image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    /**
     * **폭 후보를 줄인다.**
     *
     * 기본값은 deviceSizes 8개 + imageSizes 8개다. `sizes` 를 주면
     * next/image 가 그 16개를 전부 srcset 에 넣고, 기기와 화면 배율에
     * 따라 브라우저가 골라 간다. 실제로 홈을 열어 세어보니 원본 180장에
     * 폭 15가지, **조합 2,700개**가 후보로 잡혀 있었다.
     *
     * 조합 하나가 곧 변환 한 건이다. 3840px 은 아무도 안 쓰는데 후보에
     * 들어 있고, 4.9MB 짜리를 3840 으로 늘리는 것이 제일 비싸다.
     *
     * 화면에서 이 사진을 쓰는 자리는 셋뿐이다.
     *   카드 썸네일   240px
     *   1위 카드      420px
     *   순위 작은 칸  120px
     *
     * 420px 을 고밀도 화면에서 봐도 1080 이면 2.5배라 남는다. 그 위는
     * 만들 이유가 없다. 아래 일곱 가지면 세 자리를 1배·2배·3배로 다 덮는다.
     */
    deviceSizes: [640, 828, 1080],
    imageSizes: [128, 256, 384, 480],
  },
  /**
   * 소개 페이지는 받아온 시안을 그대로 쓴다. 색·글꼴·레이아웃을 손대지
   * 않기로 했으므로 정적 HTML 한 장을 public/intro/ 에 두고 서빙한다.
   * public 의 파일은 경로 그대로만 나가서 /intro 로는 안 잡힌다.
   * 여기서 /intro 를 그 파일로 연결한다.
   */
  async rewrites() {
    return [{ source: '/intro', destination: '/intro/index.html' }]
  },
}

export default nextConfig
