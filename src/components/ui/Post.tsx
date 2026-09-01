/**
 * 모집글 카드와 댓글.
 *
 * 이 둘이 이번 스프린트의 중심이다. 신청·수락을 두지 않기로 해서
 * 사람을 모으는 일이 전부 댓글에서 일어난다. 특히 비밀 댓글이
 * 연락처를 주고받는 유일한 통로다.
 */
import type { ReactNode } from 'react'
import { Avatar, Badge, type PostState } from './Basics'
import { swatchOf } from '@/lib/visual'

/* ── 모집글 카드 ──────────────────────────────────────── */

export type PostCardProps = {
  title: string
  /**
   * 붙은 이벤트의 대표 사진. 우리가 복제해 두는 것이 아니라 원본
   * 서버 주소를 그대로 들고 있는다. 포스터는 저작물이라 재게시하지
   * 않는다 (CLAUDE.md).
   *
   * 이벤트에 안 붙은 글도 있어서 없을 수 있다. 그때는 회색 네모를
   * 두지 않고 제목에서 뽑은 색을 깐다. 회색이면 사진이 안
   * 불러와진 것처럼 보인다.
   */
  image?: string | null
  state: PostState
  /** 만남 정보. "9/14 (월) 09:00", "잠실역 2번 출구" */
  when?: string
  where?: string
  /**
   * 댓글 수. 글자 줄이 아니라 오른쪽 말풍선으로 세운다. 채팅이 없어
   * 댓글이 사람을 구하는 유일한 통로라, 이 숫자가 곧 "말이 오갔는가" 다.
   */
  comments?: number
}

export function PostCard({ title, state, when, where, image, comments }: PostCardProps) {
  const sw = swatchOf(title)
  return (
    <article className={`pcard${state === 'done' ? ' is-done' : ''}`}>
      <div className="pcard__thumb">
        {image ? (
          <img className="pcard__photo" src={image} alt="" loading="lazy" />
        ) : (
          <span
            className="pcard__photo pcard__photo--none"
            style={{ background: `linear-gradient(150deg, ${sw.from}, ${sw.to})` }}
          />
        )}
        {/* 완료는 포스터 왼쪽 위에 얹는다. 제목 앞에 붙이면 165px
            밖에 안 되는 칸에서 제목이 한 줄을 더 먹는다. 오프메이트·
            팝가도 상태 표시를 포스터 위에 올린다 */}
        {state === 'done' && (
          <span className="pcard__state"><Badge state={state} /></span>
        )}
      </div>

      <div className="pcard__main">
        <h3 className="pcard__title">{title}</h3>
        {/* 팝가와 같은 순서로 언제가 위, 어디서가 아래 한 줄이다.
            둘을 한 줄에 몰면 165px 안에서 어디가 잘릴지 예측할 수 없다 */}
        {when && <p className="pcard__when">{when}</p>}
        {where && <p className="pcard__where">{where}</p>}
      </div>

      {comments !== undefined && (
        <span className="pcard__talk" aria-label={`댓글 ${comments}개`}>
          <TalkMark />
          {comments}
        </span>
      )}
    </article>
  )
}

/**
 * 댓글 수 옆의 말풍선.
 *
 * 채운 분홍 배지였는데 목록에서 그것만 색이 튀어 정작 제목보다
 * 먼저 눈에 들어왔다. 댓글 수는 확인하는 값이지 첫눈에 걸려야
 * 하는 값이 아니다. 테두리만 남기고 색을 뺐다.
 *
 * 이모티콘을 쓰지 않는 이유는 기기마다 모양이 달라서다.
 */
function TalkMark() {
  return (
    <svg className="pcard__talkmark" viewBox="0 0 14 14" aria-hidden focusable="false">
      <path
        d="M7 1.9c-3.1 0-5.6 1.9-5.6 4.3 0 1.4.9 2.7 2.2 3.5l-.5 2c-.05.2.16.36.33.25L5.8 10.6c.39.06.79.1 1.2.1 3.1 0 5.6-1.9 5.6-4.3S10.1 1.9 7 1.9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
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
