/**
 * 헤더 로고. 오리 마크 + 글자.
 *
 * 글자를 이미지로 만들지 않는다. 실제 폰트로 짜야 확대·번역·검색에서 살아남고,
 * 이미지 글자는 화면 크기마다 흐려진다.
 */
export default function Logo() {
  return (
    <span className="logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo__mark" src="/duck.png" alt="" width={25} height={32} />
      <span className="logo__word">덕모임</span>
    </span>
  )
}
