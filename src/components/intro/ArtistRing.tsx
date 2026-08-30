/**
 * 대상 이름이 원을 따라 돈다.
 *
 * 레퍼런스에서는 이 자리에 클라이언트 로고가 들어간다. 남의 브랜드를
 * 빌려 권위를 만드는 장치다. 우리는 빌릴 필요가 없다.
 * 여기 도는 이름은 전부 지금 events.json 에 실제로 들어 있는 대상이다.
 *
 * 회전은 CSS 로만 돌린다. 자바스크립트가 필요 없고,
 * 모션을 줄이도록 설정한 사용자에게는 CSS 쪽에서 멈춘다.
 *
 * textPath 는 경로 길이를 넘는 글자를 잘라낸다. 이름을 너무 많이 넣으면
 * 마지막 이름이 중간에서 끊기므로 둘레에 맞는 만큼만 받는다.
 */
export default function ArtistRing({ names }: { names: string[] }) {
  return (
    <svg className="in-ring" viewBox="0 0 300 300" aria-hidden="true">
      <defs>
        {/* 반지름 136 의 원. 둘레는 약 855.
            글자는 경로 바깥쪽에 서므로 136 + 글자 높이가 150 을 넘으면 잘린다 */}
        <path
          id="in-ring-path"
          fill="none"
          d="M150,150 m-136,0 a136,136 0 1,1 272,0 a136,136 0 1,1 -272,0"
        />
      </defs>
      <text>
        <textPath href="#in-ring-path">{names.join('  ·  ')}</textPath>
      </text>
    </svg>
  )
}
