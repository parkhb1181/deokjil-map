import type { EventItem } from '@/types'

/**
 * OG 카드에 올릴 행사를 고른다.
 *
 * 카드를 타임라인에서 멈추게 하는 것은 글자가 아니라 사진인데
 * (`src/app/a/[subject]/opengraph-image.tsx`), 그 사진을 고르는 규칙이
 * 없었다. 데이터 순서대로 앞에서 세 장이었고 그 순서는 수집 순서다.
 *
 * 그래서 **카드 석 장이 거의 항상 홍대였다.** 생카의 절반 넘게가 홍대에
 * 있으니 앞에서 세면 당연히 그렇게 된다. 우리는 위치로 모아 보여주는
 * 서비스인데 그 축이 정작 카드에서 안 보인다. 서른 곳이 걸린 대상도
 * 한 동네 사진 셋이면 "홍대 카페 세 곳" 으로 읽힌다.
 *
 * 그래서 지역을 돌아가며 한 장씩 뽑는다. 큰 지역부터 시작하므로 지역이
 * 하나뿐인 대상은 예전처럼 그 지역에서 셋이 나오고, 여럿이면 첫 바퀴에
 * 서로 다른 동네가 걸린다. 같은 지역 안에서는 시작일 이른 순이다 —
 * 카드를 보고 오늘 갈 수 있는 곳이 앞에 오는 편이 낫다.
 *
 * 동점을 id 로 끊는 것은 취향이 아니라 **필요**다. `scripts/og-shots.mjs`
 * 가 빌드 전에 여기서 고른 것과 똑같은 것을 줄여 놓아야 카드에 사진이
 * 뜬다. 두 곳이 같은 입력에서 같은 답을 내려면 동점이 남으면 안 된다.
 *
 * 끝난 행사는 여기서 안 거른다. `crawler/to-events.mjs` 가 넣을 때
 * 이미 뺀다(poc-plan 4.3). 여기서 한 번 더 걸러도 걸리는 게 없다.
 *
 * ─────────────────────────────────────────────────────────
 * **`scripts/og-shots.mjs` 의 `pickShots` 와 같은 규칙이어야 한다.**
 * 그쪽은 순수 Node ESM 이라 이 모듈을 못 불러온다. `src/lib/poster.ts`
 * 와 `og-shots.mjs` 의 `source()` 가 갈라져 있는 것과 같은 사정이고,
 * 규칙을 고치면 양쪽을 같이 고쳐야 하는 것도 같다.
 *
 * 두 곳 다 `events.json` 만 보고 답을 낸다. 시각처럼 부를 때마다
 * 달라지는 것을 섞지 않는다. 빌드가 자정을 넘기면 갈라진다.
 */
export function pickShots(events: EventItem[], count: number): EventItem[] {
  const lanes = new Map<string, EventItem[]>()
  for (const ev of events.filter((e) => e.imageUrl).sort(byStartThenId)) {
    const lane = lanes.get(ev.place.district)
    if (lane) lane.push(ev)
    else lanes.set(ev.place.district, [ev])
  }

  /* 큰 지역부터 돈다. 길이가 같을 때의 순서도 id 로 못박는다 */
  const ordered = [...lanes.values()].sort(
    (a, b) => b.length - a.length || a[0].id.localeCompare(b[0].id),
  )

  const picked: EventItem[] = []
  for (let round = 0; picked.length < count; round++) {
    let took = false
    for (const lane of ordered) {
      if (round >= lane.length) continue
      picked.push(lane[round])
      took = true
      if (picked.length === count) break
    }
    // 모든 지역이 바닥났다. 더 돌아도 안 나온다
    if (!took) break
  }
  return picked
}

function byStartThenId(a: EventItem, b: EventItem): number {
  return a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id)
}
