'use client'

/**
 * 담기 / 내 코스 (P2).
 *
 * 서버를 두지 않는다 — 로그인이 없으니 담은 목록을 붙일 계정이 없고,
 * 계정을 만들면 가입 마찰이 표본을 0으로 만든다(poc-plan 10번).
 * localStorage 로 충분하고, 그래서 Supabase 가 없어도 이 기능은 첫날부터 동작한다.
 *
 * 이게 P2 가 P3(생카 F3 확장)보다 위인 이유이기도 하다 —
 * 제보는 런칭 시점에 비어 있지만 담기는 이미 162건이 있어 지표 3이 바로 찍힌다.
 *
 * ⚠️ 이 모듈은 'use client' 다. 서버 컴포넌트에서 import 하지 말 것.
 */

const KEY = 'moyeora.course'

/** 담은 이벤트 id 목록. 담은 순서를 유지한다 — 코스는 순서가 의미를 가진다 */
export function loadCourse(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    // 시크릿창·저장 차단·깨진 JSON. 담기가 안 될 뿐 앱은 그대로 돈다
    return []
  }
}

export function persistCourse(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    /* 저장 실패는 무시한다 */
  }
}
