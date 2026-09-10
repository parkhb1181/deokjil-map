'use client'

/**
 * 헤더에 그릴 내 이름·사진을 이 기기에 적어둔다.
 *
 * ─────────────────────────────────────────────────────────
 * **왜 캐시가 필요한가.**
 *
 * 홈 헤더가 「내 활동」 이라는 글자만 그릴 때는 `localStorage` 의 토큰
 * 유무만 보면 됐다. 이름과 사진을 그리기로 하면서 「누구인가」 가
 * 필요해졌는데, 그 값은 서버에만 있다.
 *
 * 매번 서버를 기다렸다가 그리면 **가장 많이 열리는 화면의 오른쪽 위가
 * 한 박자 늦게 나타난다.** 첫 프레임에 빈 자리였다가 이름이 튀어나오는
 * 것은 로그인이 풀린 것처럼도 보인다.
 *
 * 그래서 마지막으로 받은 값을 적어두고 **먼저 그린 다음 서버 값으로
 * 덮는다.** 이름을 바꾸면 다음 방문에 반영된다 — 이 자리에서 한 박자
 * 늦는 대가로는 싸다.
 *
 * **로그아웃하면 지운다.** 안 지우면 다음 사람이 이 기기에서 남의
 * 이름을 잠깐 본다 (`session.ts` 의 `clearTokens` 가 같이 부른다).
 */

const KEY = 'duckmoim.me'

export interface MeBrief {
  nickname: string
  /** 없으면 색 블록에 첫 글자를 그린다 */
  image: string | null
}

export function saveMe(me: MeBrief): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(me))
  } catch {
    /* 저장이 막힌 브라우저. 매번 서버 값을 기다릴 뿐이라 화면은 돈다 */
  }
}

export function loadMe(): MeBrief | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<MeBrief>
    /* 예전 형식이 남아 있을 수 있다. 이름이 없으면 없는 것으로 본다 */
    if (typeof v?.nickname !== 'string' || !v.nickname) return null
    return { nickname: v.nickname, image: typeof v.image === 'string' ? v.image : null }
  } catch {
    return null
  }
}

export function clearMe(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 위와 같다 */
  }
}
