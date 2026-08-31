'use client'

/**
 * 모집글 상세.
 *
 * 이 화면이 나머지 화면들의 본이다. 여기서 정한 것 넷을 다른
 * 화면이 그대로 가져다 쓴다.
 *   1. 페이지 껍데기 (PageShell)
 *   2. 비회원 게이트 — 보는 것은 열고 쓰는 것만 막는다
 *   3. 로딩 · 실패 · 빈 세 가지
 *   4. 권한별 분기 — 서버가 지운 필드를 화면이 어떻게 다루나
 *
 * 신청·수락을 두지 않기로 해서 사람 구하는 일이 전부 댓글에서
 * 일어난다. 비밀 댓글이 연락처를 주고받는 유일한 통로다.
 */
import { useMemo, useState } from 'react'
import type { CompanionPost, PostComment, Viewer, ViewerRole } from '@/types'
import { PageShell, ActionBar } from '@/components/ui/PageShell'
import { Button, Badge, Who, Blank, Sheet } from '@/components/ui/Basics'
import { Field, TextArea, Select, Checkbox } from '@/components/ui/Field'
import { Comment } from '@/components/ui/Post'
import { asServerWouldSend, threaded } from '@/lib/comment-perm'

/** '2026-09-14T15:00' → '9월 14일 (일) 오후 3:00' */
function whenText(iso: string) {
  const [d, t] = iso.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  const dow = '일월화수목금토'[new Date(y, m - 1, day).getDay()]
  const ampm = hh < 12 ? '오전' : '오후'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${m}월 ${day}일 (${dow}) ${ampm} ${h12}:${String(mm).padStart(2, '0')}`
}

/** '2026-08-30T09:12' → '8/30 09:12' */
function shortTime(iso: string) {
  const [d, t] = iso.split('T')
  const [, m, day] = d.split('-')
  return `${Number(m)}/${Number(day)} ${t}`
}

const ROLES: { key: ViewerRole; id: string | null; label: string }[] = [
  { key: 'guest', id: null, label: '비회원' },
  { key: 'member', id: 'u_b', label: '일반 회원' },
  { key: 'member', id: 'u_a', label: '댓글 작성자' },
  { key: 'host', id: 'u_host', label: '방장' },
]

export default function PostDetail({ post, comments, hostId }: {
  post: CompanionPost
  comments: PostComment[]
  hostId: string
}) {
  /* 로그인이 없어 화면을 확인할 방법이 없다. 인증이 붙으면 이 상태와
     아래 whoami 막대를 지우고 서버 세션에서 채운다 */
  const [pick, setPick] = useState(3)
  const viewer: Viewer = { role: ROLES[pick].key, user_id: ROLES[pick].id }

  const [draft, setDraft] = useState('')
  const [secret, setSecret] = useState(false)
  const [ask, setAsk] = useState<null | 'login' | 'done' | 'report'>(null)

  const isHost = viewer.user_id === hostId
  const isGuest = !viewer.user_id

  /* 서버가 보냈을 모습으로 만든 뒤 계층 정렬한다. API 가 붙으면
     asServerWouldSend 만 빠지고 나머지는 그대로다 */
  const list = useMemo(
    () => threaded(asServerWouldSend(comments, viewer, hostId)),
    [comments, viewer.user_id, hostId],
  )

  const submit = () => {
    if (isGuest) return setAsk('login')
    /* 아직 API 가 없다. 붙으면 여기서 POST 하고 목록을 다시 읽는다 */
    setDraft('')
    setSecret(false)
  }

  return (
    <PageShell
      title="동행 구해요"
      right={
        isHost ? (
          <Button size="sm" tone="ghost" onClick={() => setAsk('done')}>
            모집 완료
          </Button>
        ) : (
          <Button size="sm" tone="ghost" onClick={() => setAsk('report')}>
            신고
          </Button>
        )
      }
    >
      {/* 개발용. 인증이 붙으면 통째로 지운다 */}
      <div className="whoami">
        <b>보는 사람</b>
        {ROLES.map((r, i) => (
          <button key={r.label} aria-pressed={i === pick} onClick={() => setPick(i)}>
            {r.label}
          </button>
        ))}
      </div>

      <article className="post">
        <div className="post__top">
          <Badge state={post.state} />
          {post.state === 'done' && (
            <span className="thread__hint">더 이상 댓글을 받지 않아요</span>
          )}
        </div>

        <h1 className="post__title">{post.title}</h1>

        {post.event_id && post.event_title && (
          <a className="post__event" href={`/e/${post.event_id}`}>
            {post.event_title}
          </a>
        )}

        <div className="post__who">
          <Who
            name={post.author.nickname}
            sub={post.author.done_count ? `동행 ${post.author.done_count}회` : '첫 동행'}
          />
        </div>

        <dl className="post__facts">
          <dt>언제</dt>
          <dd>{whenText(post.meet_at)}</dd>
          <dt>어디서</dt>
          <dd>{post.meet_place}</dd>
          {post.capacity && (
            <>
              <dt>몇 명</dt>
              <dd>{post.capacity}명 (방장 포함)</dd>
            </>
          )}
          <dt>마감</dt>
          <dd>{whenText(post.closes_at)}</dd>
        </dl>

        <div className="post__body">{post.body}</div>

        <p className="post__warn">
          연락처는 본문이나 비밀 댓글로 주고받습니다. 비밀 댓글은 방장과 글쓴이만
          볼 수 있어요. 처음 만나는 자리인 만큼 공개된 장소에서 만나세요.
        </p>
      </article>

      <section className="thread">
        <div className="thread__head">
          <h2 className="thread__title">댓글</h2>
          <span className="thread__count">{post.comment_count}</span>
          <span className="thread__hint">비밀 댓글은 방장과 글쓴이만 봐요</span>
        </div>

        {list.length === 0 ? (
          <Blank
            title="아직 댓글이 없어요"
            desc="먼저 말을 걸어보세요"
            art={false}
          />
        ) : (
          list.map((c) => (
            <Comment
              key={c.id}
              name={c.deleted ? '' : c.author.nickname}
              time={shortTime(c.created_at)}
              text={c.body ?? undefined}
              reply={!!c.parent_id}
              secret={c.secret}
              gone={c.deleted}
              host={c.author.id === hostId}
              acts={
                c.deleted ? undefined : (
                  <>
                    {!c.parent_id && <button onClick={() => isGuest && setAsk('login')}>답글</button>}
                    {c.author.id === viewer.user_id ? (
                      <button>삭제</button>
                    ) : (
                      <button onClick={() => setAsk(isGuest ? 'login' : 'report')}>신고</button>
                    )}
                  </>
                )
              }
            />
          ))
        )}
      </section>

      <ActionBar>
        {post.state === 'done' ? (
          <p className="write__gate">
            <span>모집이 끝난 글이에요</span>
          </p>
        ) : isGuest ? (
          /* 비회원 게이트. 보는 것은 다 열고 쓰는 것만 막는다.
             눌러야 막히는 것보다 처음부터 보이는 편이 덜 답답하다 */
          <div className="write__gate">
            <p>로그인하면 댓글을 남길 수 있어요</p>
            <Button size="sm" tone="kakao" onClick={() => setAsk('login')}>
              로그인
            </Button>
          </div>
        ) : (
          <div className="write">
            <div className="write__row">
              <Field count={[draft.length, 500]}>
                <TextArea
                  placeholder={secret ? '방장만 볼 수 있어요' : '댓글을 남겨보세요'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  style={{ minHeight: 44 }}
                />
              </Field>
            </div>
            <div className="write__opts">
              <Checkbox
                label="비밀 댓글"
                checked={secret}
                onChange={(e) => setSecret(e.target.checked)}
              />
              <Button size="sm" disabled={!draft.trim() || draft.length > 500} onClick={submit}>
                올리기
              </Button>
            </div>
          </div>
        )}
      </ActionBar>

      {ask === 'login' && (
        <Sheet
          title="로그인이 필요해요"
          desc="댓글을 남기려면 로그인해주세요. 닉네임만 정하면 바로 쓸 수 있어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>나중에</Button>
              <Button tone="kakao" onClick={() => setAsk(null)}>카카오로 시작하기</Button>
            </>
          }
        />
      )}

      {ask === 'done' && (
        <Sheet
          title="모집을 완료할까요?"
          desc="완료하면 목록에서 회색으로 바뀌고 댓글을 더 받지 않아요. 되돌릴 수 없어요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>아니요</Button>
              <Button onClick={() => setAsk(null)}>완료할게요</Button>
            </>
          }
        />
      )}

      {ask === 'report' && (
        <Sheet
          title="신고하기"
          desc="검토 후 조치합니다. 신고 사실은 상대에게 알리지 않아요."
          foot={
            <>
              <Button tone="ghost" onClick={() => setAsk(null)}>취소</Button>
              <Button tone="danger" onClick={() => setAsk(null)}>신고</Button>
            </>
          }
        >
          <Field label="사유" required>
            <Select defaultValue="">
              <option value="" disabled>골라주세요</option>
              <option>허위 정보</option>
              <option>광고 · 홍보</option>
              <option>부적절한 내용</option>
            </Select>
          </Field>
          <Field label="자세히" count={[0, 300]}>
            <TextArea placeholder="어떤 점이 문제였는지 적어주세요" />
          </Field>
        </Sheet>
      )}
    </PageShell>
  )
}
