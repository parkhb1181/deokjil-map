import type { MetadataRoute } from 'next'
import rawEvents from '@/data/events.json'
import type { EventItem } from '@/types'
import { siteUrl } from '@/lib/site'
import { shareSlug } from '@/lib/subject-slug'

/**
 * 사이트맵.
 *
 * events.json 은 to-events.mjs 가 종료된 건을 걸러낸 결과라
 * 여기서 다시 거르지 않는다 (CLAUDE.md, 필터·정규화 양쪽에서 걸러진다).
 * 빌드타임 정적 생성이므로 데이터가 갱신되면 재배포가 곧 사이트맵 갱신이다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const events = rawEvents as EventItem[]

  // 대상별 목록. 롱테일 검색("정국 생일카페")이 홈이 아니라 여기로 들어와야 한다.
  // 개별 이벤트보다 상위로 둔다. 한 대상에 여러 곳이 걸리는 쪽이 답에 가깝다
  const subjects = [...new Set(events.map((e) => e.subject.trim()).filter(Boolean))]

  return [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    ...subjects.map((s) => ({
      url: `${siteUrl}/a/${shareSlug(s)}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...events.map((e) => ({
      url: `${siteUrl}/e/${encodeURIComponent(e.id)}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ]
}
