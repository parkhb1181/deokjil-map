/**
 * 대상별 ASCII 별칭.
 *
 * 왜 필요한가: X 는 URL 안의 한글 앞에서 링크를 끊는다.
 * `duckmoim.com/a/정국` 을 올리면 t.co 가 `duckmoim.com/a` 로만 걸리고 404 가 뜬다.
 * 실측으로 확인했다(t.co/fZ9YUpHlar). 커뮤니티에 뿌리는 링크는 전부 이 문제를 만난다.
 *
 * 로마자 표기를 지어내지 않는다. 한국어 이름의 로마자는 규칙만으로 정해지지 않고
 * (정국은 규정상 jeong-guk 이지만 팬들이 쓰는 표기는 jungkook 이다),
 * 틀린 표기로 링크를 뿌리면 되돌리기 어렵다.
 * 그래서 **주최자·팬덤이 실제로 쓰는 것을 확인한 대상만** 여기에 넣는다.
 * 없는 대상은 한글 주소만 남고, 그건 브라우저에서 정상 동작한다.
 *
 * 확인 근거는 각 줄에 적는다. 근거 없이 줄을 추가하지 마라.
 */
export const SUBJECT_SLUGS: Record<string, string> = {
  // 주최자 계정과 공식 해시태그에서 확인
  정국: 'jungkook', // #JUNGKOOK
  성호: 'sungho', // @targetsungho, #sungho
  장원영: 'wonyoung', // #JANGWONYOUNG, #WONYOUNG
  준규: 'junkyu', // #JUNKYU
  안유진: 'anyujin', // 디시 안유진 마이너갤 id=anyujin
}

/** 별칭 → 대상명 */
const BY_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SUBJECT_SLUGS).map(([subject, slug]) => [slug, subject]),
)

/** 주소 조각을 대상명으로 되돌린다. 한글 주소와 ASCII 별칭 둘 다 받는다 */
export function resolveSubject(raw: string): string {
  const decoded = decodeURIComponent(raw)
  return BY_SLUG[decoded.toLowerCase()] ?? decoded
}

/**
 * 공유용 주소 조각.
 * 별칭이 있으면 그것을, 없으면 퍼센트 인코딩한 한글을 준다.
 * 퍼센트 인코딩도 전부 ASCII 라 X 가 끊지 않는다.
 */
export function shareSlug(subject: string): string {
  return SUBJECT_SLUGS[subject] ?? encodeURIComponent(subject)
}
