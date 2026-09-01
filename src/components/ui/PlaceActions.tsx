'use client'

/**
 * 주소 복사 · 길찾기.
 *
 * 덕플레이스 생카 상세가 이 둘을 주소 바로 밑에 큰 버튼으로 둔다.
 * 보고 나서 이유가 납득됐다. 생카에 가려는 사람이 상세에서 하는 일이
 * 사실상 이 둘뿐이다. 주소를 지도앱에 옮겨 적거나, 길찾기를 열거나.
 * 주소를 글자로만 두면 길게 눌러 드래그해서 복사해야 하는데 모바일에서
 * 그게 잘 안 된다.
 *
 * 길찾기는 카카오맵으로 보낸다. 지도를 카카오로 그리고 있어서 같은
 * 서비스로 이어지는 편이 덜 헷갈린다. 앱이 깔려 있으면 앱이 열리고
 * 아니면 웹이 열린다.
 *
 * 복사에 성공했는지 말해준다. 눌렀는데 아무 변화가 없으면 눌린 건지
 * 알 수 없어 두세 번 더 누른다.
 */
import { useState } from 'react'

export function PlaceActions({ name, address, lat, lng }: {
  name: string
  address: string
  lat?: number | null
  lng?: number | null
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      /* 다시 누를 수 있게 되돌린다. 계속 '복사됐어요' 로 남아 있으면
         두 번째 복사가 먹었는지 알 수 없다 */
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* 권한이 없거나 http 라 클립보드가 막힌 경우. 주소는 바로 위에
         글자로 있으므로 여기서 오류를 띄우면 시끄럽기만 하다 */
    }
  }

  /* 좌표가 있으면 그 지점으로, 없으면 이름으로 찾게 한다 */
  const to =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`
      : `https://map.kakao.com/link/search/${encodeURIComponent(address || name)}`

  return (
    <div className="pact">
      <button type="button" className="pact__btn" onClick={copy} aria-live="polite">
        {copied ? '복사됐어요' : '주소 복사'}
      </button>
      <a className="pact__btn" href={to} target="_blank" rel="noopener noreferrer">
        길찾기
      </a>
    </div>
  )
}
