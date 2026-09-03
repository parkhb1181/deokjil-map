'use client'

/**
 * 만날 자리 찍기.
 *
 * PlaceMap 은 이미 정해진 자리를 보여주는 지도고, 이쪽은 고르는
 * 지도다. 하나로 합치지 않은 것은 둘이 반대 물건이기 때문이다.
 * 보여주는 지도는 스크롤을 가로채면 안 돼서 draggable 을 끄는데,
 * 고르는 지도는 끌어서 옮기지 못하면 아무 데도 못 찍는다.
 *
 * 글로 적는 칸을 없애지 않는다. 핀은 "여기 어디쯤" 이고 글은
 * "성수역 3번 출구" 다. 핀만 있으면 만나는 자리에 도착해서도
 * 서로를 못 찾는다. 반대로 글만 있으면 처음 가는 동네에서 그게
 * 어디인지 모른다. 둘 다 있어야 한다.
 *
 * **그 칸을 여기 안으로 들였다.** 밖에 별도 「만나는 곳」 항목으로
 * 두었더니 지도와 입력칸이 다른 물건처럼 보였다. 찍은 자리 바로
 * 아래에 이름을 적게 하면 무엇에 붙이는 이름인지가 눈으로 이어진다.
 *
 * **핀이 필수다** (PO-03). 계약이 좌표 누락을 400 으로 막는다.
 */
import { useEffect, useRef, useState } from 'react'
import { KAKAO_JS_KEY, loadKakaoMaps, type KakaoCustomOverlay } from '@/lib/kakao'

export type Pin = { lat: number; lng: number }

/** 서울시청. 서울 밖 행사를 다루지 않으므로 여기서 시작한다 */
const SEOUL: Pin = { lat: 37.5665, lng: 126.978 }
/** 건물과 골목이 같이 읽히는 정도 */
const LEVEL = 4

function pinEl(label: string) {
  const el = document.createElement('div')
  el.className = 'pin pin--birthday_cafe pin--static'
  el.innerHTML =
    '<span class="pin__kind">만남</span>' +
    '<span class="pin__name"></span>' +
    '<span class="pin__tail"></span>'
  /* 사용자가 쓴 값이라 textContent 로 넣는다 */
  el.querySelector('.pin__name')!.textContent = label
  return el
}

export function PlacePicker({ pin, label, onPick, onLabel, error }: {
  pin: Pin | null
  /** 핀에 얹을 이름. 아직 안 적었으면 '만날 곳' */
  label: string
  onPick: (p: Pin | null) => void
  /** 이름 입력. 이 칸이 이 컴포넌트 안에 있다 */
  onLabel: (v: string) => void
  /** 핀이나 이름이 비었을 때의 문구. 하나로 합쳐 받는다 */
  error?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  /* onPick 과 label 이 렌더마다 새로 만들어져도 지도를 다시 만들지
     않는다. 다시 만들면 찍을 때마다 지도가 처음 자리로 튄다 */
  const latest = useRef({ onPick, label })
  latest.current = { onPick, label }

  useEffect(() => {
    if (!KAKAO_JS_KEY) return
    let cancelled = false
    let overlay: KakaoCustomOverlay | null = null

    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !ref.current) return
        const start = pin ?? SEOUL
        const map = new kakao.maps.Map(ref.current, {
          center: new kakao.maps.LatLng(start.lat, start.lng),
          level: LEVEL,
        })

        const draw = (p: Pin) => {
          overlay?.setMap(null)
          overlay = new kakao.maps.CustomOverlay({
            position: new kakao.maps.LatLng(p.lat, p.lng),
            content: pinEl(latest.current.label || '만날 곳'),
            map,
            yAnchor: 1,
          })
        }
        if (pin) draw(pin)

        kakao.maps.event.addListener(map, 'click', (e) => {
          const p = { lat: e.latLng.getLat(), lng: e.latLng.getLng() }
          draw(p)
          latest.current.onPick(p)
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      /* 카카오 Map 에는 destroy 가 없다. 비우지 않으면 다음에 열 때
         이전 지도가 남는다 */
      overlay?.setMap(null)
      if (ref.current) ref.current.innerHTML = ''
    }
    /* 처음 한 번만 만든다. pin 이 바뀔 때마다 다시 만들면 찍는 순간
       지도가 다시 그려져 방금 찍은 자리를 잃는다 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cleared = (
    <button type="button" className="ppick__clear" onClick={() => onPick(null)}>
      핀 지우기
    </button>
  )

  if (!KAKAO_JS_KEY || failed) {
    /* 배포에는 키가 있어 여기가 진짜 지도다. 로컬에는 키가 없어
       아무것도 안 그리면 이 칸이 있는지도 모른다. 그래서 개발에서만
       찍는 시늉을 낼 수 있는 자리를 둔다.

       여기서 나오는 좌표는 진짜가 아니다. 화면 안에서 어디를 눌렀는지
       일 뿐이라 서버로 보내면 안 된다. 아래에 그렇게 적어둔다 */
    if (process.env.NODE_ENV !== 'development') {
      /* **null 을 돌려주면 안 된다.** 핀이 필수가 된 뒤로 이 자리가
         비면 막다른 길이 된다. 칸이 통째로 사라지는데 제출은 핀을
         요구하므로, 사용자는 다 채우고 눌러도 아무 일이 안 일어나고
         왜인지도 못 본다. 핀이 선택이던 때는 그냥 넘어갈 수 있었다.

         그래서 실패도 화면에 세운다. 여기서 할 수 있는 것이 다시
         시도밖에 없어도, 무엇이 잘못됐는지는 보여야 한다 */
      return <DeadPicker onRetry={() => setFailed(false)} error={error} />
    }
    return (
      <FakePicker
        pin={pin}
        label={label}
        onPick={onPick}
        onLabel={onLabel}
        error={error}
        clear={cleared}
      />
    )
  }

  return (
    <div className={`ppick${error ? ' ppick--err' : ''}`}>
      <div ref={ref} className="ppick__canvas" />
      <p className="ppick__foot">
        {pin ? (
          <>
            <span className="ppick__at">
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </span>
            {cleared}
          </>
        ) : (
          <span className="ppick__hint">지도를 눌러 만날 자리를 찍어주세요</span>
        )}
      </p>
      <NameBox label={label} onLabel={onLabel} pin={pin} error={error} />
    </div>
  )
}

/**
 * 찍은 자리의 이름.
 *
 * 핀을 찍기 전에는 비활성이다. 순서를 강제하려는 것이 아니라, 자리를
 * 안 정한 채로 이름부터 적으면 그 이름이 무엇에 붙는지 본인도 모르기
 * 때문이다. 찍고 나면 바로 커서가 여기로 온다.
 */
function NameBox({ label, onLabel, pin, error }: {
  label: string
  onLabel: (v: string) => void
  pin: Pin | null
  error?: string
}) {
  return (
    <div className="ppick__name">
      <input
        type="text"
        value={label}
        disabled={!pin}
        maxLength={40}
        onChange={(e) => onLabel(e.target.value)}
        placeholder={pin ? '찍은 자리를 뭐라고 부를까요' : '자리를 찍으면 이름을 적을 수 있어요'}
        aria-label="만나는 곳 이름"
      />
      {error && <p className="ppick__err">{error}</p>}
    </div>
  )
}

/**
 * 지도가 있을 자리. 개발 중에만 그린다.
 *
 * 카카오 키가 없는 로컬에서 배치와 동작을 확인하려고 캡처 한 장을
 * 깔았다. 캡처는 지도 서비스의 화면이라 우리 것이 아니다. 임시
 * 자리표시자이고 배포된 화면에는 나오지 않는다.
 */
function FakePicker({ pin, label, onPick, onLabel, error, clear }: {
  pin: Pin | null
  label: string
  onPick: (p: Pin | null) => void
  onLabel: (v: string) => void
  error?: string
  clear: React.ReactNode
}) {
  /* 화면 안에서 어디를 눌렀는지(0~1). 좌표가 아니라 그림 위의 자리다 */
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  return (
    <div className={`ppick${error ? ' ppick--err' : ''}`}>
      <div
        className="ppick__fake"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setAt({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
          /* 눌렀다는 사실만 위로 알린다. 좌표는 서울시청을 넣어두고,
             진짜 값은 키가 붙은 배포에서 지도가 준다 */
          onPick(SEOUL)
        }}
      >
        <img src="/dev/map-sample.webp" alt="" />
        {at && (
          <span
            className="ppick__fakepin"
            style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
          >
            <b>{label || '만날 곳'}</b>
          </span>
        )}
        <span className="ppick__tag">지도 자리 · 로컬에만 보입니다</span>
      </div>
      <p className="ppick__foot">
        {pin ? (
          <>
            <span className="ppick__at">찍은 자리 (좌표는 배포에서 채워집니다)</span>
            {clear}
          </>
        ) : (
          <span className="ppick__hint">지도를 눌러 만날 자리를 찍어주세요</span>
        )}
      </p>
      <NameBox label={label} onLabel={onLabel} pin={pin} error={error} />
    </div>
  )
}

/**
 * 지도를 못 불러왔을 때.
 *
 * 핀이 필수라 여기서는 글을 올릴 수 없다. 그 사실을 숨기지 않는다.
 * 조용히 사라지는 칸보다 "안 된다" 고 말하는 칸이 낫다.
 */
function DeadPicker({ onRetry, error }: { onRetry: () => void; error?: string }) {
  return (
    <div className="ppick ppick--dead">
      <div className="ppick__dead">
        <p className="ppick__deadhead">지도를 불러오지 못했어요</p>
        <p className="ppick__deadbody">
          만날 자리를 지도에 찍어야 글을 올릴 수 있어요. 연결을 확인하고
          다시 시도해주세요.
        </p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          다시 시도
        </button>
      </div>
      {error && <p className="ppick__err">{error}</p>}
    </div>
  )
}
