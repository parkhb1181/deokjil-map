'use client'

/**
 * 즐겨찾기 (P2).
 *
 * 도메인 문서의 `Bookmark` 다. 한때 「내 코스」였고 코드도 course 였는데,
 * 이름이 즐겨찾기로 바뀌면서 화면과 코드가 다른 말을 하고 있었다.
 *
 * 서버를 두지 않는다. **비회원도 담을 수 있어야 하기 때문이다.**
 * 담기 앞에 가입을 세우면 마찰이 표본을 0으로 만든다(poc-plan 10번).
 * 회원이 되어도 기기에 남으므로 다른 기기에서는 안 보인다. 그 제약은
 * 화면에 적어둔다.
 *
 * 서버로 옮길 때 정할 것 둘 — 합치는 규칙(합집합)과 순서를 지킬지다.
 * 「내 코스」일 때는 순서가 동선이라 의미가 있었는데 즐겨찾기에는
 * 순서를 기대하는 사람이 없다.
 *
 * ⚠️ 이 모듈은 'use client' 다. 서버 컴포넌트에서 import 하지 말 것.
 */

const KEY = 'moyeora.bookmark'
/** 「내 코스」 시절 키. 이미 담아둔 사람의 목록을 잃지 않으려고 한 번 옮긴다 */
const OLD_KEY = 'moyeora.course'

/** 담은 이벤트 id 목록. 담은 순서를 유지한다 */
export function loadBookmarks(): string[] {
  try {
    /* 새 키가 비어 있으면 옛 키를 한 번 읽어 옮긴다. 이름을 바꿨다고
       이미 담아둔 목록이 사라지면 사용자는 우리가 잃어버린 것으로 본다 */
    let raw = localStorage.getItem(KEY)
    if (!raw) {
      const old = localStorage.getItem(OLD_KEY)
      if (old) {
        localStorage.setItem(KEY, old)
        localStorage.removeItem(OLD_KEY)
        raw = old
      }
    }
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    // 시크릿창·저장 차단·깨진 JSON. 담기가 안 될 뿐 앱은 그대로 돈다
    return []
  }
}

export function persistBookmarks(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    /* 저장 실패는 무시한다 */
  }
}
