'use client'

/**
 * 사람을 눌렀을 때 뜨는 시트.
 *
 * 전에는 아바타가 아무 반응이 없었다. 낯선 사람과 만나는 서비스인데
 * 상대를 눌러볼 수가 없었다.
 *
 * 곧바로 프로필로 보내지 않는 이유가 둘이다.
 *
 *   1. 읽던 자리를 잃는다. 모집글을 읽다 댓글 쓴 사람이 궁금해 눌렀을
 *      뿐인데 화면이 통째로 바뀌고, 돌아오면 스크롤이 맨 위다
 *   2. 신고가 갈 곳이 없어진다. 신고는 프로필까지 들어가야 할 수
 *      있었는데, 불쾌한 댓글을 본 사람에게 그 사람 프로필을 먼저
 *      보여주는 것은 순서가 잘못됐다
 *
 * 그래서 이름과 숫자만 보여주고 갈래를 둘로 준다. 더 볼지, 신고할지.
 *
 * 내 아바타를 눌렀을 때는 신고 자리에 아무것도 두지 않는다. 자기를
 * 신고하는 길은 없다.
 */
import Link from 'next/link'
import { Avatar, Button } from '@/components/ui/Basics'
import { wf } from '@/lib/wireframe'
import { LAST_SEEN_LABEL, type LastSeen } from '@/types'

export type PersonSheetUser = {
  id: string
  nickname: string
  profileImageUrl?: string | null
  /** 마지막 접속 구간. 없으면 그 줄을 통째로 뺀다 */
  lastSeen?: LastSeen
}

export function PersonSheet({
  user,
  isMe = false,
  onReport,
  onClose,
}: {
  user: PersonSheetUser
  /** 내 아바타를 누른 경우. 신고 버튼을 빼고 문구를 바꾼다 */
  isMe?: boolean
  /** 신고를 누르면 부르는 쪽이 신고 시트를 연다. 시트 위에 시트를
      쌓지 않으려고 여기서 직접 열지 않는다 */
  onReport: () => void
  onClose: () => void
}) {
  return (
    <div className="psheet" onClick={onClose}>
      <div className="psheet__panel" onClick={(e) => e.stopPropagation()}>
        <div className="psheet__who">
          <Avatar name={user.nickname} src={user.profileImageUrl ?? undefined} lg />
          <p className="psheet__name">{user.nickname}</p>
          <p className="psheet__meta meta">
            {user.lastSeen && <span>{LAST_SEEN_LABEL[user.lastSeen]}</span>}
          </p>
        </div>

        <div className="psheet__acts">
          {/* 상세보기가 왼쪽이다. 대부분은 궁금해서 누른 것이고,
              신고는 드물게 필요한 쪽이다. 자주 쓰는 것을 손이 먼저
              닿는 자리에 둔다 */}
          <Link
            className="btn btn--ghost psheet__go"
            href={wf(`/u/${user.id}`)}
            onClick={onClose}
          >
            {isMe ? '내 프로필' : '상세보기'}
          </Link>

          {!isMe && (
            <Button tone="ghost" onClick={onReport}>
              신고
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
