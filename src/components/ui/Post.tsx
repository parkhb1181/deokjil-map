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
  /**
   * 붙은 이벤트의 대표 사진. 우리가 복제해 두는 것이 아니라 원본
   * 서버 주소를 그대로 들고 있는다. 포스터는 저작물이라 재게시하지
   * 않는다 (CLAUDE.md).
   *
   * 이벤트에 안 붙은 글도 있어서 없을 수 있다. 그때는 자리를
   * 비우지 않고 글자만으로 채운다. 빈 회색 네모를 두면 사진이
   * 안 불러와진 것처럼 보인다.
   */
  image?: string | null
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

export function PostCard({ title, excerpt, state, when, where, cap, comments, image }: PostCardProps) {
  return (
    <article className={`pcard${state === 'done' ? ' is-done' : ''}${image ? ' pcard--photo' : ''}`}>
      {image && (
        <img className="pcard__photo" src={image} alt="" loading="lazy" />
      )}
      <div className="pcard__main">
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
      </div>
    </article>
  )
}

/* ── 댓글 ─────────────────────────────────────────────── */

/** 이모티콘은 기기마다 모양이 달라 톤이 흐트러진다. 직접 그린다 */
function LockMark() {
  return (
    <svg className="cmt__lockmark" viewBox="0 0 12 12" aria-hidden focusable="false">
      <path
        d="M3.6 5.2V4a2.4 2.4 0 0 1 4.8 0v1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <rect x="2.4" y="5.2" width="7.2" height="5.2" rx="1.3" fill="currentColor" />
    </svg>
  )
}

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
  /** 프로필 사진. 없으면 닉네임 첫 글자에 색을 깐다 */
  src?: string
  acts?: ReactNode
}

export function Comment({ name, time, text, reply, secret, gone, host, src, acts }: CommentProps) {
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
      <Avatar name={name} src={src} />
      <div className="cmt__main">
        <div className="cmt__head">
          <span className="who__name">{name}</span>
          {host && <Badge state="off">방장</Badge>}
          {secret && (
            <span className="cmt__lock">
              <LockMark />비밀
            </span>
          )}
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
