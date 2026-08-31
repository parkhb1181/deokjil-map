'use client'

/**
 * 만남 장소 지도.
 *
 * 상세 시트의 DetailMap 과 하는 일이 같지만 받는 것이 다르다.
 * 그쪽은 EventItem 을 통째로 받고 이쪽은 좌표와 이름만 받는다.
 * 모집글에는 EventItem 이 없다.
 *
 * 클래스는 globals.css 의 locmap 을 그대로 쓴다. 새로 만들면
 * 같은 물건이 두 화면에서 다르게 보인다.
 *
 * 좌표는 글쓴이가 찍는 것이 아니다. 텍스트로 받은 장소를 서버가
 * 지오코딩해서 채운다. 실패하면 null 이고 그때는 아무것도 안 그린다.
 * 주소는 바로 아래 적혀 있으니 여기서 오류를 띄우면 시끄럽기만 하다.
 */
import { useEffect, useRef, useState } from 'react'
import { KAKAO_JS_KEY, loadKakaoMaps, type KakaoCustomOverlay } from '@/lib/kakao'

/** 건물과 주변 골목이 같이 읽히는 정도 */
const LEVEL = 4

export function PlaceMap({ lat, lng, label }: {
  lat?: number | null
  lng?: number | null
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const has = Number.isFinite(lat) && Number.isFinite(lng)

  useEffect(() => {
    if (!KAKAO_JS_KEY || !has) return
    let cancelled = false
    let overlay: KakaoCustomOverlay | null = null

    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !ref.current) return
        const pos = new kakao.maps.LatLng(lat as number, lng as number)
        const map = new kakao.maps.Map(ref.current, {
          center: pos,
          level: LEVEL,
          // 위치를 알려주는 지도지 탐색하는 지도가 아니다.
          // 페이지 스크롤을 가로채면 지나가지 못한다
          draggable: false,
          zoomable: false,
        })

        const el = document.createElement('div')
        el.className = 'pin pin--birthday_cafe pin--static'
        el.innerHTML =
          '<span class="pin__kind">만남</span>' +
          '<span class="pin__name"></span>' +
          '<span class="pin__tail"></span>'
        // 장소명은 사용자가 쓴 값이라 textContent 로 넣는다
        el.querySelector('.pin__name')!.textContent = label

        overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, map, yAnchor: 1 })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      // 카카오 Map 에는 destroy 가 없다. 비우지 않으면 다음 글을 열 때
      // 이전 지도가 남는다
      overlay?.setMap(null)
      if (ref.current) ref.current.innerHTML = ''
    }
  }, [lat, lng, label, has])

  if (!KAKAO_JS_KEY || !has || failed) {
    /* 배포에는 키가 있어 이 자리는 진짜 지도다. 로컬에 키가 없을 때
       아무것도 안 그리면 화면을 확인할 수 없으므로 느낌만 내는 그림을
       둔다. 진짜 지도 화면을 캡처해 넣지 않는 것은 그것도 남의
       저작물이기 때문이다. 배포에서 키가 없으면 그냥 안 그린다.
       주소가 바로 아래 있어 알려줄 것도 없이 시끄럽기만 하다 */
    if (process.env.NODE_ENV !== 'development') return null
    return <FakeMap label={label} />
  }

  return <div ref={ref} className="locmap__canvas" />
}

/**
 * 지도가 있을 자리를 보여주는 그림. 개발 중에만 쓴다.
 *
 * 길과 블록을 대충 그린 것이지 실제 지형이 아니다. 배치와 무게를
 * 보려는 것이라 그 이상은 필요 없다.
 */
function FakeMap({ label }: { label: string }) {
  return (
    <div className="fmap">
      <svg viewBox="0 0 320 200" aria-hidden focusable="false">
        <rect width="320" height="200" fill="#eef1ec" />
        {/* 블록 */}
        {[
          [12, 14, 78, 52], [104, 10, 60, 40], [178, 16, 52, 46], [244, 12, 64, 38],
          [10, 84, 66, 46], [92, 92, 74, 38], [182, 88, 58, 50], [254, 86, 56, 44],
          [16, 148, 84, 40], [116, 152, 62, 36], [194, 150, 52, 38], [260, 146, 48, 42],
        ].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill="#e2e6df" />
        ))}
        {/* 큰길 */}
        <path d="M0 78 H320" stroke="#fff" strokeWidth="13" />
        <path d="M0 140 H320" stroke="#fff" strokeWidth="9" />
        <path d="M96 0 V200" stroke="#fff" strokeWidth="11" />
        <path d="M240 0 V200" stroke="#fff" strokeWidth="7" />
        {/* 지하철 */}
        <path d="M0 78 H320" stroke="#c9d8c2" strokeWidth="3" strokeDasharray="14 8" />
      </svg>
      <span className="fmap__pin">
        <b>{label}</b>
      </span>
      <span className="fmap__tag">지도 자리</span>
    </div>
  )
}
