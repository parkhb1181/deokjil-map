/**
 * 헤더 로고.
 *
 * 오리와 글자를 따로 두지 않고 락업 이미지 하나를 쓴다.
 * 글자에 걸린 페이드와 그림자, 오리와 겹치는 간격이 디자인의 일부라
 * 폰트로 다시 짜면 그게 재현되지 않는다.
 *
 * alt 에 브랜드명을 넣어 이미지가 안 떠도 이름은 읽힌다.
 */
export default function Logo() {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img className="logo" src="/logo.png" alt="덕모임" width={266} height={120} />
  )
}
