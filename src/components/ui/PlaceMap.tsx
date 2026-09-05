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
  /*
   * 지도를 움직였는가.
   *
   * 되돌리기를 늘 띄우면 누를 이유가 없는 버튼이 자리만 먹는다.
   * 밀어본 사람에게만 보인다.
   */
  const [moved, setMoved] = useState(false)
  /* 되돌리기가 쓸 지도. 이펙트 밖에서 부르므로 ref 로 들고 있는다 */
  const mapRef = useRef<{ setCenter: (p: unknown) => void; setLevel: (n: number) => void } | null>(null)
  const homeRef = useRef<unknown>(null)
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
          /*
           * 움직일 수 있게 둔다.
           *
           * 한때 고정했다 — 페이지 세로 스크롤을 가로챌까 봐서다.
           * 그런데 확대는 새고 있어서, 손대면 커지는데 밀면 안 밀리는
           * 어중간한 상태가 됐다. 「이게 왜 안 되지」 를 만든다.
           *
           * 스크롤 가로채기는 canvas 의 touch-action 으로 막는다.
           * 가로로 끌면 지도가 움직이고 세로로 쓸면 페이지가 스크롤된다.
           * 밀어서 길을 잃어도 아래 되돌리기로 돌아온다.
           */
          center: pos,
          level: LEVEL,
          draggable: true,
          zoomable: true,
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

        /* 되돌릴 자리와 지도를 들고 있는다 */
        mapRef.current = map as never
        homeRef.current = pos

        /*
         * 움직였을 때만 되돌리기를 띄운다.
         *
         * dragend 와 zoom_changed 를 둘 다 듣는다 — 확대만 해도
         * 원래 배율에서 벗어나므로 되돌릴 것이 생긴다.
         */
        const mark = () => {
          if (!cancelled) setMoved(true)
        }
        kakao.maps.event.addListener(map, 'dragend', mark)
        kakao.maps.event.addListener(map, 'zoom_changed', mark)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      // 카카오 Map 에는 destroy 가 없다. 비우지 않으면 다음 글을 열 때
      // 이전 지도가 남는다
      overlay?.setMap(null)
      mapRef.current = null
      homeRef.current = null
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

  return (
    <>
      {/*
        제목을 새로 달지 않는다. 이 지도 바로 위에 장소명과 주소가 이미
        있어서 「위치」 같은 제목을 얹으면 같은 말을 두 번 하는 꼴이 된다.
        되돌리기만 오른쪽 끝에 붙인다 — 다른 문단과 같은 여백을 쓴다.
      */}
      {moved && (
        <div className="locmap__head locmap__head--bare">
          <button
            type="button"
            className="locmap__reset"
            onClick={() => {
              if (!mapRef.current || !homeRef.current) return
              mapRef.current.setLevel(LEVEL)
              mapRef.current.setCenter(homeRef.current)
              setMoved(false)
            }}
          >
            원래 위치로
          </button>
        </div>
      )}
      <div ref={ref} className="locmap__canvas" />
    </>
  )
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
