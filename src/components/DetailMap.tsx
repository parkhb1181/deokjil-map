'use client'

import { useEffect, useRef, useState } from 'react'
import type { EventItem } from '@/types'
import { KAKAO_JS_KEY, loadKakaoMaps, type KakaoCustomOverlay } from '@/lib/kakao'

interface Props {
  event: EventItem
}

/** 한 곳만 보여줄 때의 배율. 건물과 주변 골목이 같이 읽히는 정도 */
const DETAIL_LEVEL = 4

/**
 * 상세 화면의 위치 지도.
 *
 * 지도 탭과 달리 이 행사 하나만 찍는다. 여기서 알고 싶은 것은
 * "어디에 있나"이지 "근처에 또 뭐가 있나"가 아니다.
 *
 * 키가 없거나 로드에 실패하면 아무것도 그리지 않는다. 주소는 이미 위에
 * 적혀 있으니, 여기서 에러 문구를 띄우면 알려줄 것도 없이 시끄럽기만 하다.
 */
export default function DetailMap({ event }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  /*
   * 지도를 움직였는가.
   *
   * 「원래 위치로」 를 늘 띄우면 누를 이유가 없는 버튼이 자리만 먹는다.
   * 밀어본 사람에게만 보인다.
   */
  const [moved, setMoved] = useState(false)
  /* 되돌리기가 쓸 지도. 이펙트 밖에서 부르므로 ref 로 들고 있는다 */
  const mapRef = useRef<{ setCenter: (p: unknown) => void; setLevel: (n: number) => void } | null>(null)
  const homeRef = useRef<unknown>(null)

  const { lat, lng } = event.place
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)

  useEffect(() => {
    if (!KAKAO_JS_KEY || !hasCoords) return
    let cancelled = false
    let overlay: KakaoCustomOverlay | null = null

    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !containerRef.current) return

        const pos = new kakao.maps.LatLng(lat, lng)
        const map = new kakao.maps.Map(containerRef.current, {
          center: pos,
          level: DETAIL_LEVEL,
          /*
           * 움직일 수 있게 둔다.
           *
           * 한때 고정했다 — 시트 안에서 세로 스크롤을 가로챌까 봐서다.
           * 그런데 확대는 새고 있어서, 손대면 커지는데 밀면 안 밀리는
           * 어중간한 상태가 됐다. 「이게 왜 안 되지」 를 만든다.
           *
           * 스크롤 가로채기는 아래 touch-action 으로 막는다. 가로로
           * 끌면 지도가 움직이고 세로로 쓸면 페이지가 스크롤된다.
           */
          draggable: true,
          zoomable: true,
        })

        // 지도 탭과 같은 라벨 핀을 쓴다. 두 화면에서 같은 것이 같아 보여야 한다
        const el = document.createElement('div')
        el.className = `pin pin--${event.kind} pin--static`
        el.innerHTML =
          `<span class="pin__kind">${event.kind === 'BIRTHDAY_CAFE' ? '생카' : '팝업'}</span>` +
          `<span class="pin__name"></span>` +
          `<span class="pin__tail"></span>`
        // 장소명은 사용자 데이터라 textContent 로 넣는다
        el.querySelector('.pin__name')!.textContent = event.place.name

        overlay = new kakao.maps.CustomOverlay({
          position: pos,
          content: el,
          map,
          yAnchor: 1,
        })

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
      // 카카오 Map 에는 destroy 가 없다. 컨테이너를 비우지 않으면 다른 행사를
      // 열 때 이전 지도가 남는다 (MapView 에서 겪은 것과 같은 문제)
      overlay?.setMap(null)
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [event.kind, event.place.name, lat, lng, hasCoords])

  if (!KAKAO_JS_KEY || !hasCoords || failed) return null

  return (
    <section className="locmap">
      <div className="locmap__head">
        <h3 className="locmap__title">위치</h3>
        {/* 밀어본 사람에게만 보인다. 누르면 행사 자리로 되돌아간다 */}
        {moved && (
          <button
            type="button"
            className="locmap__reset"
            onClick={() => {
              if (!mapRef.current || !homeRef.current) return
              mapRef.current.setLevel(DETAIL_LEVEL)
              mapRef.current.setCenter(homeRef.current)
              setMoved(false)
            }}
          >
            원래 위치로
          </button>
        )}
      </div>
      <div ref={containerRef} className="locmap__canvas" />
    </section>
  )
}
