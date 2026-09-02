import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_EVENTS } from '@/lib/events-source'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'
import { IS_WIREFRAME } from '@/lib/wireframe'
import { PlaceActions } from '@/components/ui/PlaceActions'
import { PlaceMap } from '@/components/ui/PlaceMap'
import { SaveHeart } from '@/components/ui/SaveHeart'
import { wf } from '@/lib/wireframe'

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

const ALL = ALL_EVENTS

// 데이터에 없는 id 는 404 로 떨어뜨린다. 동적 렌더를 허용하면 존재하지 않는
// 주소가 200 을 돌려주고 색인에 쓰레기가 쌓인다
export const dynamicParams = false

export function generateStaticParams() {
  return ALL.map((e) => ({ id: e.id }))
}

/** '2026-08-21' → '8월 21일 (금)' */
function dateText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = '일월화수목금토'[new Date(y, m - 1, d).getDay()]
  return `${m}월 ${d}일 (${dow})`
}

/**
 * 검색엔진에 주는 한 줄 설명.
 *
 * 서치 콘솔이 구조화 데이터의 description 이 비었다고 알려왔다.
 * 전에는 특전이 있을 때만 넣었고, 그것도 특전 문자열을 그대로
 * 넣은 것이라 211건 중 11건이 아예 비어 있었다.
 *
 * **지어내지 않는다.** 여기 들어가는 것은 전부 수집한 값이고,
 * 없는 필드는 문장에서 통째로 빠진다. 장소와 기간은 늘 있으므로
 * 최소한 첫 문장은 언제나 만들어진다.
 *
 * 페이지 메타 설명도 이 함수를 쓴다. 둘을 따로 만들어 두었더니
 * 한쪽은 '2026-09-05 ~ 2026-09-07' 처럼 기계가 읽는 날짜였다.
 * 같은 페이지를 두 가지로 설명할 이유가 없다.
 */
function describe(ev: EventItem): string {
  const kind = EVENT_KIND_LABELS[ev.kind]
  const district = DISTRICT_LABELS[ev.place.district]
  const oneDay = ev.startsOn === ev.endsOn
  const when = oneDay
    ? dateText(ev.startsOn)
    : `${dateText(ev.startsOn)} ~ ${dateText(ev.endsOn)}`

  const head = `${district} ${ev.place.name}에서 ${when} 열리는 ${ev.subject} ${kind}입니다.`

  /* 콘서트만 시작 시각을 갖는다. 그 시각에 못 가면 끝이라 운영시간보다
     앞이다. 지금 데이터에는 콘서트가 없지만 KOPIS 가 붙으면 들어온다 */
  const facts = [
    ev.startsAt ? `${ev.startsAt} 시작` : ev.openHours ? `${ev.openHours} 운영` : null,
    ev.perks,
    ev.conditions,
    ev.place.address,
  ].filter(Boolean)

  return `${head} ${facts.join(' · ')}`
}

/**
 * 두 지점 사이 거리(km). 하버사인.
 *
 * 서울 안에서만 쓰므로 소수점 한 자리면 충분하다. 근처 행사를 가까운
 * 순으로 세우는 데만 쓰고 길 안내로는 쓰지 않는다. 직선거리라 실제로
 * 걷는 거리와는 다르다.
 */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
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
  const description = describe(ev)

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

  /* 이벤트 사이트라 구조화 데이터가 크게 먹힌다.
     장소·기간이 이미 데이터에 있어 지어낼 것이 없다. 없는 필드는 넣지 않는다.

     **image 를 넣지 않는다.** 서치 콘솔이 그것도 권장 필드라고 하지만,
     넣는 순간 "이 사진을 이 행사의 대표 이미지로 써라" 고 구글에 말하는
     것이 되고 구글이 그걸 받아 캐시한다. 포스터는 저작물이라 재게시하지
     않는다는 규칙(CLAUDE.md)에 걸린다. 화면에서 원본 주소를 그대로
     가리키는 것과는 다른 일이다.

     offers · organizer · performer 도 안 넣는다. 가진 값이 없다.
     빈 값으로 채우면 경고가 사라지는 대신 사실이 아닌 것이 남는다 */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: ev.title ?? `${ev.subject} ${kind}`,
    startDate: ev.startsOn,
    endDate: ev.endsOn,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: ev.place.name,
      address: { '@type': 'PostalAddress', streetAddress: ev.place.address, addressCountry: 'KR' },
      geo: { '@type': 'GeoCoordinates', latitude: ev.place.lat, longitude: ev.place.lng },
    },
    /* 늘 넣는다. 전에는 특전이 있을 때만 넣어서 211건 중 11건이
       비었고 서치 콘솔이 그걸 짚었다 */
    description: describe(ev),
  }

  /* 하루짜리면 한 날짜만 적는다. "9월 19일 ~ 9월 19일" 은 두 번
     읽어야 같은 날인 것을 안다. 콘서트가 대부분 하루다 */
  const oneDay = ev.startsOn === ev.endsOn
  const when = oneDay ? dateText(ev.startsOn) : `${dateText(ev.startsOn)} ~ ${dateText(ev.endsOn)}`

  /* 특전·조건·굿즈를 한 줄 문자열이 아니라 칩으로 쪼갠다. 덕플레이스가
     그렇게 두는데, 줄글이면 "선착 100명 컵홀더 + 포토카드, 음료 1잔
     주문" 을 끝까지 읽어야 무엇을 주는지 안다. 칩이면 훑고 지나간다.
     수집원이 쉼표·가운뎃점·플러스로 나열해 온다 */
  const chips = (v?: string) =>
    (v ?? '')
      /* 쉼표 뒤에 숫자가 오면 자르지 않는다. 천 단위 구분이라서다.
         그냥 [,·+] 로 잘랐더니 "100,000원 이상 구매 시" 가 "100" 과
         "000원 이상 구매 시" 두 칩으로 갈렸다 */
      .split(/[·+]|,(?!d)/)
      .map((x) => x.trim())
      .filter(Boolean)

  /**
   * 칩으로 세울 수 있는 길이.
   *
   * 실제 데이터를 재보니 조각 길이 중앙값이 5자("특전 6종")이고 96%가
   * 20자 안이다. 나머지 4%는 "구매 고객: 100,000원 이상 구매 시" 처럼
   * 문장이라 알약 모양에 넣으면 세 줄짜리 칩이 된다. 그것만 아래에
   * 줄글로 뺀다.
   */
  const CHIP_MAX = 24
  const all = chips(ev.perks)
  const perks = all.filter((x) => x.length <= CHIP_MAX)
  const perkNotes = all.filter((x) => x.length > CHIP_MAX)
  const conditions = chips(ev.conditions).filter((x) => x.length <= CHIP_MAX)
  const condNotes = chips(ev.conditions).filter((x) => x.length > CHIP_MAX)

  /* 같은 구역의 다른 행사. 생카는 하루에 여러 곳을 도는 사람이 많아서
     "여기 말고 근처에 뭐가 더 있나" 가 다음 질문이다. 가까운 순으로
     넷만 둔다. 거리는 좌표로 잰다 */
  const nearby = ALL_EVENTS
    .filter((e) => e.id !== ev.id && e.place.district === ev.place.district)
    .map((e) => ({ e, km: distanceKm(ev.place, e.place) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 4)

  return (
    <div className="app">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="main">
        <article className="sheet sheet--page">
          {/* 대표 사진.
              우리가 복제해 두는 것이 아니라 원본 서버 주소를 그대로
              들고 있는다. 모집글 목록·상세와 같은 방식이다.

              비율은 모집글 상세와 같은 4:5 다. 들어오는 포스터가 1:1 에서
              3:4 사이의 세로형이라 가로로 자르면 절반도 안 보인다.
              잘린다면 아래가 잘리게 위를 붙든다 */}
          {ev.imageUrl && (
            <img className="sheet__poster" src={ev.imageUrl} alt="" />
          )}

          <div className="sheet__head">
            {/* 구역과 유형을 배지로 올린다. 전에는 "팝업 · 여의도 ·
                더현대" 한 줄이었는데, 셋이 같은 무게라 어디까지가
                유형이고 어디부터 장소인지 눈으로 안 끊겼다 */}
            <p className="evt__tags">
              <span className="state state--off">{district}</span>
              <span className="state state--off">{kind}</span>
            </p>
            {/* 하트를 제목 오른쪽에 둔다. 검색으로 이 페이지에 바로
                들어온 사람이 이 서비스에서 처음 만나는 행동이 담기라,
                여기 없으면 담으려고 홈으로 돌아가 같은 행사를 다시
                찾아야 한다 */}
            <div className="evt__title">
              <h1>{ev.subject}</h1>
              <SaveHeart event={ev} />
            </div>
            {ev.title && <p className="evt__sub">{ev.title}</p>}
          </div>

          <div className="sheet__body">
            {/* 기간이 제일 큰 글자다. 생카·팝업에서 먼저 확인하는 것이
                "지금 가도 되나" 다. 장소는 그다음이고, 안 열려 있으면
                장소는 볼 이유가 없다 */}
            <div className="evt__when">
              <p className="evt__date">{when}</p>
              {ev.startsAt && <p className="evt__time">{ev.startsAt} 시작</p>}
              {ev.openHours && <p className="evt__time">{ev.openHours}</p>}
            </div>

            {/* 장소와 주소, 그리고 여기서 실제로 하는 일 둘.
                주소를 글자로만 두면 길게 눌러 드래그해야 복사가 된다 */}
            <div className="evt__place">
              <p className="evt__pname">{ev.place.name}</p>
              <p className="evt__paddr">{ev.place.address}</p>
              <PlaceActions
                name={ev.place.name}
                address={ev.place.address}
                lat={ev.place.lat}
                lng={ev.place.lng}
              />
            </div>

            <div className="evt__map">
              <PlaceMap lat={ev.place.lat} lng={ev.place.lng} label={ev.place.name} />
            </div>

            {/* 특전·조건·굿즈를 칩으로. 줄글이면 끝까지 읽어야 무엇을
                주는지 아는데, 칩이면 훑고 지나간다 */}
            {(perks.length > 0 || perkNotes.length > 0) && (
              <section className="evt__sec">
                <h2 className="evt__h">특전</h2>
                {perks.length > 0 && (
                  <p className="evt__chips">
                    {perks.map((x) => (
                      <span className="evt__chip" key={x}>{x}</span>
                    ))}
                  </p>
                )}
                {perkNotes.map((x) => (
                  <p className="evt__note" key={x}>{x}</p>
                ))}
              </section>
            )}

            {ev.goods.length > 0 && (
              <section className="evt__sec">
                <h2 className="evt__h">굿즈</h2>
                <p className="evt__chips">
                  {ev.goods.map((g) => (
                    <span className="evt__chip" key={g.id}>
                      {g.name}
                      {/* 랜덤 품목은 "품절" 이 아니라 "지금 뭐가 나오나" 가
                          관심사다 (types.ts). 그래서 따로 표시한다 */}
                      {g.isRandom && <em className="evt__rand">랜덤</em>}
                    </span>
                  ))}
                </p>
              </section>
            )}

            {(conditions.length > 0 || condNotes.length > 0) && (
              <section className="evt__sec">
                <h2 className="evt__h">조건</h2>
                {conditions.length > 0 && (
                  <p className="evt__chips">
                    {conditions.map((x) => (
                      <span className="evt__chip evt__chip--cond" key={x}>{x}</span>
                    ))}
                  </p>
                )}
                {condNotes.map((x) => (
                  <p className="evt__note" key={x}>{x}</p>
                ))}
              </section>
            )}

            {/* 동행글 블록 (EV-07).
                이 행사에 같이 갈 사람을 구하는 글이 있는지 여기서 알려준다.
                목록까지 들어가야 알 수 있으면 아무도 안 들어간다.

                배경을 칠하지 않는다. 통째로 분홍이면 이 블록이 정작
                위의 장소·기간보다 먼저 눈에 들어온다. 색은 버튼에만
                준다. 눌러야 하는 것이 그것 하나뿐이다.

                아직 API 가 없어 건수를 0 으로 두고 권유만 띄운다.
                붙으면 최근 5건을 여기에 늘어놓는다 */}
            {IS_WIREFRAME && (
            <section className="withus">
              <h3 className="withus__title">같이 갈 사람 구하기</h3>
              <p className="withus__desc">아직 이 행사에 올라온 동행글이 없어요.</p>
              <a className="btn btn--primary btn--block" href={wf('/p')}>
                동행글 보러 가기
              </a>
            </section>
            )}

            {/* 출처 표기는 상시다 (poc-plan 1번, 정합성 교란 방어).
                listingUrl 은 화면에 노출하지 않는다. 경쟁 리스팅을 광고하지 않는다 */}

            {/* 근처 행사. 생카는 하루에 여러 곳을 도는 사람이 많아서
                "여기 말고 근처에 뭐가 더 있나" 가 다음 질문이다.
                덕플레이스도 상세 아래에 거리와 함께 늘어놓는다.

                구역 안에서만 고른다. 서울 전체에서 가까운 순으로 뽑으면
                구를 넘나드는 목록이 되어 하루에 못 돈다 */}
            {nearby.length > 0 && (
              <section className="evt__sec">
                <h2 className="evt__h">근처에서 열려요</h2>
                <ul className="near">
                  {nearby.map(({ e, km }) => (
                    <li key={e.id}>
                      <a className="near__row" href={`/e/${encodeURIComponent(e.id)}`}>
                        <span className="near__main">
                          <span className="near__name">{e.subject}</span>
                          <span className="near__where">{e.place.name}</span>
                        </span>
                        {/* 1km 아래는 m 로. "0.3km" 보다 "300m" 가 걸어갈
                            거리라는 것이 바로 읽힌다 */}
                        <span className="near__km">
                          {km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="sheet__disclaimer">주최자 공지 기반 · 방문 전 원문 확인 권장</p>

            <p className="sheet__original">
              <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                원문 보기
              </a>
              {ev.reservationUrl && (
                <>
                  {' · '}
                  <a href={ev.reservationUrl} target="_blank" rel="noopener noreferrer nofollow">
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
