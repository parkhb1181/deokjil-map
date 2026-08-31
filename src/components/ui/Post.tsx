/**
 * 모집글 카드와 댓글.
 *
 * 이 둘이 이번 스프린트의 중심이다. 신청·수락을 두지 않기로 해서
 * 사람을 모으는 일이 전부 댓글에서 일어난다. 특히 비밀 댓글이
 * 연락처를 주고받는 유일한 통로다.
 */
import type { ReactNode } from 'react'
import { Avatar, Badge, type PostState } from './Basics'

/* ── 모집글 카드 ──────────────────────────────────────── */

export type PostCardProps = {
  title: string
  /** 본문 앞부분. 두 줄에서 잘린다 */
  excerpt?: string
  state: PostState
  /** 만남 정보. "9/14 토 18:00", "잠실역 2번 출구" */
  when?: string
  where?: string
  /** 방장 포함 인원. 표시만 하고 자동 마감은 없다 */
  cap?: string
  comments?: number
}

export function PostCard({ title, excerpt, state, when, where, cap, comments }: PostCardProps) {
  return (
    <article className={`pcard${state === 'done' ? ' is-done' : ''}`}>
      <div className="pcard__top">
        <Badge state={state} />
        <h3 className="pcard__title">{title}</h3>
      </div>
      {excerpt && <p className="pcard__body">{excerpt}</p>}
      <div className="pcard__meta">
        {when && <span><b>{when}</b></span>}
        {where && <span>{where}</span>}
        {cap && <span>{cap}</span>}
        {comments !== undefined && <span>댓글 {comments}</span>}
      </div>
    </article>
  )
}

/* ── 댓글 ─────────────────────────────────────────────── */

export type CommentProps = {
  name: string
  time: string
  /** 없으면 권한이 없어 서버가 지운 것으로 본다 */
  text?: string
  /** 대댓글. 깊이는 1단계로 고정이라 이 아래로는 없다 */
  reply?: boolean
  secret?: boolean
  /** 삭제된 댓글. 아래 대댓글이 고아가 되지 않게 자리만 남긴다 */
  gone?: boolean
  /** 방장 표시. 비밀 댓글을 볼 수 있는 사람이라 눈에 띄어야 한다 */
  host?: boolean
  acts?: ReactNode
}

export function Comment({ name, time, text, reply, secret, gone, host, acts }: CommentProps) {
  const cls = ['cmt', reply && 'cmt--reply', gone && 'cmt--gone'].filter(Boolean).join(' ')

  if (gone) {
    return (
      <div className={cls}>
        <div className="cmt__main">
          <p className="cmt__text">삭제된 댓글입니다</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cls}>
      <Avatar name={name} />
      <div className="cmt__main">
        <div className="cmt__head">
          <span className="who__name">{name}</span>
          {host && <Badge state="off">방장</Badge>}
          {secret && <span className="cmt__lock">🔒 비밀</span>}
          <span className="cmt__time">{time}</span>
        </div>
        {/* 권한이 없으면 서버 응답에 본문 필드 자체가 없다.
            여기서 가리는 게 아니라 애초에 오지 않는다 */}
        {text ? (
          <p className="cmt__text">{text}</p>
        ) : (
          <p className="cmt__hidden">비밀 댓글입니다</p>
        )}
        {acts && <div className="cmt__acts">{acts}</div>}
      </div>
    </div>
  )
}
