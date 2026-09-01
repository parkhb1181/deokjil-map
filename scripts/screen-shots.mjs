/**
 * 온보딩 색인에 쓸 화면 사진을 찍는다.
 *
 * `/onboarding` 이 글자만 열일곱 줄이라 어느 것이 어느 화면인지
 * 눈으로 못 고른다. 이름을 읽고 머릿속에서 화면을 떠올려야 하는데,
 * 처음 보는 사람은 떠올릴 것이 없다. 사진 한 장이면 끝난다.
 *
 * 크롬을 headless 로 띄워 찍는다. 별도 패키지를 넣지 않는 이유가
 * 있다. puppeteer 는 크롬을 한 벌 더 내려받고(약 170MB), 이 스크립트는
 * 화면이 바뀔 때만 돌린다. 이미 깔린 크롬으로 되는 일이다.
 *
 * 개발 서버가 떠 있어야 한다:
 *   npm run dev
 *   node scripts/screen-shots.mjs
 *
 * 결과물은 커밋한다. og-shots 와 다르다. 저건 events.json 이 매일
 * 바뀌어 빌드마다 다시 만들지만, 화면은 우리가 고칠 때만 바뀐다.
 * 안 넣어두면 받아간 사람의 온보딩 페이지가 빈 칸으로 뜬다.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'

const run = promisify(execFile)
const require = createRequire(import.meta.url)
const sharp = require('sharp')

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'public', 'shots')
const BASE = process.env.BASE ?? 'http://localhost:3000'

/* 휴대폰 폭으로 찍는다. 데스크톱으로 찍으면 좌우가 텅 빈 사진이
   나오고, 이 서비스를 실제로 보는 폭도 아니다 */
const W = 390
const H = 844

/* 위에서 이만큼만 남긴다. 4:5 는 앱의 사진 비율과 같다.
   아래쪽은 어느 화면이나 비어 있어서 잘라도 잃는 것이 없고,
   Next 개발 표시(왼쪽 아래 검은 동그라미)도 같이 없어진다 */
const CROP_H = Math.round(W * 5 / 4)

/* 내보내는 크기. 3단 격자에서 한 칸이 200px 안팎이라 두 배로 둔다 */
const OUT_W = 400

/** [파일 이름, 주소] */
const SHOTS = [
  ['home', '/'],
  ['event', '/e/pg_8417'],
  ['artist', '/a/성호'],
  ['posts', '/p'],
  ['post', '/p/p1'],
  ['post-new', '/p/new'],
  ['login', '/login'],
  ['welcome', '/welcome'],
  ['me', '/me'],
  ['me-edit', '/me/edit'],
  ['me-blocked', '/me/blocked'],
  ['profile', '/u/u_host'],
  ['admin', '/admin15616'],
  ['terms', '/terms'],
  ['privacy', '/privacy'],
  ['gallery', '/dev/gallery'],
  ['notfound', '/없는주소'],
]

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]

async function findBrowser() {
  for (const p of CHROME) {
    if (await fs.access(p).then(() => true, () => false)) return p
  }
  throw new Error('크롬이나 엣지를 찾지 못했습니다')
}

/* 서버가 떠 있는지 먼저 본다. 안 떠 있으면 열일곱 장이 전부 오류
   화면으로 찍히는데, 사진만 보면 찍힌 줄 안다 */
const ping = await fetch(BASE).catch(() => null)
if (!ping?.ok) {
  console.error(`${BASE} 에 연결하지 못했습니다. npm run dev 를 먼저 띄워주세요`)
  process.exit(1)
}

const browser = await findBrowser()
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'shots-'))
await fs.mkdir(OUT, { recursive: true })

/**
 * 크롬을 조용히 시키는 깃발들.
 *
 * 이게 없으면 구글 계정 동기화·GCM 연결을 계속 시도하면서 stderr 에
 * 오류를 쏟는다. 처음에 execFile 의 maxBuffer 가 그 로그로 넘쳐서
 * 스크린샷이 아니라 버퍼 초과로 죽었다. 로그를 크게 받는 것보다
 * 애초에 안 만들게 하는 편이 낫다.
 */
const QUIET = [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-sync',
  '--disable-extensions',
  '--disable-default-apps',
  '--mute-audio',
  '--log-level=3',
]

const started = Date.now()
let ok = 0
const failed = []

for (const [name, route] of SHOTS) {
  const raw = path.join(tmp, `${name}.png`)
  try {
    await run(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-sandbox',
        ...QUIET,
        `--user-data-dir=${path.join(tmp, 'profile')}`,
        `--window-size=${W},${H}`,
        /* 지도와 사진이 들어오기를 기다린다. 짧으면 회색 네모가 찍힌다 */
        '--virtual-time-budget=5000',
        `--screenshot=${raw}`,
        BASE + encodeURI(route),
      ],
      /* 한 장이 끝을 안 내면 잘라낸다. 지도 화면처럼 밖으로 나가는
         스크립트가 있으면 가상 시간이 안 흘러 영영 안 끝난다.
         한 장 잃는 것이 열일곱 장 다 못 찍는 것보다 낫다 */
      { timeout: 40_000, killSignal: 'SIGKILL', maxBuffer: 8 << 20 },
    )
  } catch (e) {
    /* 시간이 다 됐어도 사진은 이미 찍혀 있을 수 있다. 있으면 쓴다 */
    if (!(await fs.access(raw).then(() => true, () => false))) {
      failed.push(name)
      process.stdout.write(`\r${name} 실패`.padEnd(44) + '\n')
      continue
    }
  }

  await sharp(raw)
    .extract({ left: 0, top: 0, width: W, height: CROP_H })
    .resize(OUT_W)
    .webp({ quality: 74 })
    .toFile(path.join(OUT, `${name}.webp`))

  ok++
  process.stdout.write(`\r${ok}/${SHOTS.length} ${name}`.padEnd(44))
}

await fs.rm(tmp, { recursive: true, force: true })

const bytes = (await Promise.all(
  SHOTS.map(([n]) =>
    fs.stat(path.join(OUT, `${n}.webp`)).then((s) => s.size, () => 0),
  ),
)).reduce((a, b) => a + b, 0)

console.log(
  `\nscreen-shots: ${ok}/${SHOTS.length}장, 합계 ${(bytes / 1024).toFixed(0)}KB ` +
    `(${((Date.now() - started) / 1000).toFixed(1)}초)`,
)
if (failed.length) console.log(`못 찍은 것: ${failed.join(', ')}`)
