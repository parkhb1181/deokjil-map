/**
 * 한 번이라도 있었던 대상.
 *
 * `crawler/known-subjects.mjs` 가 쓰고 여기서 읽는다. 왜 이 파일이 있는지는
 * 그쪽 주석에 있다 — 요약하면, 마지막 행사가 끝나도 `/a/성호` 주소는
 * 살아 있어야 하기 때문이다. 이미 뿌린 링크가 그날 404 가 되면 밖에서
 * 들어온 사람에게는 서비스가 없어진 것으로 읽힌다.
 *
 * events.json 과 달리 이 파일은 **줄지 않는다.** 그래서 목록·사이트맵에
 * 쓰면 안 된다. 지난 행사를 되살리는 것이 되고, 그건 poc-plan 4.3 이
 * 금지한 것이다. 쓰는 자리는 하나 — 어떤 주소를 만들어 둘지 정할 때다.
 */
import ledger from '@/data/known-subjects.json'
import type { EventKind } from '@/types'

export interface KnownSubject {
  /** 마지막 행사의 종료일. 'YYYY-MM-DD' */
  lastEndsOn: string
  /** 마지막 행사의 유형. 빈 화면이 「생카」 인지 「팝업」 인지 말할 때 쓴다 */
  kind: EventKind
}

const KNOWN = ledger as Record<string, KnownSubject>

/** 원장에 있는 대상 이름 전부 */
export function knownSubjectNames(): string[] {
  return Object.keys(KNOWN)
}

/** 없으면 null. 원장에 없는 이름은 한 번도 존재한 적 없는 대상이다 */
export function knownSubject(subject: string): KnownSubject | null {
  return KNOWN[subject] ?? null
}
