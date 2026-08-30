import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
  },
}

export default nextConfig
