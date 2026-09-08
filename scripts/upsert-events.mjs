/**
 * events.json 을 백엔드에 적재한다 (EV-03 · EV-04).
 *
 *   node scripts/upsert-events.mjs [src/data/events.json] [--dry]
 *
 * 이 저장소의 앱은 `src/data/events.json` 을 빌드에 굽는다. 백엔드 DB 는 그와
 * 별개로 `V3` 시드(9/3 스냅샷)에 멈춰 있었고, 크롤러가 거기에 쓰지 않았다.
 * 여기가 그 끊긴 데를 잇는다 — 매일 만든 JSON 을 그대로 밀어 넣는다.
 *
 * **DB 에 직접 붙지 않는다** (위키 05-기록-회고/2026-09-08 D-8). Actions 러너의
 * IP 대역이 넓어서 DB 포트를 열면 사실상 공개하는 것이 된다. API 를 부른다.
 *
 * ─────────────────────────────────────────────────────────
 * **화면은 여전히 JSON 을 본다.** 전환(EV-08)까지 이 DB 는 쌓이기만 한다.
 *
 * 그래서 이 스크립트가 실패해도 그날 배포는 정상이어야 한다. 워크플로가
 * `continue-on-error: true` 로 부르고, 여기서는 **실패를 감추지 않고** 요약에
 * 남긴다. 조용히 성공한 척하면 몇 주 뒤 전환할 때 빈 DB 를 발견한다.
 *
 * 계약: 위키 02-설계-아키텍처/API-설계.md 「2-8. 적재 (Ingest)」
 */
import { readFileSync, appendFileSync } from 'node:fs'

const args = process.argv.slice(2)
const PATH = args.find((a) => !a.startsWith('--')) ?? 'src/data/events.json'
const DRY = args.includes('--dry')

/** 벌크 상한. 백엔드가 요청당 1000건까지만 받는다 (EventBulkIngestRequest) */
const CHUNK = 1000

/**
 * 요청 타임아웃.
 *
 * 1000건이 한 트랜잭션에 들어가고 그 안에서 지역 조회·기존 행 조회·저장이 돈다.
 * 짧게 잡으면 백엔드는 성공했는데 여기서 끊겨 **다음 실행이 같은 것을 또 보내는**
 * 모양이 된다 — upsert 라 결과는 같지만 실패로 기록되어 사람이 헛수고를 한다.
 */
const TIMEOUT_MS = 120_000

const base = process.env.INGEST_API_BASE?.replace(/\/+$/, '')
const key = process.env.INGEST_KEY

/** Actions 실행 요약. 새벽에 도는 잡이라 로그를 아무도 안 본다 */
function summary(md) {
  const p = process.env.GITHUB_STEP_SUMMARY
  if (p) appendFileSync(p, md + '\n')
}

/**
 * 주소나 키가 없으면 건너뛴다. 실패로 만들지 않는다.
 *
 * KOPIS 인증키가 없을 때 그 소스만 건너뛰고 나머지가 도는 것과 같은 판단이다
 * (crawler/run.mjs). 백엔드 배포와 시크릿 등록보다 이 커밋이 먼저 들어가는데,
 * 없는 것을 실패로 세면 그때까지 매일 빨간 실행이 쌓이고 **진짜 고장이 그
 * 빨강에 섞여 안 보이게 된다.**
 *
 * 대신 건너뛴 사실을 요약에 남긴다. 조용히 넘기면 시크릿을 등록했다고
 * 착각한 채로 몇 주가 간다.
 */
if (!base || !key) {
  const missing = [!base && 'INGEST_API_BASE', !key && 'INGEST_KEY'].filter(Boolean).join(' · ')
  console.log(`적재 건너뜀 — ${missing} 이 없다.`)
  summary(`## 행사 적재 건너뜀\n\n\`${missing}\` 시크릿이 없다. 백엔드 배포 후 등록한다.`)
  process.exit(0)
}

const events = JSON.parse(readFileSync(PATH, 'utf8'))

/**
 * `source` 없이 보내지 않는다.
 *
 * 백엔드가 이 필드를 필수로 받고, `id` 접두어에서 유도하지 않기로 했다(D-9).
 * 값을 넣는 것은 `crawler/to-events.mjs` 이므로, 없다는 것은 **커밋된 JSON 이
 * 그 변경 전에 만들어진 것**이라는 뜻이다. 400 을 받고 응답 본문을 읽는 대신
 * 여기서 그 사실을 말한다.
 */
const noSource = events.filter((e) => !e.source)
if (noSource.length) {
  console.error(`${noSource.length}건에 source 가 없다 (예: ${noSource[0].id}).`)
  console.error('node crawler/to-events.mjs 를 다시 돌려 JSON 을 새로 만든다.')
  process.exit(1)
}

/**
 * 화면 계약 → 적재 계약.
 *
 * 필드 이름이 거의 그대로다. 화면·크롤러·백엔드 셋이 같은 이름을 쓰기로 해서다
 * (bridge-plan-full 7번). 갈리는 데가 셋뿐이다.
 *
 * - `id` → `externalId`. 백엔드의 `id` 는 숫자 PK 라 이름을 비켜 준다
 * - `goods` 는 보내지 않는다. 어느 수집원도 굿즈를 주지 않아 전량 빈 배열이다
 * - `place.district` 는 그대로다. 백엔드가 `Region.code` 와 대조한다
 *
 * **없는 필드를 `null` 로 채워 보내지 않는다.** 선택 필드가 빠져 있는 것과
 * 비어 있는 것은 같지만, 굳이 실어 보내면 요청이 커지고 무엇보다 **필수 필드를
 * 빼먹었을 때 `null` 이 섞여 원인이 흐려진다.**
 */
function toItem(e) {
  const { id, goods, ...rest } = e
  return { externalId: id, ...rest }
}

const chunks = []
for (let i = 0; i < events.length; i += CHUNK) chunks.push(events.slice(i, i + CHUNK))

console.log(`적재 대상 ${events.length}건, ${chunks.length}회 요청 → ${base}`)

if (DRY) {
  console.log('--dry 라 실제로 보내지 않는다.')
  console.log(JSON.stringify(toItem(events[0]), null, 2))
  process.exit(0)
}

let created = 0
let updated = 0
let last = null

for (const [i, chunk] of chunks.entries()) {
  const res = await fetch(`${base}/api/v1/ingest/events/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 사람이 아니라 크롤러가 부른다. JWT 가 아니라 정적 키다 (D-11)
      'X-Ingest-Key': key,
    },
    body: JSON.stringify({ events: chunk.map(toItem) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const body = await res.text()
  if (!res.ok) {
    console.error(`적재 실패 ${res.status} (${i + 1}/${chunks.length}회차, ${chunk.length}건)`)
    // 400 이면 어느 필드가 왜 걸렸는지가 여기 있다. 401 이면 키가 틀린 것이다
    console.error(body.slice(0, 2000))
    summary(
      `## 행사 적재 실패\n\n` +
        `\`${res.status}\` · ${i + 1}/${chunks.length}회차 · ${chunk.length}건\n\n` +
        '```\n' +
        body.slice(0, 1000) +
        '\n```',
    )
    process.exit(1)
  }

  last = JSON.parse(body)
  created += last.created
  updated += last.updated

  /**
   * 건수 대조는 회차마다 본다 (EV-04).
   *
   * 통과 조건이 「적재 전후 건수 대조」인데 **DB 총량과 JSON 건수는 같아지지
   * 않는다** — 사라진 행사를 지우지 않으므로(D-7) `total` 은 단조 증가한다.
   * 그래서 대조는 `created + updated == 보낸 건수` 로 한다. 이것이 어긋나면
   * 보낸 행 중 일부가 조용히 사라진 것이다.
   */
  const handled = last.created + last.updated
  if (handled !== chunk.length) {
    console.error(`건수가 안 맞는다: ${chunk.length}건 보냈는데 ${handled}건만 처리됐다.`)
    summary(`## 행사 적재 건수 불일치\n\n보낸 ${chunk.length}건 중 ${handled}건만 처리됐다.`)
    process.exit(1)
  }
}

console.log(
  `적재 완료 — 보낸 ${events.length} (신규 ${created} · 갱신 ${updated}) · ` +
    `DB 누적 ${last.total} · 숨김 ${last.hidden}`,
)

/**
 * `hidden` 은 기간이 남았는데 오래 안 잡힌 행이다 (D-7).
 *
 * 매일 도는 잡이라 정상 상태에서는 0 이거나 아주 작다. 갑자기 커지면 수집이
 * 깨져 전체가 안 잡히기 시작한 것일 수 있어서 눈에 띄게 남긴다. 실패로 만들지
 * 않는 이유는 원본에서 실제로 대량 취소가 날 수도 있어서다 — 사람이 판단한다.
 */
summary(
  `## 행사 적재 ${events.length}건\n\n` +
    `| 보냄 | 신규 | 갱신 | DB 누적 | 숨김 |\n|---|---|---|---|---|\n` +
    `| ${events.length} | ${created} | ${updated} | ${last.total} | ${last.hidden} |\n\n` +
    `\`DB 누적\` 은 \`events.json\` 건수와 같아지지 않는다 — 사라진 행사를 지우지 않는다(D-7).\n` +
    `두 번 돌려 \`신규\` 가 0 이 되는 것이 멱등성 판정이다(EV-03).\n`,
)
