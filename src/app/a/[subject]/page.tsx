import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllEvents } from '@/lib/events-source'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'
import { SUBJECT_SLUGS, resolveSubject } from '@/lib/subject-slug'
import { knownSubject, knownSubjectNames } from '@/lib/known-subjects'
import { SubjectList } from './SubjectList'

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
 * **행사가 끝나도 주소는 산다.** events.json 은 끝난 것을 지우므로 그것만
 * 보고 주소를 만들면 마지막 생카가 끝난 날 페이지가 통째로 사라진다. 이미
 * 뿌린 링크가 전부 404 가 된다는 뜻이다. 그래서 원장(known-subjects)에
 * 이름을 남겨 두고, 열린 곳이 없으면 빈 화면을 보여준다. 지난 행사를
 * 목록에 되살리는 것이 아니다 — 끝났다고 알리는 화면이다.
 *
 * 포스터를 싣지 않는다. CLAUDE.md, "일정은 저작물이 아니지만 포스터는 저작물이다."
 * 클래스는 globals.css 의 기존 어휘(sheet/dlist/drow)를 그대로 쓴다.
 */

export const dynamicParams = false

/** 대상명 → 그 대상의 이벤트. 대소문자·앞뒤 공백만 정리해서 묶는다 */
async function bySubject(): Promise<Map<string, EventItem[]>> {
  const m = new Map<string, EventItem[]>()
  for (const ev of await getAllEvents()) {
    const key = ev.subject.trim()
    if (!key) continue
    const list = m.get(key)
    if (list) list.push(ev)
    else m.set(key, [ev])
  }
  return m
}

/**
 * 만들어 둘 주소.
 *
 * 지금 열린 대상 ∪ 원장에 남은 대상이다. 원장을 빼면 끝난 대상이 404 가
 * 되고, `dynamicParams` 를 켜면 `/a/아무말이나` 가 전부 200 이 되어
 * 색인 쓰레기가 쌓인다. 둘 사이의 답이 이 합집합이다.
 */
export async function generateStaticParams() {
  const live = [...(await bySubject()).keys()]
  const keys = [...new Set([...live, ...knownSubjectNames()])]

  // 한글 주소와 ASCII 별칭 둘 다 만든다. X 가 한글 앞에서 링크를 끊는다
  const out = keys.map((subject) => ({ subject }))
  for (const [subject, slug] of Object.entries(SUBJECT_SLUGS)) {
    if (keys.includes(subject)) out.push({ subject: slug })
  }
  return out
}

/**
 * 주소 조각 → 대상과 그 대상의 열린 행사.
 *
 * `events` 가 빈 배열인 것과 `null` 인 것은 다르다. 빈 배열은 「있었는데
 * 지금은 없다」 이고 200 이다. `null` 은 「한 번도 없었다」 이고 404 다.
 * 이 구분이 없으면 아무 문자열이나 200 이 되어 색인 쓰레기가 쌓인다.
 */
async function find(raw: string): Promise<{ subject: string; events: EventItem[] } | null> {
  const subject = resolveSubject(raw)
  const events = (await bySubject()).get(subject)
  if (!events) return knownSubject(subject) ? { subject, events: [] } : null
  // 마감 임박 순. 목록 화면과 같은 축이라야 두 화면이 같은 것을 말한다
  return { subject, events: [...events].sort((a, b) => a.endsOn.localeCompare(b.endsOn)) }
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

/** 지역 이름만. 제목에 넣을 것이라 개수는 뺀다 */
function districtNames(events: EventItem[], max: number): string {
  const c = new Map<string, number>()
  for (const ev of events) c.set(ev.place.district, (c.get(ev.place.district) ?? 0) + 1)
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([d]) => DISTRICT_LABELS[d as keyof typeof DISTRICT_LABELS] ?? d)
    .join('·')
}

/**
 * 대상이 속한 그룹. 수집원이 `그룹 · 대상 · 행사명` 으로 준다.
 *
 * 없을 수 있다. 팝업은 이 형식이 아니고(`토리든 팝업`), 솔로는 그룹 자리가
 * 비어 `이영지 · 백마 탄 영지님의 탄신연회` 처럼 두 토막으로 온다.
 * RIIZE 처럼 그룹과 대상이 같은 것도 있다. 그런 경우 그냥 뺀다.
 * "이영지(이영지)" 는 안 넣느니만 못하다.
 */
function groupOf(subject: string, events: EventItem[]): string | null {
  for (const ev of events) {
    const parts = (ev.title ?? '').split(' · ')
    if (parts.length < 2) continue
    const head = parts[0].trim()
    if (head && head !== subject) return head
  }
  return null
}

/** '2026-09-06' → '9월 6일'. Date 로 왕복하지 않는다 (CLAUDE.md) */
function dayLabel(d: string): string {
  return `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`
}

/** 여는 날부터 닫는 날까지 */
function periodOf(events: EventItem[]): string {
  const days = events.map((e) => e.endsOn ?? e.startsOn)
  const from = events.map((e) => e.startsOn).sort()[0]
  const to = days.sort()[days.length - 1]
  return from === to ? dayLabel(from) : `${dayLabel(from)}~${dayLabel(to)}`
}

/**
 * 검색어에 맞춘 유형 이름.
 *
 * 화면에는 `생카` 로 쓰지만 **검색은 `생일카페` 로 친다.** 우리 제목이
 * `현석 생카 12` 하나뿐이라 "현석 생일카페" 검색 1페이지에 한 건도 안
 * 잡혔다. 그 자리는 같은 대상 페이지를 가진 오프메이트와 덕플레이스가
 * 나눠 갖고 있고, 둘 다 제목에 연도·그룹·"생일카페"·"지도"를 넣는다
 * (2026-09-06 실측).
 */
const SEARCH_KIND: Record<string, string> = {
  BIRTHDAY_CAFE: '생일카페',
  POPUP: '팝업',
  CONCERT: '콘서트',
}

/**
 * 열린 곳이 없을 때 쓸 말.
 *
 * 원장이 마지막 종료일과 유형을 들고 있어서 「생카는 9월 6일에 끝났어요」
 * 까지 말할 수 있다. 그냥 「없어요」 보다 낫다 — 주소를 잘못 눌렀는지
 * 행사가 끝난 것인지 구분되기 때문이다.
 */
function emptyCopy(subject: string) {
  const known = knownSubject(subject)
  const kind = known ? EVENT_KIND_LABELS[known.kind] : '생카'
  return {
    kind,
    ended: known ? dayLabel(known.lastEndsOn) : null,
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subject: string }>
}): Promise<Metadata> {
  const { subject: raw } = await params
  const hit = await find(raw)
  if (!hit) return {}

  const { subject, events } = hit

  /*
   * 열린 곳이 없으면 색인에서 뺀다.
   *
   * 200 이어야 이미 뿌린 X 링크가 살지만, 내용 없는 페이지가 색인되면
   * 사이트 전체 품질이 깎인다. 링크를 살리는 것과 검색에 내놓는 것은
   * 다른 일이다. 대상이 돌아오면 noindex 가 저절로 풀린다.
   */
  if (events.length === 0) {
    const { kind, ended } = emptyCopy(subject)
    return {
      title: `${subject} ${kind} — 지금 열린 곳 없음`,
      description: ended
        ? `${subject} ${kind}는 ${ended}에 끝났어요. 오늘 서울에서 열리는 곳을 보세요.`
        : `${subject} ${kind}는 지금 열린 곳이 없어요.`,
      robots: { index: false, follow: true },
      alternates: { canonical: `/a/${encodeURIComponent(subject)}` },
    }
  }
  const kinds = new Set(events.map((e) => e.kind))
  const kindLabel =
    kinds.size === 1 ? EVENT_KIND_LABELS[events[0].kind] : '생카·팝업'

  // 이름 뒤에 단위를 붙이지 않는다. 세는 대상은 카페인데 '정국 22곳' 은
  // 정국을 센 것처럼 읽힌다. 유형을 사이에 넣어 무엇을 세는지 분명히 한다
  const searchKind = kinds.size === 1 ? (SEARCH_KIND[events[0].kind] ?? kindLabel) : '생일카페·팝업'
  const group = groupOf(subject, events)
  const year = (events.map((e) => e.startsOn).sort()[0] ?? '').slice(0, 4)

  /**
   * 검색 제목과 공유 카드 제목을 나눈다.
   *
   * 검색은 팬이 치는 말을 다 담아야 걸린다 — 연도, 그룹, `생일카페`,
   * 개수, 지역. 반면 이 문구가 그대로 X 카드에 붙으면 트윗 밑에 긴 줄이
   * 하나 더 생겨 지저분하다. 카드는 이미 이미지에 큰 글씨로 이름과
   * 개수가 박혀 있어서 짧아도 된다.
   */
  const title = [
    year,
    group ? `${subject}(${group})` : subject,
    `${searchKind} ${events.length}곳`,
    `— ${districtNames(events, 2)} ${kindLabel} 지도`,
  ].join(' ')
  const shareTitle = `${subject} ${searchKind} ${events.length}곳`

  const kindPhrase = searchKind === kindLabel ? searchKind : `${searchKind}(${kindLabel})`
  const description =
    `${group ? `${group} ` : ''}${subject} ${kindPhrase} ${events.length}곳을 지도에 모았어요. ` +
    `${districtSummary(events)}, ${periodOf(events)}. 주최자 공지 기반으로 매일 갱신합니다.`

  return {
    title,
    description,
    alternates: { canonical: `/a/${encodeURIComponent(subject)}` },
    openGraph: { type: 'website', title: shareTitle, description, locale: 'ko_KR' },
    twitter: { card: 'summary_large_image', title: shareTitle, description },
  }
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>
}) {
  const { subject: raw } = await params
  const hit = await find(raw)
  if (!hit) notFound()

  const { subject, events } = hit
  if (events.length === 0) return <SubjectEmpty subject={subject} />

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
            {/* 목록만 클라이언트다. 페이지 전체를 그렇게 돌리면 구조화
                데이터와 메타 태그가 같이 딸려 나가 검색 유입이 깨진다 */}
            <SubjectList events={events} />

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

/**
 * 있었는데 지금은 없는 대상.
 *
 * **지난 행사를 나열하지 않는다.** 끝난 것을 다시 보여주면 사용자가
 * 헛걸음한다 (poc-plan 4.3). 여기서 할 일은 끝났다고 알리고 오늘 열리는
 * 곳으로 보내는 것뿐이다.
 *
 * 지도 링크(`#/q/이름`)도 걸지 않는다. 눌러도 결과가 없는 화면으로
 * 보내면 같은 말을 두 번 하게 된다.
 */
function SubjectEmpty({ subject }: { subject: string }) {
  const { kind, ended } = emptyCopy(subject)

  return (
    <div className="app">
      <main className="main">
        <article className="sheet sheet--page">
          <div className="sheet__head">
            <h1>{subject}</h1>
          </div>

          <div className="sheet__body">
            <div className="subjgone">
              <p className="subjgone__lead">
                {subject} {kind}는 지금 열린 곳이 없어요
              </p>
              {ended && <p className="subjgone__when">마지막 행사가 {ended}에 끝났어요</p>}

              <a className="btn btn--primary btn--block" href="/">
                오늘 열리는 곳 보기
              </a>
            </div>
          </div>
        </article>
      </main>
    </div>
  )
}
