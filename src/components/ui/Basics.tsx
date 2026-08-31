/**
 * 여러 화면에서 반복되는 작은 조각들.
 * 하나씩 파일을 두면 열 개가 넘어서 성격이 같은 것끼리 묶었다.
 */
import type { ReactNode, ButtonHTMLAttributes } from 'react'

/* ── 버튼 ─────────────────────────────────────────────── */

/**
 * 카카오 말풍선. 카카오 로그인 버튼에는 심볼을 함께 두라는 것이
 * 카카오 쪽 안내다. 실제 연동할 때는 카카오 디벨로퍼스에서 받은
 * 공식 파일로 바꾼다. 지금은 모양만 맞춰 둔 것이다.
 */
export function KakaoMark() {
  return (
    <svg className="btn__mark" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M9 1.7C4.6 1.7 1 4.5 1 8c0 2.2 1.5 4.2 3.7 5.3l-.8 3.1c-.1.3.2.5.5.3l3.7-2.4c.3 0 .6.1.9.1 4.4 0 8-2.8 8-6.4S13.4 1.7 9 1.7z"
      />
    </svg>
  )
}

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

/**
 * 사진이 없는 사람의 자리를 채우는 색.
 *
 * 전부 같은 분홍이면 댓글 열 개가 한 덩어리로 보인다. 닉네임에서
 * 색을 뽑아 사람마다 다르게 한다. 같은 사람은 어느 화면에서든 같은
 * 색이라 이름을 안 읽어도 알아본다.
 *
 * 회색 실루엣을 쓰지 않는 이유도 같다. 모두가 같은 그림이면
 * 구분하는 데 아무 도움이 안 된다.
 */
function hueOf(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

/** 이미지가 없으면 닉네임 첫 글자에 사람마다 다른 색을 깐다 */
export function Avatar({ name, src, lg }: { name: string; src?: string; lg?: boolean }) {
  if (src) {
    return (
      <span className={`avatar${lg ? ' avatar--lg' : ''}`}>
        <img src={src} alt="" />
      </span>
    )
  }
  const h = hueOf(name)
  return (
    <span
      className={`avatar${lg ? ' avatar--lg' : ''}`}
      style={{
        background: `linear-gradient(140deg, hsl(${h} 68% 88%), hsl(${(h + 34) % 360} 62% 78%))`,
        color: `hsl(${h} 55% 30%)`,
      }}
    >
      {name.slice(0, 1)}
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
