/**
 * IndexNow 로 색인 요청을 통보한다.
 *
 * 사이트맵은 "여기 있으니 언제 오면 보인다" 이고, IndexNow 는 "지금 봐 달라" 다.
 * 신규 도메인은 크롤러가 아직 안 오는 게 문제라 기다리는 대신 부르는 쪽이 맞다.
 *
 * 참여 엔진 하나에만 쏘면 나머지에도 공유된다(프로토콜 규약).
 * 그래도 네이버에 직접 쏜다. 이 서비스의 검색 유입에서 네이버 비중이 크고,
 * 공유가 언제 반영되는지는 보장돼 있지 않다.
 * 참여 목록 원본: https://www.indexnow.org/searchengines.json
 *
 * 키 파일은 public/{key}.txt 로 루트에 서빙돼야 한다. 그게 도메인 소유 증명이다.
 *
 * 사용: node scripts/indexnow.mjs [--dry]
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const HOST = 'duckmoim.com'
const ORIGIN = `https://${HOST}`
const DRY = process.argv.includes('--dry')

/** 공식 참여 목록에서 확인한 엔드포인트 */
const ENDPOINTS = [
  { name: '네이버', url: 'https://searchadvisor.naver.com/indexnow' },
  { name: 'Bing', url: 'https://www.bing.com/indexnow' },
]

const key = (await fs.readFile(path.join(ROOT, '.indexnow-key'), 'utf8')).trim()
if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
  throw new Error(`키 형식이 잘못됐다: ${key}`)
}

// 키 파일이 실제로 서빙되는지 먼저 본다. 이게 없으면 전부 403 이다
const keyUrl = `${ORIGIN}/${key}.txt`
const keyRes = await fetch(keyUrl).catch(() => null)
const served = keyRes?.ok ? (await keyRes.text()).trim() : null
if (served !== key) {
  console.error(`키 파일이 아직 안 뜬다: ${keyUrl} (응답 ${keyRes?.status ?? '실패'})`)
  console.error('배포가 끝난 뒤에 다시 실행해라.')
  process.exit(1)
}
console.log(`키 파일 확인: ${keyUrl}`)

// 사이트맵과 같은 목록을 쓴다. 두 곳에서 규칙이 갈리면 언젠가 어긋난다
const events = JSON.parse(await fs.readFile(path.join(ROOT, 'src/data/events.json'), 'utf8'))
const subjects = [...new Set(events.map((e) => e.subject?.trim()).filter(Boolean))]
const urlList = [
  ORIGIN,
  ...subjects.map((s) => `${ORIGIN}/a/${encodeURIComponent(s)}`),
  ...events.map((e) => `${ORIGIN}/e/${encodeURIComponent(e.id)}`),
]

console.log(`통보할 URL ${urlList.length}개 (홈 1 + 대상 ${subjects.length} + 행사 ${events.length})`)
if (DRY) {
  console.log('--dry 라 실제로 보내지 않는다.')
  console.log(urlList.slice(0, 3).join('\n'), '\n...')
  process.exit(0)
}

for (const ep of ENDPOINTS) {
  try {
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key, keyLocation: keyUrl, urlList }),
    })
    // 200 접수, 202 접수(키 검증 대기). 그 외는 본문에 이유가 있다
    const body = await res.text().catch(() => '')
    console.log(`${ep.name.padEnd(6)} ${res.status} ${res.statusText} ${body.slice(0, 160)}`)
  } catch (err) {
    console.log(`${ep.name.padEnd(6)} 실패: ${err.message}`)
  }
}
