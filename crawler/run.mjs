/**
 * 수집 실행기.
 *
 *   node crawler/run.mjs [--source popga|offmate|kopis|all] [--limit 600] [--days 60]
 *
 * 1) robots.txt 를 먼저 확인한다. 막혀 있으면 아무것도 하지 않고 끝낸다
 * 2) 사이트맵에서 최근 갱신된 상세 URL을 고른다
 * 3) 각 상세를 예의 있는 간격으로 가져와 원본 레코드를 저장한다
 *
 * **kopis 는 이 흐름을 타지 않는다.** 공식 오픈API 라 robots.txt 판정이 해당하지
 * 않고 사이트맵도 없다. 소스가 직접 목록을 순회한다 (`collect`). 인증키가 필요해
 * `KOPIS_SERVICE_KEY` 를 환경변수로 받는다 — Next 가 아니라 맨 node 라
 * `.env.local` 을 자동으로 읽지 않으므로 `--env-file` 로 넘긴다.
 *
 *   node --env-file=.env.local crawler/run.mjs --source kopis
 *
 * `--days` 의 뜻도 소스마다 다르다. 사이트맵 쪽은 "최근 며칠 안에 갱신된 것",
 * kopis 는 "오늘부터 며칠 안에 열리는 공연"이다.
 *
 * 결과는 data/raw/crawl/<source>.json 에 쌓인다 (커밋되지 않는다).
 * 정규화·필터는 to-events.mjs 가 맡는다. 수집과 가공을 분리해두면
 * 필터 기준을 바꿀 때 다시 긁지 않아도 된다.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { isAllowed } from './lib/http.mjs'
import * as popga from './sources/popga.mjs'
import * as offmate from './sources/offmate.mjs'
import * as kopis from './sources/kopis.mjs'

const SOURCES = {
  popga: {
    origin: popga.ORIGIN,
    path: '/popup/',
    list: popga.listPopupUrls,
    fetchOne: popga.fetchPopup,
  },
  offmate: {
    origin: offmate.ORIGIN,
    path: '/place/birthday-cafe/',
    list: offmate.listCafeUrls,
    fetchOne: offmate.fetchCafe,
  },
  // 공식 오픈API 라 robots.txt 판정이 해당하지 않고, 사이트맵도 없다.
  // 목록 순회가 API 페이징이고 시설 응답을 캐시해야 해서 소스가 루프를 갖는다
  kopis: {
    origin: kopis.ORIGIN,
    officialApi: true,
    collect: kopis.collect,
  },
}

const args = process.argv.slice(2)
const getStr = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const getNum = (name, fallback) => {
  const v = getStr(name, null)
  return v === null ? fallback : Number(v)
}

const LIMIT = getNum('limit', 600)
const DAYS = getNum('days', 60)
const WHICH = getStr('source', 'popga')
const OUT_DIR = 'data/raw/crawl'

const targets = WHICH === 'all' ? Object.keys(SOURCES) : [WHICH]
for (const name of targets) {
  if (!SOURCES[name]) {
    console.error(`알 수 없는 소스: ${name} (가능: ${Object.keys(SOURCES).join(', ')}, all)`)
    process.exit(1)
  }
}

/** 사이트맵 색인을 가진 소스. 최근 갱신된 상세를 하나씩 가져온다 */
async function collectFromSitemap(src) {
  const all = await src.list()
  const cutoff = new Date(Date.now() - DAYS * 86_400_000).toISOString()
  const picked = all.filter((e) => e.lastmod >= cutoff).slice(0, LIMIT)
  console.log(`  사이트맵 ${all.length}건 → 최근 ${DAYS}일 ${picked.length}건 수집`)

  const records = []
  const failures = []

  for (const [i, entry] of picked.entries()) {
    const r = await src.fetchOne(entry.url)
    if (r.ok) records.push({ ...r.record, lastmod: entry.lastmod })
    else failures.push({ url: entry.url, status: r.status, error: r.error })

    if ((i + 1) % 50 === 0 || i === picked.length - 1) {
      console.log(`    ${i + 1}/${picked.length} · 성공 ${records.length} · 실패 ${failures.length}`)
    }
  }

  return { records, failures }
}

/** collect 를 가진 소스가 진행을 알릴 때 쓴다. 사이트맵 쪽 로그와 모양을 맞춘다 */
function report(p) {
  if (p.phase === 'list') {
    console.log(`  목록 ${p.total}건 → 상세 수집`)
    return
  }
  console.log(
    `    ${p.done}/${p.total} · 성공 ${p.ok} · 실패 ${p.failed} · 공연장 ${p.facilities}곳`,
  )
}

let failed = 0

for (const name of targets) {
  const src = SOURCES[name]
  console.log(`\n[${name}]`)

  if (src.officialApi) {
    console.log('  robots.txt: 해당 없음 (공식 오픈API)')
  } else {
    const gate = await isAllowed(src.origin, src.path)
    console.log(`  robots.txt: ${gate.allowed ? '허용' : '차단'}, ${gate.reason}`)
    if (!gate.allowed) {
      console.error(`  robots.txt 가 ${src.path} 를 허용하지 않는다. 이 소스를 건너뛴다.`)
      continue
    }
  }

  /**
   * 한 소스가 죽어도 다음 소스는 돈다.
   *
   * 자동 갱신은 소스별로 원본 파일을 남기고 to-events.mjs 가 있는 것만 읽는다.
   * 여기서 통째로 죽으면 **멀쩡한 소스의 수집까지 버려지고** 정규화·검증·커밋이
   * 다 안 된다. 새로 붙인 소스(인증키 만료 등)가 이미 잘 돌던 경로를 무너뜨리는
   * 것을 막는다. 전멸했을 때는 validate-events.mjs 의 최소 건수가 걸러낸다.
   */
  let result
  try {
    result = src.collect
      ? await src.collect({ days: DAYS, limit: LIMIT, onProgress: report })
      : await collectFromSitemap(src)
  } catch (err) {
    failed++
    console.error(`  ❌ ${name} 수집 실패, 이 소스를 건너뛴다: ${err.message}`)
    continue
  }

  const { records, failures } = result

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(
    `${OUT_DIR}/${name}.json`,
    JSON.stringify({ collected_at: new Date().toISOString(), records, failures }, null, 2),
    'utf8',
  )
  console.log(`  저장: ${OUT_DIR}/${name}.json (${records.length}건)`)
  if (failures.length) console.log(`  실패 ${failures.length}건, 같은 파일의 failures 참조`)
}

if (failed) {
  console.error(`\n소스 ${failed}개가 실패했다. 위 로그를 확인한다.`)
}
