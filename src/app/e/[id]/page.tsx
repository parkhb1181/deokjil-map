import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import rawEvents from '@/data/events.json'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'

/**
 * 이벤트 상세, 검색에 걸리는 실주소.
 *
 * 앱은 해시 라우팅(#/e/id)이라 색인 가능한 URL이 홈 하나뿐이었다.
 * 프래그먼트는 검색엔진이 별도 페이지로 보지 않으므로 192건 전부가
 * 검색에 존재하지 않는 상태였다. 이 라우트가 그 192개를 만든다.
 *
 * 이 사이트의 유입은 대부분 롱테일이다. "태민 생일카페 홍대" 같은 검색이
 * 홈이 아니라 그 이벤트 페이지로 들어와야 한다.
 *
 * 해시 라우팅은 그대로 둔다. 앱 안에서 상세를 여는 경로는 뒤로가기 때문에
 * 해시가 맞고(route.ts 주석), 이 페이지는 공유·검색용 입구다.
 * route.ts 는 'use client' 라 서버 컴포넌트에서 함수를 부를 수 없어
 * 해시 문자열을 여기서 직접 만든다.
 *
 * 포스터 이미지를 싣지 않는다. CLAUDE.md, "앱에는 사실 정보(장소·기간·시간)만
 * 싣고 원문 링크를 반드시 노출한다. 일정은 저작물이 아니지만 포스터는 저작물이다."
 * 클래스는 globals.css 의 기존 어휘(sheet/dlist/drow)를 그대로 쓴다 
 * 새 CSS 를 만들면 상세 화면이 두 벌이 되고 톤이 갈린다.
 */

const ALL = rawEvents as EventItem[]

// 데이터에 없는 id 는 404 로 떨어뜨린다. 동적 렌더를 허용하면 존재하지 않는
// 주소가 200 을 돌려주고 색인에 쓰레기가 쌓인다
export const dynamicParams = false

export function generateStaticParams() {
  return ALL.map((e) => ({ id: e.id }))
}

function find(id: string): EventItem | undefined {
  return ALL.find((e) => e.id === decodeURIComponent(id))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const ev = find(id)
  if (!ev) return {}

  const title = `${ev.subject} ${EVENT_KIND_LABELS[ev.kind]} · ${
    DISTRICT_LABELS[ev.place.district]
  } ${ev.place.name}`
  const description = `${ev.starts_on} ~ ${ev.ends_on} · ${ev.place.address}${
    ev.perks ? ` · ${ev.perks}` : ''
  }`

  return {
    title,
    description,
    alternates: { canonical: `/e/${encodeURIComponent(ev.id)}` },
    openGraph: { type: 'article', title, description, locale: 'ko_KR' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ev = find(id)
  if (!ev) notFound()

  const kind = EVENT_KIND_LABELS[ev.kind]
  const district = DISTRICT_LABELS[ev.place.district]

  // 이벤트 사이트라 구조화 데이터가 크게 먹힌다.
  // 장소·기간이 이미 데이터에 있어 지어낼 것이 없다. 없는 필드는 넣지 않는다
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: ev.title ?? `${ev.subject} ${kind}`,
    startDate: ev.starts_on,
    endDate: ev.ends_on,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: ev.place.name,
      address: { '@type': 'PostalAddress', streetAddress: ev.place.address, addressCountry: 'KR' },
      geo: { '@type': 'GeoCoordinates', latitude: ev.place.lat, longitude: ev.place.lng },
    },
    ...(ev.perks ? { description: ev.perks } : {}),
  }

  const rows: [string, string][] = [
    ['장소', ev.place.name],
    ['주소', ev.place.address],
    ['기간', `${ev.starts_on} ~ ${ev.ends_on}`],
  ]
  if (ev.open_hours) rows.push(['운영 시간', ev.open_hours])
  if (ev.perks) rows.push(['특전', ev.perks])
  if (ev.conditions) rows.push(['조건', ev.conditions])
  if (ev.goods.length > 0) rows.push(['굿즈', ev.goods.map((g) => g.name).join(' · ')])

  return (
    <div className="app">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="main">
        <article className="sheet">
          {/* 대표 사진.
              우리가 복제해 두는 것이 아니라 원본 서버 주소를 그대로
              들고 있는다. 모집글 목록·상세와 같은 방식이다.

              비율은 모집글 상세와 같은 4:5 다. 들어오는 포스터가 1:1 에서
              3:4 사이의 세로형이라 가로로 자르면 절반도 안 보인다.
              잘린다면 아래가 잘리게 위를 붙든다 */}
          {ev.image_url && (
            <img className="sheet__poster" src={ev.image_url} alt="" />
          )}

          <div className="sheet__head">
            <h1>{ev.subject}</h1>
            <p className="sheet__address">
              {kind} · {district} · {ev.place.name}
            </p>
            {ev.title && <p className="sheet__address">{ev.title}</p>}
          </div>

          <div className="sheet__body">
            <div className="dlist">
              {rows.map(([label, value]) => (
                <div className="drow" key={label}>
                  <span className="drow__label">{label}</span>
                  <span className="drow__value">{value}</span>
                </div>
              ))}
            </div>

            {/* 출처 표기는 상시다 (poc-plan 1번, 정합성 교란 방어).
                listing_url 은 화면에 노출하지 않는다. 경쟁 리스팅을 광고하지 않는다 */}
            {/* 동행글 블록 (EV-07).
                이 행사에 같이 갈 사람을 구하는 글이 있는지 여기서 알려준다.
                목록까지 들어가야 알 수 있으면 아무도 안 들어간다.
                아직 API 가 없어 건수를 0 으로 두고 권유만 띄운다.
                붙으면 최근 5건을 여기에 늘어놓는다 */}
            <section className="withus">
              <h3 className="withus__title">같이 갈 사람 구하기</h3>
              <p className="withus__desc">
                아직 이 행사에 올라온 동행글이 없어요.
                <br />
                처음으로 같이 갈 사람을 구해보세요.
              </p>
              <a className="btn btn--primary btn--sm withus__go" href="/p">
                동행글 보러 가기
              </a>
            </section>

            <p className="sheet__disclaimer">주최자 공지 기반 · 방문 전 원문 확인 권장</p>

            <p className="sheet__original">
              <a href={ev.source_url} target="_blank" rel="noopener noreferrer nofollow">
                원문 보기
              </a>
              {ev.reservation_url && (
                <>
                  {' · '}
                  <a href={ev.reservation_url} target="_blank" rel="noopener noreferrer nofollow">
                    예약하기
                  </a>
                </>
              )}
              {' · '}
              <a href={`/#/e/${encodeURIComponent(ev.id)}`}>지도에서 보기</a>
              {' · '}
              <a href="/">전체 목록</a>
            </p>
          </div>
        </article>
      </main>
    </div>
  )
}
