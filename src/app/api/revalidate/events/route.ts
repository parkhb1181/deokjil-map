import { timingSafeEqual } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

/**
 * 크롤러가 적재 성공 직후 부르는 온디맨드 재검증 (D-10 · D-12, API-설계.md).
 *
 * **부르는 주체가 크롤러 스텝이다. 백엔드가 아니다.** 크롤러가 적재 응답의
 * `created`·`updated`·`hidden` 을 들고 있어 "바뀌었는지"를 아는 유일한
 * 주체이고, 백엔드가 부르게 하면 outbound 의존·실패 처리·새 시크릿이 늘고
 * 트랜잭션 밖 호출 설계가 필요해진다 (D-12).
 *
 * 정적 키를 헤더로 받는다. `INGEST_KEY`(D-11)와 같은 패턴 — 사람이 아니라
 * 스크립트가 부르므로 JWT 를 쓸 이유가 없고, 공개로 두면 누구나 재빌드를
 * 유발해 Vercel 빌드 시간을 태울 수 있다.
 */

/**
 * 길이가 다르면 `timingSafeEqual` 이 던진다. 여기서 먼저 걸러도 타이밍
 * 공격 표면이 늘지 않는다 — 길이는 비교 전에 이미 알 수 있는 값이다.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(request: Request) {
  const key = process.env.REVALIDATE_KEY

  // 키를 등록 안 했으면 라우트를 통째로 막는다. 둘 다 빈 문자열이라 통과되는
  // 사고를 피한다 — INGEST_KEY 미등록 시 스크립트가 스스로 건너뛰는 것과
  // 다르게, 여기는 요청을 받는 쪽이라 "없으면 막는다"가 안전한 기본값이다
  if (!key) {
    return NextResponse.json({ error: 'REVALIDATE_KEY 가 설정되지 않았다' }, { status: 503 })
  }

  const provided = request.headers.get('x-revalidate-key') ?? ''
  if (!safeEqual(provided, key)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  /**
   * 루트 레이아웃 기준으로 통째로 재검증한다.
   *
   * 이 잡이 하루 한 번(또는 수동 재실행)만 돌아 호출 빈도가 낮고, 크롤러는
   * 적재 응답 셋(총·신규·갱신)만 받아 개별 externalId 목록은 넘기지 않는다
   * (D-9 가 적재 API 를 externalId 접두어 유도 대신 명시로 정한 것과 별개로,
   * 벌크 응답 자체가 건별 목록을 안 싣는다). 개별 페이지 단위로 좁히려면
   * 크롤러가 변경된 id 목록을 이 라우트에 실어 보내야 하는데, 지금 필요를
   * 넘어서는 설계다 — 하루 한 번의 전체 재검증이면 충분하다.
   */
  revalidatePath('/', 'layout')

  return NextResponse.json({ revalidated: true, now: Date.now() })
}
