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
 * 지도가 있을 자리. 개발 중에만 쓴다.
 *
 * 카카오 키가 없는 로컬에서 배치를 확인하려고 캡처 한 장을 깔았다.
 * public/dev/ 아래에 두고 이 컴포넌트는 개발에서만 그리므로 배포된
 * 화면에는 나오지 않는다. 배포에는 키가 있어 진짜 지도가 그려진다.
 *
 * 캡처는 지도 서비스의 화면이라 우리 것이 아니다. 임시로 쓰는
 * 자리표시자이고 실제 화면에 싣지 않는다.
 */
function FakeMap({ label }: { label: string }) {
  return (
    <div className="fmap">
      <img src="/dev/map-sample.webp" alt="" />
      <span className="fmap__pin">
        <b>{label}</b>
      </span>
      <span className="fmap__tag">지도 자리</span>
    </div>
  )
}
