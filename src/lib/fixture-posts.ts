import raw from '@/data/closed-posts.fixture.json'
import type { CompanionPost, LastSeen, PostAuthor, PostComment } from '@/types'
import type { ListItem } from './list-item'
import type { ProfileData } from '@/components/ProfileView'

/**
 * 완료된 동행 모집글 고정 데이터.
 *
 * ─────────────────────────────────────────────────────────
 * **왜 있나.** 모집 화면이 처음 열리는데 글이 없다. 완료된 글이 몇 개
 * 있어야 "여기서 모임이 실제로 성사된다" 가 보이는데, 회원은 카카오
 * 로그인으로만 만들어지고 한 사람이 카카오 계정을 여럿 가질 수 없어
 * 방장이 다른 글을 여러 개 만들 방법이 없다. 그래서 완료글만 화면에
 * 고정으로 둔다.
 *
 * **완료글만 두는 이유.** `CLOSED` 글은 댓글도 채팅도 안 된다 (도메인
 * 6장). 눌러서 할 수 있는 게 읽기뿐이라, 서버에 없어도 방문자가 겪는
 * 것이 진짜 글과 같다. 모집중인 글을 고정으로 두면 "같이 가요" 를
 * 눌렀는데 아무 일도 안 일어나는 화면이 된다. 그건 하면 안 된다.
 *
 * **서버와 겹치지 않는다.** id 가 전부 `fx_` 로 시작한다. 서버 id 는
 * 숫자라 충돌이 없고, 상세·프로필 라우트는 이 접두어로 먼저 갈라서
 * 서버에 묻지 않는다. 목록에는 첫 장 앞에만 붙인다 — 커서는 서버 글
 * 기준이라 이어지는 장에 다시 나오지 않는다.
 *
 * **비밀 댓글은 본문이 아예 없다.** `PostDetail` 은 API 경로에서
 * 권한을 다시 판정하지 않고 서버가 뺀 것을 믿는다. 이 글의 방장이 될
 * 수 있는 사람이 없으므로 모든 방문자에게 본문이 없는 것이 맞다.
 * 「비밀」 배지만 남는다 (CM-08).
 *
 * **신고는 막는다.** 없는 글을 신고하면 서버가 404 를 주고, 그 오류를
 * 보는 사람은 서비스가 고장났다고 읽는다. `PostDetail` 에 `noReport`
 * 를 준다.
 *
 * ─────────────────────────────────────────────────────────
 * **끄는 법.** `NEXT_PUBLIC_FIXTURE_POSTS=0`. 진짜 완료글이 쌓이면
 * 그때 끄고, 이 파일과 JSON 을 지운다. 지표를 볼 때는 `fx_` 글을
 * 빼고 세야 한다 — 이건 사람들이 만든 활동이 아니다.
 */
export const FIXTURE_ON = process.env.NEXT_PUBLIC_FIXTURE_POSTS !== '0'

export function isFixtureId(id: string): boolean {
  return id.startsWith('fx_')
}

/**
 * 목록과 상세에서 숨길 서버 글.
 *
 * 모집글에는 삭제가 없다 (ADR-0002). 잘못 쓴 글은 마감하는 것이
 * 정해진 길인데, 마감해도 「전체」 목록에는 남는다. 아래는 프로덕션에서
 * 시험하느라 쓴 글이라 남아 있으면 안 되는 것들이다.
 *
 * 첫 장에서 한 건이 빠지면 그 장이 한 줄 짧아진다. 커서는 서버 글
 * 기준이라 다음 장이 밀리거나 겹치지는 않는다. 건수가 늘면 이 방식은
 * 안 맞다 — 그때는 ADR-0002 의 「뒤집는 조건」 대로 삭제를 논의한다.
 */
const HIDDEN_POST_IDS = new Set<string>([
  '4', // [확인용] 서울광장 테스트 글 — 2026-09 배포 확인용
])

export function isHiddenPostId(id: string): boolean {
  return HIDDEN_POST_IDS.has(id)
}

type RawUser = {
  id: string
  nickname: string
  profileImageUrl: string | null
  bio: string | null
  lastSeen: LastSeen
}
type RawComment = {
  id: string
  parentId: string | null
  author: string
  secret: boolean
  createdAt: string
  content?: string
}
type RawPost = {
  id: string
  host: string
  district: string
  /**
   * 그 글이 가리키던 실제 행사의 제목과 포스터. 포스터는 수집원 CDN 의
   * 원본 주소 그대로다 — 복제해 두지 않는다 (CLAUDE.md). eventId 는
   * 일부러 없다. 행사가 이미 내려가서 `/e/…` 로 링크하면 404 다.
   */
  eventTitle: string
  eventImageUrl: string
  title: string
  content: string
  capacity: number
  meetAt: string
  createdAt: string
  meetPoint: { place: string; lat: number; lng: number }
  comments: RawComment[]
}

const DATA = raw as unknown as { users: RawUser[]; posts: RawPost[] }
const USERS = new Map(DATA.users.map((u) => [u.id, u]))

function author(id: string): PostAuthor {
  const u = USERS.get(id)
  if (!u) throw new Error(`fixture: 없는 사용자 ${id}`)
  return { id: u.id, nickname: u.nickname, profileImageUrl: u.profileImageUrl, lastSeen: u.lastSeen }
}

/* 목록 미리보기. 서버는 본문 앞을 잘라 주는데, 여기서는 같은 규칙으로 잘라 둔다 */
function excerpt(content: string): string {
  return content.length > 100 ? content.slice(0, 100) + '…' : content
}

function toPost(p: RawPost): CompanionPost {
  return {
    id: p.id,
    eventId: null,
    eventTitle: p.eventTitle,
    eventImageUrl: p.eventImageUrl,
    title: p.title,
    content: p.content,
    status: 'CLOSED',
    closedReason: 'MANUAL',
    capacity: p.capacity,
    meetAt: p.meetAt,
    meetPoint: p.meetPoint,
    closesAt: p.meetAt,
    createdAt: p.createdAt,
    author: author(p.host),
    commentCount: p.comments.length,
  }
}

function toComment(c: RawComment): PostComment {
  return {
    id: c.id,
    parentId: c.parentId,
    author: author(c.author),
    /* 비밀이면 키 자체를 안 둔다. 서버가 빼고 보내는 것과 같은 모양이다 */
    ...(c.secret ? {} : { content: c.content ?? '' }),
    secret: c.secret,
    status: 'ACTIVE',
    createdAt: c.createdAt,
    /* 없는 글에는 아무 행동도 못 한다. 답글·신고 버튼이 안 그려진다 */
    availableActions: [],
  }
}

/** 목록 첫 장 앞에 붙일 것. 만남시각 오름차순 — 서버 정렬과 같다 */
export function fixtureListItems(): ListItem[] {
  return DATA.posts
    .map(toPost)
    .sort((a, b) => a.meetAt.localeCompare(b.meetAt))
    .map((p) => ({
      id: p.id,
      eventId: null,
      eventTitle: p.eventTitle ?? null,
      title: p.title,
      excerpt: excerpt(p.content),
      status: p.status,
      closedReason: p.closedReason,
      capacity: p.capacity,
      meetAt: p.meetAt,
      meetPoint: p.meetPoint,
      author: { id: p.author.id, nickname: p.author.nickname, imageUrl: p.author.profileImageUrl },
      commentCount: p.commentCount,
      imageUrl: p.eventImageUrl ?? null,
    }))
}

/** 상세. 없으면 null — 라우트가 404 로 보낸다 */
export function fixturePost(id: string): { post: CompanionPost; comments: PostComment[] } | null {
  const p = DATA.posts.find((x) => x.id === id)
  if (!p) return null
  return { post: toPost(p), comments: p.comments.map(toComment) }
}

/** 프로필. 그 사람이 방장인 글만 싣는다 — 서버의 `{userId}/posts` 도 그렇다 */
export function fixtureProfile(id: string): ProfileData | null {
  const u = USERS.get(id)
  if (!u) return null
  return {
    id: u.id,
    nickname: u.nickname,
    profileImageUrl: u.profileImageUrl,
    bio: u.bio,
    lastSeen: u.lastSeen,
    posts: DATA.posts
      .filter((p) => p.host === id)
      .map((p) => ({
        id: p.id,
        title: p.title,
        status: 'CLOSED' as const,
        closedReason: 'MANUAL' as const,
        meetAt: p.meetAt,
        district: p.district,
        imageUrl: p.eventImageUrl,
        commentCount: p.comments.length,
      })),
  }
}
