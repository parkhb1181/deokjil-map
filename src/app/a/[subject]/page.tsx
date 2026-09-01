import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ALL_EVENTS } from '@/lib/events-source'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'
import { SUBJECT_SLUGS, resolveSubject } from '@/lib/subject-slug'

/**
 * 대상별 목록, 공유와 검색에 쓰는 실주소.
 *
 * 앱 안에서 대상을 거르는 경로는 해시(#/q/정국)다. 해시는 서버로 전달되지
 * 않으므로 그 링크를 커뮤니티에 뿌리면 어느 대상이든 미리보기가 홈 하나로
 * 똑같이 뜬다. "정국 22곳" 이라 써 놓은 글에 홈 이미지가 붙는다.
 * 이 라우트가 대상마다 별도 주소와 별도 OG 이미지를 만든다.
 *
 * 해시 라우팅은 그대로 둔다. 앱 안에서 필터를 거는 경로는 뒤로가기 때문에
 * 해시가 맞고, 이 페이지는 밖에서 들어오는 입구다.
 * route.ts 는 'use client' 라 서버 컴포넌트에서 부를 수 없어
 * 해시 문자열을 여기서 직접 만든다.
 *
 * 포스터를 싣지 않는다. CLAUDE.md, "일정은 저작물이 아니지만 포스터는 저작물이다."
 * 클래스는 globals.css 의 기존 어휘(sheet/dlist/drow)를 그대로 쓴다.
 */

const ALL = ALL_EVENTS

export const dynamicParams = false

/** 대상명 → 그 대상의 이벤트. 대소문자·앞뒤 공백만 정리해서 묶는다 */
function bySubject(): Map<string, EventItem[]> {
  const m = new Map<string, EventItem[]>()
  for (const ev of ALL) {
    const key = ev.subject.trim()
    if (!key) continue
    const list = m.get(key)
    if (list) list.push(ev)
    else m.set(key, [ev])
  }
  return m
}

export function generateStaticParams() {
  // 한글 주소와 ASCII 별칭 둘 다 만든다. X 가 한글 앞에서 링크를 끊는다
  const keys = [...bySubject().keys()]
  const out = keys.map((subject) => ({ subject }))
  for (const [subject, slug] of Object.entries(SUBJECT_SLUGS)) {
    if (keys.includes(subject)) out.push({ subject: slug })
  }
  return out
}

function find(raw: string): { subject: string; events: EventItem[] } | null {
  const subject = resolveSubject(raw)
  const events = bySubject().get(subject)
  if (!events) return null
  // 마감 임박 순. 목록 화면과 같은 축이라야 두 화면이 같은 것을 말한다
  return { subject, events: [...events].sort((a, b) => a.ends_on.localeCompare(b.ends_on)) }
}

/** 지역별 개수를 많은 순으로. "홍대 12 · 용산 9" */
function districtSummary(events: EventItem[]): string {
  const c = new Map<string, number>()
  for (const ev of events) c.set(ev.place.district, (c.get(ev.place.district) ?? 0) + 1)
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([d, n]) => `${DISTRICT_LABELS[d as keyof typeof DISTRICT_LABELS] ?? d} ${n}`)
    .join(' · ')
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>
}): Promise<Metadata> {
  const { subject: raw } = await params
  const hit = find(raw)
  if (!hit) return {}

  const { subject, events } = hit
  const kinds = new Set(events.map((e) => e.kind))
  const kindLabel =
    kinds.size === 1 ? EVENT_KIND_LABELS[events[0].kind] : '생카·팝업'

  // 이름 뒤에 단위를 붙이지 않는다. 세는 대상은 카페인데 '정국 22곳' 은
  // 정국을 센 것처럼 읽힌다. 유형을 사이에 넣어 무엇을 세는지 분명히 한다
  const title = `${subject} ${kindLabel} ${events.length}`
  const description = `${districtSummary(events)}. 장소와 기간을 지도와 목록으로 모아 봅니다. 매일 갱신.`

  return {
    title,
    description,
    alternates: { canonical: `/a/${encodeURIComponent(subject)}` },
    openGraph: { type: 'website', title, description, locale: 'ko_KR' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>
}) {
  const { subject: raw } = await params
  const hit = find(raw)
  if (!hit) notFound()

  const { subject, events } = hit
  const kinds = new Set(events.map((e) => e.kind))
  const kindLabel = kinds.size === 1 ? EVENT_KIND_LABELS[events[0].kind] : '생카·팝업'

  // 목록형 구조화 데이터. 개별 이벤트의 상세는 /e/{id} 가 이미 Event 로 내보내고
  // 있으므로 여기서는 그쪽을 가리키기만 한다. 같은 사실을 두 번 주장하지 않는다
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${subject} 생일카페·팝업`,
    numberOfItems: events.length,
    itemListElement: events.map((ev, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${ev.place.name} (${DISTRICT_LABELS[ev.place.district]})`,
      url: `/e/${encodeURIComponent(ev.id)}`,
    })),
  }

  return (
    <div className="app">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="main">
        {/* /e/[id] 와 같은 통짜 페이지다. sheet 는 원래 앱 안에서 위로
            덮는 시트라 position: fixed 인데, 그대로 두면 목록이 화면
            높이에 갇혀 아래가 잘린다 */}
        <article className="sheet sheet--page">
          <div className="sheet__head">
            <h1>
              {subject} {kindLabel}
              <span className="sheet__n">{events.length}</span>
            </h1>
            <p className="sheet__address">{districtSummary(events)}</p>
          </div>

          <div className="sheet__body">
            <div className="dlist">
              {events.map((ev) => (
                <div className="drow" key={ev.id}>
                  <span className="drow__label">
                    {DISTRICT_LABELS[ev.place.district]}
                  </span>
                  <span className="drow__value">
                    <a href={`/e/${encodeURIComponent(ev.id)}`}>{ev.place.name}</a>
                    {' · '}
                    {EVENT_KIND_LABELS[ev.kind]}
                    {' · '}~{ev.ends_on}
                    {ev.perks ? ` · ${ev.perks}` : ''}
                  </span>
                </div>
              ))}
            </div>

            <p className="sheet__disclaimer">주최자 공지 기반 · 방문 전 원문 확인 권장</p>

            <p className="sheet__original">
              <a href={`/#/q/${encodeURIComponent(subject)}`}>지도에서 보기</a>
              {' · '}
              <a href="/">전체 목록</a>
            </p>
          </div>
        </article>
      </main>
    </div>
  )
}
