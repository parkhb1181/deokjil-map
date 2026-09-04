import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { ALL_EVENTS } from '@/lib/events-source'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'
import { SUBJECT_SLUGS, resolveSubject } from '@/lib/subject-slug'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamic = 'force-static'

/**
 * 대상별 미리보기 카드.
 *
 * 커뮤니티에 뿌리는 링크는 대상별이라 미리보기도 대상별이어야 한다.
 * 홈 이미지 하나를 돌려쓰면 "정국 22" 글에 "오늘 서울 어디서 뭐 하지?" 가 붙는다.
 *
 * 실제 행사 사진을 싣는다. 글자만 있는 카드는 타임라인에서 그냥 지나간다.
 * 사진은 수집원 CDN 원본이 장당 수 MB 라 그대로 물리면 빌드가 무너진다.
 * 여기서 카드 크기로 줄여 data URI 로 박는다.
 *
 * 숫자에 '곳' 을 붙이지 않는다. 세는 대상은 카페인데 단위가 사람 이름에 붙으면
 * 그 사람을 센 것처럼 읽힌다. 지도 핀과 같은 규칙으로 숫자만 배지에 넣는다.
 */

const ALL = ALL_EVENTS

/** 카드에 올릴 사진 수. 세 장이면 한 줄이 차고, 더 넣으면 각각이 너무 작아진다 */
const SHOTS = 3

/**
 * 사진 줄 높이. 630 중 400 이라 아래 글자 칸은 230 이다.
 *
 * 300 이던 것을 올렸다. 타임라인에서 카드를 멈추게 하는 것은 글자가
 * 아니라 사진인데, 절반을 글자가 먹고 있었다. 지역 배지와 도메인은
 * 눌러서 들어온 다음에 읽는 값이라 작아도 된다.
 *
 * `scripts/og-shots.mjs` 의 H 와 같은 값이어야 한다. 축소본이 이보다
 * 작으면 늘어나면서 뭉갠다.
 */
const SHOT_H = 400

/**
 * 줄여 둔 포스터가 있는 곳. `scripts/og-shots.mjs` 의 OUT 과 같아야 한다.
 *
 * `public/` 아래가 아니다. 거기 두면 Next 가 정적 파일로 서빙한다.
 */
const OG_CACHE = '.og-cache'

export function generateStaticParams() {
  const seen = new Set<string>()
  for (const ev of ALL) {
    const k = ev.subject.trim()
    if (k) seen.add(k)
  }
  // 한글 주소와 ASCII 별칭 둘 다 만든다. X 가 한글 앞에서 링크를 끊는다
  const out = [...seen].map((subject) => ({ subject }))
  for (const [subject, slug] of Object.entries(SUBJECT_SLUGS)) {
    if (seen.has(subject)) out.push({ subject: slug })
  }
  return out
}

/**
 * satori 는 웹폰트를 스스로 받아오지 않는다. 넘기지 않으면 한글이 빈 사각형이 된다.
 * 구형 UA 로 요청해야 woff2 대신 satori 가 읽는 TTF 가 온다.
 */
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  const legacyUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.17.9'
  const cssUrl =
    'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@800' +
    `&text=${encodeURIComponent(text)}`
  try {
    const css = await fetch(cssUrl, { headers: { 'User-Agent': legacyUA } }).then((r) => r.text())
    const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1]
    if (!url) return null
    return await fetch(url).then((r) => r.arrayBuffer())
  } catch {
    // 빌드 환경에 네트워크가 없을 수도 있다. 그때는 폰트 없이 렌더한다
    return null
  }
}


export default async function Image({ params }: { params: Promise<{ subject: string }> }) {
  const { subject: raw } = await params
  const subject = resolveSubject(raw)
  const events = ALL.filter((e) => e.subject.trim() === subject)

  const kinds = new Set(events.map((e) => e.kind))
  const kindLabel =
    kinds.size === 1 ? EVENT_KIND_LABELS[events[0]?.kind ?? 'BIRTHDAY_CAFE'] : '생카·팝업'

  const byDistrict = new Map<string, number>()
  for (const ev of events) {
    byDistrict.set(ev.place.district, (byDistrict.get(ev.place.district) ?? 0) + 1)
  }
  const tags = [...byDistrict.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([d, n]) => `${DISTRICT_LABELS[d as keyof typeof DISTRICT_LABELS] ?? d} ${n}`)

  const foot = '덕모임 · duckmoim.com'
  const picks = events.filter((e) => e.imageUrl).slice(0, SHOTS)

  /**
   * scripts/og-shots.mjs 가 빌드 전에 줄여 놓은 파일을 읽는다.
   * 원본을 satori 에 그대로 물리면 "Buffer size limit exceeded" 로 죽고,
   * 이 라우트 안에서 sharp 를 부르면 네이티브 바인딩이 번들과 충돌한다.
   *
   * **`public/` 밖에 둔다.** 거기 두면 Next 가 그대로 서빙해서
   * `duckmoim.com/og/om_15139.jpg` 로 포스터 원본을 누구나 받아갈 수
   * 있었다. 그건 우리 도메인에서 남의 저작물을 배포하는 것이다.
   *
   * 여기서는 HTTP 가 아니라 디스크에서 읽고, 이 라우트가 `force-static`
   * 이라 그 읽기는 빌드 때 한 번만 일어난다. 그래서 옮겨도 동작이
   * 달라지지 않고 서빙만 끊긴다.
   */
  const shots = picks
    .map((e) => {
      try {
        const file = path.join(process.cwd(), OG_CACHE, `${e.id}.jpg`)
        return `data:image/jpeg;base64,${readFileSync(file).toString('base64')}`
      } catch {
        // 원본이 내려가 축소본이 없을 수 있다. 그 칸은 비운다
        return null
      }
    })
    .filter((s): s is string => typeof s === 'string')

  // 폰트와 사진을 한 Promise.all 에 섞지 않는다. 반환 타입이 달라
  // 구조분해가 번들 후 깨진다
  const font = await loadFont([subject, kindLabel, foot, ...tags].join('') + '0123456789')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#fffafc',
          fontFamily: font ? 'Noto Sans KR' : 'sans-serif',
        }}
      >
        {/* 사진 줄. 없으면 통째로 빼고 글자만 남긴다 */}
        {shots.length > 0 ? (
          <div style={{ display: 'flex', width: '100%', height: SHOT_H }}>
            {shots.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                width={1200 / shots.length}
                height={SHOT_H}
                style={{ objectFit: 'cover' }}
                alt=""
              />
            ))}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            padding: '0 64px',
            background: 'linear-gradient(135deg, #fff5f9 0%, #ffe4ee 60%, #ffd0e2 100%)',
          }}
        >
          {/* 개수를 이름에서 떼어 위로 올렸다.
              알약과 원형 배지를 쓰던 것을 글자 줄로 바꿨다. 사진이 이미
              둥근 것 없이 꽉 찬 사각형이라, 아래에 동그란 것이 넷 놓이면
              같은 카드에 규칙이 둘이 된다.

              단위를 여기 붙일 수 있는 것은 이름과 떨어져 있어서다.
              이름 바로 뒤에 '곳' 이 오면 그 사람을 센 것처럼 읽힌다 */}
          <div style={{ display: 'flex', fontSize: 28, color: '#b41f5c' }}>
            {kindLabel} {events.length}곳
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 82,
              color: '#241a1f',
              letterSpacing: '-0.04em',
              marginTop: 2,
            }}
          >
            {subject}
          </div>

          {/* 지역은 가운뎃점으로 잇는다. 칸을 나누지 않아도 셋이 구분되고
              넷째가 들어와도 줄이 안 무너진다 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              marginTop: 14,
            }}
          >
            <div style={{ display: 'flex', fontSize: 27, color: '#8a5a70' }}>
              {tags.join('  ·  ')}
            </div>
            <div
              style={{
                display: 'flex',
                marginLeft: 'auto',
                fontSize: 21,
                color: '#a08a95',
              }}
            >
              {foot}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: 'Noto Sans KR', data: font, weight: 800 as const, style: 'normal' as const }]
        : [],
    },
  )
}
