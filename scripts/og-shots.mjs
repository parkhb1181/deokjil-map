/**
 * OG 카드에 올릴 사진을 미리 줄여 둔다.
 *
 * 왜 미리 하나:
 * - 수집원 원본은 장당 1.8~8.4MB 다. satori 가 그대로 받으면
 *   "Buffer size limit exceeded" 로 빌드가 죽는다.
 * - OG 라우트 안에서 sharp 를 쓰면 네이티브 바인딩이 번들과 충돌해
 *   "u2 is not iterable" 로 빌드가 죽는다. serverExternalPackages 로도 안 잡힌다.
 * 그래서 빌드 전에 별도 프로세스로 줄여 놓고, 라우트는 파일만 읽는다.
 *
 * 결과물은 커밋하지 않는다. events.json 이 매일 바뀌므로 빌드마다 다시 만든다.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const ROOT = path.resolve(import.meta.dirname, '..')
/**
 * 줄인 포스터를 두는 곳. src/app/a/[subject]/opengraph-image.tsx 의
 * OG_CACHE 와 같아야 한다.
 *
 * public/ 아래에 두면 Next 가 그대로 서빙해서
 * duckmoim.com/og/om_15139.jpg 로 포스터 원본을 누구나 받아갈 수 있다.
 * 우리 도메인에서 남의 저작물을 배포하는 셈이라 밖으로 뺐다.
 *
 * OG 라우트는 HTTP 가 아니라 디스크에서 읽고 그 읽기는 빌드 때 한 번만
 * 일어나므로, 옮겨도 카드는 그대로 나온다.
 */
const OUT = path.join(ROOT, '.og-cache')
/** 대상 하나당 사진 수. OG 카드가 한 줄에 세 칸이다 */
const SHOTS = 3
/** 카드 한 칸 크기. 세로는 OG 카드의 사진 줄 높이와 같아야 한다.
    작으면 늘어나면서 뭉개진다 (opengraph-image.tsx 의 SHOT_H) */
const W = 400
const H = 400

/**
 * 어떤 사진을 고를지.
 *
 * ─────────────────────────────────────────────────────────
 * **`src/lib/og-picks.ts` 의 `pickShots` 와 같은 규칙이어야 한다.**
 * 규칙과 그 이유는 그쪽에 적어 뒀다. 여기가 줄여 놓은 것과 카드가
 * 고르는 것이 어긋나면 그 칸은 그냥 빈다.
 *
 * 아래 `source()` 가 `src/lib/poster.ts` 와 갈라져 있는 것과 같은
 * 사정이다. 이 스크립트는 순수 Node ESM 이라 TypeScript 모듈을 못
 * 불러온다.
 */
function pickShots(events, count) {
  const lanes = new Map()
  for (const ev of events.filter((e) => e.imageUrl).sort(byStartThenId)) {
    const lane = lanes.get(ev.place.district)
    if (lane) lane.push(ev)
    else lanes.set(ev.place.district, [ev])
  }

  const ordered = [...lanes.values()].sort(
    (a, b) => b.length - a.length || a[0].id.localeCompare(b[0].id),
  )

  const picked = []
  for (let round = 0; picked.length < count; round++) {
    let took = false
    for (const lane of ordered) {
      if (round >= lane.length) continue
      picked.push(lane[round])
      took = true
      if (picked.length === count) break
    }
    if (!took) break
  }
  return picked
}

function byStartThenId(a, b) {
  return a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id)
}

/**
 * 수집원에 줄여 달라고 부탁한 주소.
 *
 * src/lib/poster.ts 와 같은 규칙이다. 여기서 다시 쓴 이유는 이 스크립트가
 * 순수 Node ESM 이라 TypeScript 모듈을 못 불러와서다. 규칙이 바뀌면
 * 양쪽을 같이 고쳐야 한다.
 *
 * 여기서는 더 작게 부른다. 어차피 ${W}x${H} 로 줄일 것이고, 원본을
 * 그대로 받으면 108장에 수백 MB 가 오간다. 그게 빌드 시간이고 곧 요금이다.
 */
function source(url) {
  try {
    const u = new URL(url)
    if (u.hostname !== 'img2.offmate.kr') return url
    if (u.searchParams.has('w')) return url
    /* 줄일 목표 폭의 두 배. 딱 맞게 받으면 자를 여유가 없다 */
    u.searchParams.set('w', String(W * 2))
    return u.toString()
  } catch {
    return url
  }
}

const events = JSON.parse(await fs.readFile(path.join(ROOT, 'src/data/events.json'), 'utf8'))

// 대상별로 세 장씩만. 전부 받으면 216장이라 빌드가 길어진다
const bySubject = new Map()
for (const ev of events) {
  const key = ev.subject?.trim()
  if (!key) continue
  const list = bySubject.get(key)
  if (list) list.push(ev)
  else bySubject.set(key, [ev])
}
const targets = [...bySubject.values()].flatMap((list) => pickShots(list, SHOTS))

await fs.mkdir(OUT, { recursive: true })
// 지난 빌드의 잔여물을 남기지 않는다. 종료된 행사 사진이 계속 쌓인다
for (const f of await fs.readdir(OUT).catch(() => [])) {
  if (f.endsWith(".jpg")) await fs.unlink(path.join(OUT, f)).catch(() => {})
}

let ok = 0
let fail = 0
const started = Date.now()

// 동시에 여덟 개씩. 더 늘리면 수집원 서버에 부담이 된다 (CLAUDE.md 크롤러 원칙)
const QUEUE = 8
const queue = [...targets]
await Promise.all(
  Array.from({ length: QUEUE }, async () => {
    for (;;) {
      const ev = queue.shift()
      if (!ev) return
      try {
        const res = await fetch(source(ev.imageUrl))
        if (!res.ok) throw new Error(String(res.status))
        const bytes = new Uint8Array(await res.arrayBuffer())
        const out = await sharp(bytes)
          .resize(W, H, { fit: 'cover' })
          .jpeg({ quality: 78 })
          .toBuffer()
        await fs.writeFile(path.join(OUT, `${ev.id}.jpg`), out)
        ok++
      } catch {
        // 원본이 내려갔을 수 있다. 그 칸은 비우고 넘어간다
        fail++
      }
    }
  }),
)

console.log(
  `og-shots: ${ok}장 생성, ${fail}장 실패 (${((Date.now() - started) / 1000).toFixed(1)}초)`,
)
