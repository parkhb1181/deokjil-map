/**
 * 여러 화면에서 반복되는 작은 조각들.
 * 하나씩 파일을 두면 열 개가 넘어서 성격이 같은 것끼리 묶었다.
 */
import type { ReactNode, ButtonHTMLAttributes } from 'react'

/* ── 버튼 ─────────────────────────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'ghost' | 'danger' | 'kakao'
  size?: 'md' | 'sm'
  block?: boolean
}

export function Button({ tone = 'primary', size = 'md', block, className, ...rest }: ButtonProps) {
  const cls = [
    'btn',
    `btn--${tone}`,
    size === 'sm' && 'btn--sm',
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type="button" className={cls} {...rest} />
}

/* ── 상태 배지 ────────────────────────────────────────── */

/**
 * 모집글 상태는 둘뿐이다. 신청·수락을 두지 않기로 해서
 * 정원 충족으로 자동 마감되는 경로가 없다. 방장이 완료를 누른다.
 */
export type PostState = 'open' | 'done'

const STATE_LABEL: Record<PostState, string> = {
  open: '모집중',
  done: '완료',
}

export function Badge({ state, children }: { state: PostState | 'off'; children?: ReactNode }) {
  const label = children ?? (state === 'off' ? '' : STATE_LABEL[state])
  return <span className={`state state--${state}`}>{label}</span>
}

/* ── 사람 ─────────────────────────────────────────────── */

/** 이미지가 없으면 닉네임 첫 글자를 쓴다. 회색 실루엣보다 구분이 쉽다 */
export function Avatar({ name, src, lg }: { name: string; src?: string; lg?: boolean }) {
  return (
    <span className={`avatar${lg ? ' avatar--lg' : ''}`}>
      {src ? <img src={src} alt="" /> : name.slice(0, 1)}
    </span>
  )
}

export function Who({ name, sub, src }: { name: string; sub?: string; src?: string }) {
  return (
    <span className="who">
      <Avatar name={name} src={src} />
      <span>
        <span className="who__name">{name}</span>
        {sub && <span className="who__sub"> · {sub}</span>}
      </span>
    </span>
  )
}

/* ── 빈 화면 · 실패 ───────────────────────────────────── */

/**
 * 알림이 없는 서비스라 사용자가 직접 들어와서 확인한다.
 * 빈 화면이 자주 보이므로 "왜 비었는지"까지 적는다.
 *
 * 그림은 로고의 3D 오리에서 얼굴만 떼어냈다. 가장자리가 서서히
 * 사라지도록 만들어서 네모로 잘린 티가 나지 않는다.
 */
export function Blank({ title, desc, action, art = true }: {
  title: string
  desc?: string
  action?: ReactNode
  /** 좁은 자리에서는 그림을 뺀다 */
  art?: boolean
}) {
  return (
    <div className="blank">
      {art && (
        <img className="blank__art" src="/duck-face.webp" alt="" width={112} height={112} />
      )}
      <p className="blank__title">{title}</p>
      {desc && <p className="blank__desc">{desc}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: number | string }) {
  return <span className="skel" style={{ display: 'block', height: h, width: w }} />
}

/* ── 시트 ─────────────────────────────────────────────── */

/**
 * 취소 사유, 신고, 삭제 확인이 전부 이 모양을 쓴다.
 * 좁은 화면에서는 아래에서 올라오고 넓으면 가운데 뜬다.
 */
export function Sheet({ title, desc, children, foot }: {
  title: string
  desc?: string
  children?: ReactNode
  foot?: ReactNode
}) {
  return (
    <div className="ask" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ask__panel">
        <p className="ask__title">{title}</p>
        {desc && <p className="ask__desc">{desc}</p>}
        {children}
        {foot && <div className="ask__foot">{foot}</div>}
      </div>
    </div>
  )
}

/* ── 탭 ───────────────────────────────────────────────── */

export function Tabs({ items, on, onPick }: {
  items: string[]
  on: number
  onPick?: (i: number) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t, i) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={i === on}
          className={`tabs__item${i === on ? ' tabs__item--on' : ''}`}
          onClick={() => onPick?.(i)}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
