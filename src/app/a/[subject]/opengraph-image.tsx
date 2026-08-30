import { ImageResponse } from 'next/og'
import rawEvents from '@/data/events.json'
import type { EventItem } from '@/types'
import { DISTRICT_LABELS, EVENT_KIND_LABELS } from '@/lib/filters'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamic = 'force-static'

/**
 * 대상별 미리보기 카드.
 *
 * 커뮤니티에 뿌리는 링크는 대상별이라 미리보기도 대상별이어야 한다.
 * 홈 이미지 하나를 돌려쓰면 "정국 22곳" 글에 "오늘 서울 어디서 뭐 하지?" 가 붙는다.
 *
 * 수량을 크게 넣는다. 이 판의 선행 서비스들이 전부 본문에 수량을 노출한다
 * (덕플레이스 "(25+)", 오프메이트 "업데이트 된 5개+"). 그게 클릭 근거다.
 */

const ALL = rawEvents as EventItem[]

export function generateStaticParams() {
  const seen = new Set<string>()
  for (const ev of ALL) {
    const k = ev.subject.trim()
    if (k) seen.add(k)
  }
  return [...seen].map((subject) => ({ subject }))
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
  const subject = decodeURIComponent(raw)
  const events = ALL.filter((e) => e.subject.trim() === subject)

  const kinds = new Set(events.map((e) => e.kind))
  const kindLabel = kinds.size === 1 ? EVENT_KIND_LABELS[events[0]?.kind ?? 'birthday_cafe'] : '생카·팝업'

  const byDistrict = new Map<string, number>()
  for (const ev of events) byDistrict.set(ev.place.district, (byDistrict.get(ev.place.district) ?? 0) + 1)
  const tags = [...byDistrict.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([d, n]) => `${DISTRICT_LABELS[d as keyof typeof DISTRICT_LABELS] ?? d} ${n}`)

  const count = `${events.length}곳`
  const foot = '덕모임 · duckmoim.com'
  const font = await loadFont([subject, kindLabel, count, foot, ...tags].join('') + '0123456789')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 96px',
          background: 'linear-gradient(135deg, #fff5f9 0%, #ffe4ee 55%, #ffd0e2 100%)',
          fontFamily: font ? 'Noto Sans KR' : 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 40, color: '#b41f5c' }}>{kindLabel}</div>

        {/* 대상명과 수량을 한 줄에. 수량이 클릭 근거라 같은 크기로 크게 둔다 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 8 }}>
          <div style={{ display: 'flex', fontSize: 120, color: '#241a1f', letterSpacing: '-0.04em' }}>
            {subject}
          </div>
          <div style={{ display: 'flex', fontSize: 96, color: '#cb1d63', letterSpacing: '-0.04em' }}>
            {count}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, marginTop: 40 }}>
          {tags.map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                padding: '10px 26px',
                borderRadius: 999,
                background: '#ffffff',
                border: '3px solid #ff4d8d',
                color: '#b41f5c',
                fontSize: 34,
              }}
            >
              {t}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', marginTop: 48, fontSize: 34, color: '#7a6670' }}>{foot}</div>
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
