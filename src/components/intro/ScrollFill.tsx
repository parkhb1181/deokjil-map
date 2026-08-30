'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 스크롤에 따라 문장이 단어 단위로 채워진다.
 *
 * 큰 문장 하나를 통째로 던져놓으면 읽히지 않고 넘어간다.
 * 채워지는 속도가 곧 읽는 속도가 되어 사용자를 문장에 붙잡아 둔다.
 *
 * 진행도는 요소의 화면 위치로만 계산한다. 스크롤 총량으로 재면
 * 페이지 길이가 바뀔 때마다 타이밍이 어긋난다.
 *
 * 모션을 줄이도록 설정한 사용자에게는 처음부터 다 채워서 보여준다.
 * 이 효과가 없으면 문장이 회색으로 남아 읽을 수 없게 되므로,
 * 애니메이션을 끄는 게 아니라 끝난 상태로 두는 것이 맞다.
 */
export default function ScrollFill({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const words = text.split(' ')
  const [filled, setFilled] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFilled(words.length)
      return
    }

    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      // 문장 윗변이 화면 70% 지점에 닿으면 시작해서 30% 까지 오면 끝난다
      const from = vh * 0.7
      const to = vh * 0.3
      const p = (from - r.top) / (from - to)
      setFilled(Math.round(Math.min(1, Math.max(0, p)) * words.length))
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
  }, [words.length])

  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} className={i < filled ? 'in-w in-w--on' : 'in-w'}>
          {w}{' '}
        </span>
      ))}
    </p>
  )
}
