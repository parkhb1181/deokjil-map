'use client'

/**
 * 채팅 조각.
 *
 * 말풍선과 날짜 구분선, 그리고 인증 게이트.
 *
 * 댓글(`Post.tsx` 의 `Comment`)과 모양이 다른 이유가 있다. 댓글은
 * **공개된 글에 달리는 것**이라 누가 썼는지가 먼저이고 아바타와
 * 닉네임이 매번 붙는다. 채팅은 **둘뿐**이라 매 줄에 누구인지를
 * 적으면 같은 이름이 스무 번 반복된다. 좌우로 갈라 두면 이름이
 * 없어도 누가 말했는지 알 수 있다.
 */
import { Button } from './Basics'

/* ── 말풍선 ───────────────────────────────────────────── */

export type ChatMessage = {
  id: string
  /** 보낸 사람 id. 나인지 아닌지만 쓴다 */
  from: string
  text: string
  /** 'YYYY-MM-DDTHH:mm' */
  at: string
}

/** '2026-09-09T21:40' → '오후 9:40' */
export function clock(iso: string) {
  const [hh, mm] = iso.split('T')[1].split(':').map(Number)
  const ampm = hh < 12 ? '오전' : '오후'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${ampm} ${h12}:${String(mm).padStart(2, '0')}`
}

/** '2026-09-09T21:40' → '9월 9일 (수)' */
export function dayLabel(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  const dow = '일월화수목금토'[new Date(y, m - 1, d).getDay()]
  return `${m}월 ${d}일 (${dow})`
}

export function ChatBubble({ text, mine, time, tail, who, deleted, pending, onDelete }: {
  text: string
  mine: boolean
  time: string
  /** 지운 자리다 (CH-12). 본문 대신 자리표시자를 흐리게 둔다 — 빈 칸이면 대화가 중간에 끊긴 것처럼 읽힌다 */
  deleted?: boolean
  /** 서버 답을 기다리는 중. 흐리게 둔다 — 보냈는지 못 보냈는지가 안 보이면 두 번 누른다 */
  pending?: boolean
  /** 내 말풍선 묶음 끝에 「삭제」 를 단다. 지울 수 있는 것(내 것 · 안 지운 것)에만 준다 */
  onDelete?: () => void
  /**
   * 보낸 사람 이름. **남의 말풍선에만** 준다.
   *
   * 왼쪽에 선 사람이 여럿이라 좌우로 갈리는 것만으로는 누가 말했는지
   * 안 갈린다. 내 것은 오른쪽 하나뿐이라 이름이 군더더기다.
   *
   * 묶음의 **첫 줄에만** 붙인다. 연달아 보낸 세 줄에 이름이 세 번
   * 나오면 대화가 아니라 명단으로 읽힌다.
   */
  who?: string
  /**
   * 같은 사람이 연달아 보낸 것 중 **마지막**인가.
   *
   * 시각을 줄마다 붙이면 1분 안에 세 줄을 보냈을 때 같은 시각이 세 번
   * 나온다. 마지막 줄에만 붙인다 — 그 묶음이 언제 끝났는지가 알고
   * 싶은 것이다.
   */
  tail: boolean
}) {
  return (
    /*
     * 이름이 있으면 한 겹 더 감싼다.
     *
     * `.bub` 이 가로 flex 다 — 말풍선과 시각을 좌우로 세우는 자리라.
     * 이름을 그 안에 그냥 두면 셋째 칸이 되어 왼쪽에 세로로 눕는다.
     * 이름은 말풍선 **위**에 있어야 하므로 세로 묶음을 하나 만든다.
     */
    <div className={`bubwrap${mine ? ' bubwrap--mine' : ''}${tail ? ' bub--tail' : ''}`}>
      {who && <span className="bub__who">{who}</span>}
      <div className={`bub${mine ? ' bub--mine' : ''}${deleted ? ' bub--deleted' : ''}${pending ? ' bub--pending' : ''}`}>
        <p className="bub__text">{deleted ? '삭제된 메시지예요' : text}</p>
        {tail && (
          <span className="bub__meta">
            {onDelete && !deleted && !pending && (
              <button type="button" className="bub__del" onClick={onDelete}>
                삭제
              </button>
            )}
            <span className="bub__time">{pending ? '보내는 중' : time}</span>
          </span>
        )}
      </div>
    </div>
  )
}

/** 날짜가 바뀌는 자리. 이것이 없으면 어제 대화와 오늘 대화가 이어져 보인다 */
export function ChatDay({ label }: { label: string }) {
  return (
    <div className="chat__day">
      <span>{label}</span>
    </div>
  )
}

/* ── 인증 게이트 ──────────────────────────────────────── */

/* ── 저장 고지 (CH-09) ────────────────────────────────── */

/**
 * 고시가 요구한 조치를 **이용자가 알아야** 의미가 있다.
 *
 * 몰래 저장하는 것과 저장한다고 적어두는 것은 다른 일이다. 신고가
 * 들어왔을 때 관리자가 열어본다는 것까지 여기서 말한다 (AD-08).
 */
export function ChatNotice() {
  return (
    <p className="chat__notice">
      대화는 신고 처리를 위해 저장되고 모집이 끝난 뒤 90일이 지나면 지워집니다. 문제가 있으면
      오른쪽 위에서 신고해주세요.
    </p>
  )
}

/** 방을 처음 열 때 한 번 (CH-10) */
export function ChatFirst({ onClose }: { onClose: () => void }) {
  return (
    <div className="chat__first">
      <p>
        <b>약속 장소와 시간을 여기서 정하세요.</b>
        <br />
        개인 연락처를 먼저 주고받지 않아도 됩니다.
      </p>
      <Button size="sm" tone="ghost" onClick={onClose}>
        알겠어요
      </Button>
    </div>
  )
}
