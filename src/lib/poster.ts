/**
 * 수집원 포스터 주소를 화면에 맞는 크기로 바꾼다.
 *
 * 우리가 사진을 복제해 두지 않고 원본 서버 주소를 그대로 들고 있는데
 * (CLAUDE.md), **그 원본이 장당 1.8~4.9MB 다.** 실측한 값이다.
 *
 *   offmate  196장 · 1.8~4.9MB JPEG
 *   popga     15장 · 0.08~0.18MB webp   ← 이미 썸네일 주소를 준다
 *
 * 240px 카드에 4.9MB 를 물리는 셈이라, 받는 쪽도 줄이는 쪽도 손해다.
 * Vercel 이미지 최적화가 그 원본을 통째로 받아 디코딩하는데 그 CPU 가
 * 청구서에서 두 번째로 큰 줄이었다.
 *
 * **offmate 가 `?w=` 를 받는다.** 자기네 CDN 기능이고, 확인해보니
 * 1.82MB 짜리가 w=640 에서 148KB 로 온다. 폭도 128부터 1080까지 다 된다.
 * 우리가 원본을 손대는 것이 아니라 그쪽이 주는 크기를 고르는 것이라,
 * 재게시하지 않는다는 규칙과도 어긋나지 않는다.
 *
 * popga 는 파라미터를 안 받는다. 대신 이미 480px 썸네일 주소를 주므로
 * 손댈 것이 없다. 그래서 여기서는 offmate 만 바꾼다.
 *
 * 못 알아보는 주소는 그대로 돌려준다. 수집원이 늘 때 여기를 안 고쳐도
 * 화면은 계속 뜬다. 느려질 뿐이다.
 */

/** `?w=` 를 받는다고 확인한 곳. 다른 데는 손대지 않는다 */
const RESIZABLE = 'img2.offmate.kr'

/**
 * 최대 폭.
 *
 * 화면에서 이 사진을 제일 크게 쓰는 자리가 이벤트 상세의 포스터이고,
 * 그다음이 1위 카드(420px)다. 고밀도 화면을 감안해도 1080 이면 남는다.
 * 이보다 크게 받아봐야 줄여서 그리므로 데이터만 버린다.
 *
 * next/image 에 넘길 때도 이 폭이 원본이 된다. 여기서 더 작게 잡으면
 * Vercel 이 늘려 그려서 뭉개진다.
 */
export const POSTER_MAX = 1080

/**
 * 화면에 쓸 포스터 주소.
 *
 * @param url 수집한 원본 주소. 없으면 undefined 를 돌려준다
 * @param width 필요한 폭. 기본은 최대 폭이다
 */
export function posterSrc(url: string | null | undefined, width = POSTER_MAX): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    if (u.hostname !== RESIZABLE) return url
    /* 이미 폭이 붙어 있으면 그대로 둔다. 두 번 붙이지 않는다 */
    if (u.searchParams.has('w')) return url
    u.searchParams.set('w', String(width))
    return u.toString()
  } catch {
    /* 주소가 아니면 건드리지 않는다. 로컬 경로(/avatar/a1.webp)가 여기로 온다 */
    return url
  }
}
