import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

/**
 * robots.txt.
 *
 * 막을 것이 없다 — 로그인도 사용자 데이터도 없는 정적 사이트다.
 * 사이트맵 위치를 명시하는 것이 이 파일의 실질적인 일이다.
 * 네이버 Yeti 는 사이트맵 제출을 별도로 받지만, robots 에도 적어두면
 * 서치어드바이저에 넣기 전에도 발견될 수 있다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
