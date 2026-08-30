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
const OUT = path.join(ROOT, 'public', 'og')
/** 대상 하나당 사진 수. OG 카드가 한 줄에 세 칸이다 */
const SHOTS = 3
/** 카드 한 칸 크기 */
const W = 400
const H = 300

const events = JSON.parse(await fs.readFile(path.join(ROOT, 'src/data/events.json'), 'utf8'))

// 대상별로 앞에서 세 장씩만. 전부 받으면 216장이라 빌드가 길어진다
const wanted = new Map()
for (const ev of events) {
  const key = ev.subject?.trim()
  if (!key || !ev.image_url) continue
  const list = wanted.get(key) ?? []
  if (list.length >= SHOTS) continue
  list.push(ev)
  wanted.set(key, list)
}
const targets = [...wanted.values()].flat()

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
        const res = await fetch(ev.image_url)
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
