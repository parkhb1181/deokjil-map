'use client'

/**
 * 차단한 사람.
 *
 * 차단은 거는 자리(프로필 · 글 · 댓글의 더보기)가 여럿인데 푸는
 * 자리는 여기 하나다. 건 곳에서 풀게 두면, 차단한 뒤로는 그 사람의
 * 글이 안 보이므로 풀러 갈 길이 사라진다.
 *
 * 차단은 **한쪽 방향**이다. 내가 그 사람을 안 볼 뿐, 그 사람은 내
 * 글을 그대로 본다. 그렇게 알려주지 않으면 차단하면 상대도 나를
 * 못 보는 줄 알고 안심한다. 그건 안전에 대한 거짓말이다.
 *
 * 푸는 것은 되돌릴 수 있으므로 확인을 묻지 않는다. 잘못 눌러도
 * 다시 차단하면 되고, 묻는 화면이 하나 줄어든다.
 */
import { useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/ui/PageShell'
import { Blank, Button, Who } from '@/components/ui/Basics'

type Blocked = {
  id: string
  nickname: string
  /** 언제 차단했는지. 왜 차단했는지는 남기지 않는다 (사유는 신고에만 있다) */
  at: string
}

/* 로그인이 없어 서버에서 못 받는다. 붙으면 지운다 */
const ROWS: Blocked[] = [
  { id: 'u_x1', nickname: '조용한덕후', at: '2026-08-24' },
  { id: 'u_x2', nickname: '팝업러버', at: '2026-07-11' },
]

export default function Blocked_() {
  const [rows, setRows] = useState(ROWS)
  const [empty, setEmpty] = useState(false)

  const shown = empty ? [] : rows

  return (
    <PageShell title="차단한 사람">
      <div className="whoami">
        <b>화면</b>
        <button aria-pressed={!empty} onClick={() => setEmpty(false)}>정상</button>
        <button aria-pressed={empty} onClick={() => setEmpty(true)}>비었음</button>
      </div>

      {shown.length === 0 ? (
        <Blank
          title="차단한 사람이 없어요"
          desc="불편한 사람이 있으면 그 사람의 프로필에서 차단할 수 있어요"
          action={
            <Link className="btn btn--ghost btn--sm" href="/p">
              둘러보기
            </Link>
          }
        />
      ) : (
        <>
          {/* 차단이 무엇을 하고 무엇을 하지 않는지 목록 위에 적는다.
              풀기 전에 읽어야 하는 문장이라 목록 아래로 내리지 않는다 */}
          <p className="blocked__lead">
            차단한 사람의 글과 댓글이 나에게 보이지 않아요. 내 글은 그
            사람에게 그대로 보입니다.
          </p>

          <ul className="blocked">
            {shown.map((b) => (
              <li className="blocked__row" key={b.id}>
                {/* 프로필로 갈 수 있게 둔다. 이름만 보고 누구였는지
                    기억나지 않을 때 확인할 길이 여기밖에 없다 */}
                <Link className="blocked__who" href={`/u/${b.id}`}>
                  <Who name={b.nickname} sub={`${b.at.slice(5).replace('-', '/')} 차단`} />
                </Link>
                <Button
                  size="sm"
                  tone="ghost"
                  onClick={() => setRows((p) => p.filter((r) => r.id !== b.id))}
                >
                  차단 해제
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  )
}
