import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS, groupByDistrict } from '@/lib/filters'

/**
 * 프리렌더 시점에 나가는 목록.
 *
 * 오늘 날짜는 마운트 이후에 확정된다(page.tsx 주석, 빌드 시각을 쓰면 배포
 * 다음날부터 하이드레이션이 어긋난다). 그 결과 프리렌더된 HTML 이
 * "불러오는 중…" 한 줄이었고, 검색엔진이 보는 화면이 그것뿐이었다.
 * 실측으로 index.html 10KB 에 이벤트 192건 중 0건이 들어 있었다.
 *
 * 그래서 그 자리를 스피너 대신 전체 목록으로 채운다. 크롤러는 192건과
 * 각 상세로 가는 내부 링크를 보고, 사용자는 마운트 직후 오늘 기준 화면으로
 * 바뀐다. 하이드레이션은 서버와 클라이언트 첫 렌더가 같으므로 어긋나지 않는다.
 *
 * 내부 링크가 사이트맵만큼 중요하다. 사이트맵은 발견을 돕고,
 * 링크는 그 페이지가 사이트의 일부라는 신호가 된다.
 */
export default function SeoIndex({ events }: { events: EventItem[] }) {
  const groups = groupByDistrict(events).filter((g) => g.events.length > 0)

  return (
    <div className="seoindex">
      {groups.map(({ district, events: list }) => (
        <section className="section" key={district}>
          <div className="section__head">
            <div className="section__headtext">
              <h2 className="section__title">{DISTRICT_LABELS[district]}</h2>
              <p className="section__note">{list.length}곳</p>
            </div>
          </div>
          <ul className="seoindex__list">
            {list.map((ev) => (
              <li key={ev.id}>
                <a href={`/e/${encodeURIComponent(ev.id)}`}>
                  {ev.subject} {EVENT_KIND_LABELS[ev.kind]} · {ev.place.name} ·{' '}
                  {ev.starts_on}~{ev.ends_on}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
