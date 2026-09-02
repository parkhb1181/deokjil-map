/**
 * 모집글 카드와 댓글.
 *
 * 이 둘이 이번 스프린트의 중심이다. 신청·수락을 두지 않기로 해서
 * 사람을 모으는 일이 전부 댓글에서 일어난다. 특히 비밀 댓글이
 * 연락처를 주고받는 유일한 통로다.
 */
import type { ReactNode } from 'react'
import { Avatar, Badge, type PostState } from './Basics'
import type { ClosedReason, CommentState } from '@/types'
import { isClosed, isPlaceholder } from '@/types'
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
  /** 닫힌 까닭. 배지 글자가 「모집 완료」 인지 「종료」 인지를 가른다 */
  reason?: ClosedReason | null
  /** 만남 정보. "9/14 (월) 09:00", "잠실역 2번 출구" */
  when?: string
  where?: string
  /**
   * 댓글 수. 글자 줄이 아니라 오른쪽 말풍선으로 세운다. 채팅이 없어
   * 댓글이 사람을 구하는 유일한 통로라, 이 숫자가 곧 "말이 오갔는가" 다.
   */
  comments?: number
}

export function PostCard({ title, state, reason, when, where, image, comments }: PostCardProps) {
  const sw = swatchOf(title)
  return (
    <article className={`pcard${isClosed(state) ? ' is-done' : ''}`}>
      <div className="pcard__thumb">
        {image ? (
          <img className="pcard__photo" src={image} alt="" loading="lazy" />
        ) : (
          <span
            className="pcard__photo pcard__photo--none"
            style={{ background: `linear-gradient(150deg, ${sw.from}, ${sw.to})` }}
          />
        )}
        {/* 끝난 글은 포스터 왼쪽 위에 얹는다. 제목 앞에 붙이면 165px
            밖에 안 되는 칸에서 제목이 한 줄을 더 먹는다. 오프메이트·
            팝가도 상태 표시를 포스터 위에 올린다 */}
        {isClosed(state) && (
          <span className="pcard__state"><Badge state={state} reason={reason} /></span>
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
export function LockMark() {
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
  /**
   * 자리표시자로 바뀐 댓글. 아래 대댓글이 고아가 되지 않게 자리는 남는다.
   *
   * `gone` 불리언이었는데 축을 받는다. 본인이 지운 것과 운영자가
   * 가린 것은 자리에 적히는 문장이 달라야 한다 (AD-07). 「삭제된
   * 댓글입니다」 로 뭉뚱그리면 신고로 가려진 것을 본인이 지운 것으로
   * 읽게 되고, 읽는 쪽이 그 사람을 오해한다.
   */
  state?: CommentState
  /** 방장 표시. 비밀 댓글을 볼 수 있는 사람이라 눈에 띄어야 한다 */
  host?: boolean
  /** 프로필 사진. 없으면 닉네임 첫 글자에 색을 깐다 */
  src?: string
  acts?: ReactNode
  /**
   * 고치는 중이면 본문 자리에 이걸 그린다.
   *
   * 입력칸을 맨 아래 칸에서 빌려 쓰지 않는 이유는, 그 칸이 새 댓글과
   * 답글을 이미 쓰고 있어서다. 고치는 중인데 새 댓글로 착각하면
   * 원래 것이 그대로 남는다. 고치는 것은 그 자리에서 보여야 한다.
   */
  edit?: ReactNode
  /** 고친 적 있는 댓글. 답글이 달린 뒤 말이 바뀌면 읽는 쪽이 알아야 한다 */
  edited?: boolean
  /** 아바타·이름을 누르면 사람 시트를 연다. 지운 댓글에는 없다 */
  onAuthor?: () => void
}

export function Comment({
  name,
  time,
  text,
  reply,
  secret,
  state = 'ACTIVE',
  host,
  src,
  acts,
  edit,
  edited,
  onAuthor,
}: CommentProps) {
  const placeholder = isPlaceholder(state)
  const cls = ['cmt', reply && 'cmt--reply', placeholder && 'cmt--gone'].filter(Boolean).join(' ')

  if (placeholder) {
    return (
      <div className={cls}>
        <div className="cmt__main">
          {/* 누가 무엇을 했는지 그대로 적는다. 블라인드에 「삭제」 라고
              쓰면 본인이 지운 것처럼 보이고, 삭제에 「신고」 라고 쓰면
              신고받은 적 없는 사람이 신고받은 것이 된다.

              가린 사유는 적지 않는다. 신고 내용이 그 자리에 남으면
              신고가 곧 공개 낙인이 되고, 누가 신고했는지도 짐작된다 */}
          <p className="cmt__text">
            {state === 'BLINDED' ? '신고로 가려진 댓글입니다' : '삭제된 댓글입니다'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cls}>
      {/* 아바타와 이름이 한 버튼이다. 둘을 따로 두면 이름을 누른 사람과
          그림을 누른 사람이 다른 결과를 얻는다 */}
      {onAuthor ? (
        <button type="button" className="cmt__avatar" onClick={onAuthor} aria-label={`${name} 님 보기`}>
          <Avatar name={name} src={src} />
        </button>
      ) : (
        <Avatar name={name} src={src} />
      )}
      <div className="cmt__main">
        <div className="cmt__head">
          {onAuthor ? (
            <button type="button" className="cmt__namebtn who__name" onClick={onAuthor}>
              {name}
            </button>
          ) : (
            <span className="who__name">{name}</span>
          )}
          {host && <Badge state="off">방장</Badge>}
          {secret && (
            <span className="cmt__lock">
              <LockMark />비밀
            </span>
          )}
          <span className="cmt__time">{time}</span>
          {edited && <span className="cmt__edited">수정됨</span>}
        </div>
        {/* 고치는 중에는 본문 대신 입력칸이 그 자리에 온다 */}
        {edit ? (
          edit
        ) : /* 권한이 없으면 서버 응답에 본문 필드 자체가 없다.
               여기서 가리는 게 아니라 애초에 오지 않는다 */
        text ? (
          <p className="cmt__text">{text}</p>
        ) : (
          <p className="cmt__hidden">비밀 댓글입니다</p>
        )}
        {/* 고치는 중에는 답글·삭제를 감춘다. 저장하지 않은 채 다른
            데로 새면 고치던 내용이 조용히 사라진다 */}
        {acts && !edit && <div className="cmt__acts">{acts}</div>}
      </div>
    </div>
  )
}
