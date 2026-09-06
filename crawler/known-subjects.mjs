/**
 * 한 번이라도 있었던 대상의 원장.
 *
 * events.json 은 끝난 행사를 지운다 (poc-plan 4.3, "지난 정보는 없는 정보보다
 * 나쁘다"). 그런데 `/a/성호` 같은 대상 주소는 그 데이터로 만들어지므로,
 * 마지막 생카가 끝나면 다음 빌드에서 페이지 자체가 사라지고 404 가 된다.
 *
 * 이미 뿌린 링크가 전부 깨진다. 성호 글 하나가 링크 클릭 70 을 만들었는데
 * 그 주소가 9월 7일에 죽는 식이다. 밖에서 들어오는 사람에게 404 는
 * "이 서비스가 없어졌다" 로 읽힌다.
 *
 * 그래서 대상 이름만 따로 남긴다. **행사를 되살리는 것이 아니다** — 지난
 * 행사는 목록에 안 돌아온다. 남는 것은 이름과 마지막 종료일뿐이고, 그
 * 주소는 200 으로 "지금은 없다" 고 말하는 화면이 된다.
 *
 * 지우지 않는다. 한 번 뿌려진 주소는 계속 살아 있어야 하고, 대상이
 * 돌아오면(내년 생일) 같은 주소가 그대로 다시 채워진다.
 */

/** 파일 위치. 앱이 빌드타임에 번들로 굽는다 */
export const LEDGER_PATH = 'src/data/known-subjects.json'

/**
 * 원장에 이번 수집분을 얹는다.
 *
 * 이름이 이미 있으면 마지막 종료일만 뒤로 민다. 앞으로 당기지 않는다 —
 * 수집 범위가 좁아져 예전 행사가 이번 결과에 없을 수 있고, 그때 날짜를
 * 되돌리면 "9월 6일에 끝났어요" 가 거짓말이 된다.
 *
 * 키로 정렬해서 쓴다. 매일 도는 봇이 만드는 커밋이라, 순서가 흔들리면
 * 내용이 같은 날도 전부 diff 로 잡힌다.
 *
 * @param {Record<string, {lastEndsOn: string, kind: string}>} existing
 * @param {{subject: string, endsOn: string, kind: string}[]} events
 */
export function mergeLedger(existing, events) {
  const out = { ...existing }

  for (const ev of events) {
    const subject = (ev.subject ?? '').trim()
    if (!subject || !ev.endsOn) continue

    const prev = out[subject]
    if (prev && prev.lastEndsOn >= ev.endsOn) continue

    // 마지막에 끝나는 행사의 유형을 쓴다. 빈 화면이 "생카는 지금 없어요"
    // 라고 말할 때 그 단어가 여기서 온다
    out[subject] = { lastEndsOn: ev.endsOn, kind: ev.kind }
  }

  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )
}
