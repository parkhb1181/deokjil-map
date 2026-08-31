'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 스크롤 위치에 따라 캐릭터의 각도가 바뀐다.
 *
 * 웹에서 3D 런타임을 돌리지 않는다. 미리 뽑아둔 각도 컷을 스크롤 진행도에
 * 맞춰 갈아끼울 뿐이다. three.js 를 얹으면 런타임만 200KB 가 넘고,
 * 이 프로젝트는 이미지 6MB 를 63KB 로 줄여둔 참이라 그걸 되돌릴 수 없다.
 * 지금 프레임 여섯 장을 다 합쳐도 119KB 다.
 *
 * 프레임을 전부 DOM 에 깔아두고 opacity 로만 바꾼다. src 를 갈아끼우면
 * 처음 보는 프레임에서 한 박자 깜빡인다. 미리 깔아두면 그 일이 없다.
 *
 * 진행도는 요소가 화면을 지나간 정도로 잰다. 페이지 전체 스크롤량으로 재면
 * 위아래 섹션이 늘어날 때마다 회전 타이밍이 어긋난다.
 *
 * 모션을 줄이도록 설정한 사용자에게는 가운데 프레임 하나로 세워둔다.
 * 정면이 기본값이라 캐릭터가 어색한 각도로 굳지 않는다.
 */
export default function ScrollTurntable({
  frames,
  alt = '',
  className,
  /** 회전을 시작·종료할 화면 위치. 1 이 화면 아래끝, 0 이 위끝 */
  from = 0.92,
  to = 0.12,
}: {
  frames: string[]
  alt?: string
  className?: string
  from?: number
  to?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(Math.floor(frames.length / 2))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const last = frames.length - 1
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const head = vh * from
      const tail = vh * to
      const p = (head - r.top) / (head - tail)
      setI(Math.min(last, Math.max(0, Math.round(p * last))))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [frames.length, from, to])

  return (
    <div ref={ref} className={className ? `in-tt ${className}` : 'in-tt'}>
      {frames.map((src, n) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={src}
          className={n === i ? 'in-tt__f in-tt__f--on' : 'in-tt__f'}
          src={src}
          alt={n === 0 ? alt : ''}
          // 스크롤하다 도착했을 때 이미 받아둔 상태여야 한다. 지연 로딩하면
          // 그 프레임에서 한 칸 비어 보인다.
          // 다만 우선순위는 낮춘다. 스물다섯 장이 히어로 이미지와 대역폭을
          // 다투면 첫 화면이 늦게 뜬다
          loading="eager"
          fetchPriority="low"
          decoding="async"
        />
      ))}
    </div>
  )
}
