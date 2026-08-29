'use client'

import { useEffect, useState } from 'react'

/**
 * 헤더 로고.
 *
 * public/logo.svg 를 넣으면 자동으로 그림 로고가 되고, 없으면 글자 로고로 남는다.
 * 코드를 건드릴 필요가 없다. png 를 쓸 거면 SRC 만 바꾼다.
 *
 * img 를 먼저 그려두고 onError 로 떨어뜨리지 않는다. 서버가 그린 img 는
 * React 가 붙기 전에 이미 실패가 끝나 있어서 핸들러가 못 받고,
 * 깨진 이미지 아이콘이 그대로 남는다. 그래서 글자를 기본으로 두고
 * 로드에 성공했을 때만 그림으로 바꾼다.
 */
const SRC = '/logo.svg'

export default function Logo() {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setSrc(SRC)
    img.src = SRC
  }, [])

  if (!src) return <span className="logo__word">덕모임</span>

  /* eslint-disable-next-line @next/next/no-img-element */
  return <img className="logo__img" src={src} alt="덕모임" />
}
