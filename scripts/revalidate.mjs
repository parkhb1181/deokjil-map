/**
 * 적재 직후 프론트 화면을 온디맨드로 재검증한다 (D-10 · D-12, API-설계.md).
 *
 *   node scripts/revalidate.mjs
 *
 * 크롤러 스텝이 부른다. 백엔드가 아니다 — 크롤러가 적재 응답을 들고 있어
 * "바뀌었는지"를 아는 유일한 주체다 (D-12). 라우트 쪽 설계는
 * src/app/api/revalidate/events/route.ts 를 보라.
 *
 * upsert-events.mjs 뒤에 둔다. DB 가 안 바뀌었으면(적재 건너뜀·실패) 재검증할
 * 이유가 없다 — 그래도 워크플로가 이 스크립트를 always() 로 부르는 이유는
 * 그 판단(건너뛸지 말지)을 여기서 다시 하기 때문이다: 시크릿이 없으면
 * 어차피 조용히 건너뛴다.
 *
 * 실패해도 그날 배포는 정상이어야 한다 — ISR 안전망(`NEXT_PUBLIC_REVALIDATE`,
 * 기본 1시간)이 최악의 경우를 잡아준다. 그래서 워크플로가 이 스크립트를
 * continue-on-error 로 부른다.
 */
import { appendFileSync } from 'node:fs'

/**
 * 도메인은 고정값이다. 이 스크립트가 부르는 곳은 항상 "지금 배포된 이
 * 저장소 자신"이라 브랜치별로 달라질 이유가 없다 — INGEST_API_BASE 처럼
 * 백엔드 도메인을 설정으로 여는 것과는 다른 문제다. develop 에서 수동
 * 실행해도 프로덕션 캐시를 한 번 더 재검증할 뿐이라 해가 없다(데이터를
 * 쓰는 게 아니라 다음 요청 때 다시 읽게 만들 뿐이다).
 */
const BASE = 'https://duckmoim.com'

const key = process.env.REVALIDATE_KEY

function summary(md) {
  const p = process.env.GITHUB_STEP_SUMMARY
  if (p) appendFileSync(p, md + '\n')
}

/** 키가 없으면 건너뛴다. upsert-events.mjs 와 같은 판단이다 */
if (!key) {
  console.log('재검증 건너뜀 — REVALIDATE_KEY 가 없다.')
  summary('## 화면 재검증 건너뜀\n\n`REVALIDATE_KEY` 시크릿이 없다. 프론트 배포 후 등록한다.\n')
  process.exit(0)
}

const res = await fetch(`${BASE}/api/revalidate/events`, {
  method: 'POST',
  headers: { 'X-Revalidate-Key': key },
  signal: AbortSignal.timeout(30_000),
})

if (!res.ok) {
  const body = await res.text()
  console.error(`재검증 실패 ${res.status}`)
  console.error(body.slice(0, 500))
  summary(
    `## 화면 재검증 실패\n\n\`${res.status}\`\n\n` + '```\n' + body.slice(0, 500) + '\n```\n',
  )
  process.exit(1)
}

console.log('재검증 완료')
summary('## 화면 재검증 완료\n')
