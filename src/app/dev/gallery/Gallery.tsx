'use client'

/**
 * 공용 조각 갤러리.
 *
 * 화면을 그리다가 필요할 때마다 조각을 만들면 에러 상태나 빈 상태를
 * 빼먹는다. 나중에 "여기 에러는 어떻게 생겼더라" 하면서 매번 다시
 * 정하게 된다. 한자리에 다 깔아두면 빠진 칸이 눈에 보인다.
 */
import { useState } from 'react'
import { Field, TextInput, TextArea, Checkbox } from '@/components/ui/Field'
import { Button, Badge, Avatar, Who, Blank, Skeleton, Sheet, Tabs, KakaoMark } from '@/components/ui/Basics'
import { PostCard, Comment } from '@/components/ui/Post'
/* 신고 시트를 여기서 다시 그리지 않는다. 손으로 그려두면 실제
   화면과 사유 목록이 갈라지고, 갈라진 쪽을 보고 새 화면을 만든다 */
import { ReportSheet, type ReportTarget } from '@/components/ui/ReportSheet'
import { EventPicker, type PickableEvent } from '@/components/ui/EventPicker'
import { PlaceMap } from '@/components/ui/PlaceMap'

function Row({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="g-row">
      <div className="g-row__head">
        <h2 className="g-row__title">{title}</h2>
        {note && <p className="g-row__note">{note}</p>}
      </div>
      <div className="g-row__body">{children}</div>
    </section>
  )
}

function Case({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="g-case">
      <span className="g-case__tag">{label}</span>
      {children}
    </div>
  )
}

export default function Gallery({ events }: { events: PickableEvent[] }) {
  const [body, setBody] = useState('')
  const [tab, setTab] = useState(0)
  const [ask, setAsk] = useState<null | 'done' | ReportTarget>(null)
  const [picked, setPicked] = useState<PickableEvent | null>(null)

  return (
    <div className="g">
      <header className="g-top">
        <h1 className="g-top__title">공용 조각</h1>
        <p className="g-top__desc">
          화면을 조립할 재료. 모든 상태를 한자리에 둔다.
          색과 간격은 <code>globals.css</code> 토큰을 그대로 쓴다.
        </p>
      </header>

      {/* ── 색 ───────────────────────────────────────── */}
      <Row title="색" note="앞의 넷은 원래 있던 것, 뒤의 넷이 폼 때문에 새로 넣은 것">
        <div className="g-swatches">
          {[
            ['--accent', '주요 행동'],
            ['--accent-ink', '연분홍 배경 위 글자'],
            ['--text', '본문'],
            ['--text-mute', '보조. 4.9:1, 더 밝게 금지'],
            ['--focus', '포커스 링'],
            ['--danger', '에러. 5.9:1'],
            ['--field-border', '입력 테두리'],
            ['--field-off-bg', '비활성'],
          ].map(([token, use]) => (
            <div key={token} className="g-swatch">
              <span className="g-swatch__chip" style={{ background: `var(${token})` }} />
              <code>{token}</code>
              <small>{use}</small>
            </div>
          ))}
        </div>
      </Row>

      {/* ── 입력 ─────────────────────────────────────── */}
      <Row
        title="입력"
        note="기본 · 에러 · 비활성 · 글자수 · 선택 표시. iOS 확대를 막으려고 전부 16px. 별표(required)는 지금 쓰는 화면이 없다 — 한 폼의 2/3 이상이 필수면 선택인 칸에만 '선택'을 단다 (SCALE.md 「폼」)"
      >
        <Case label="기본">
          <Field label="닉네임" hint="2~10자, 나중에 바꿀 수 있어요">
            <TextInput placeholder="덕질하는 오리" />
          </Field>
        </Case>

        <Case label="에러 (409 중복)">
          <Field label="닉네임" error="이미 쓰고 있는 닉네임이에요">
            <TextInput defaultValue="덕질하는 오리" />
          </Field>
        </Case>

        <Case label="선택인 칸 (신고의 '자세히')">
          <Field label="자세히" optional hint="적어주시면 처리가 빨라져요">
            <TextInput placeholder="어떤 점이 문제였는지 적어주세요" />
          </Field>
        </Case>

        <Case label="비활성">
          <Field label="이메일" disabled hint="소셜 계정에서 가져와요">
            <TextInput value="parkhb159@naver.com" disabled readOnly />
          </Field>
        </Case>

        <Case label="여러 줄 + 글자수">
          <Field
            label="본문"
            count={[body.length, 500]}
            error={body.length > 500 ? '500자를 넘었어요' : undefined}
          >
            <TextArea
              placeholder={'같이 가실 분 구해요.\n연락은 비밀 댓글로 주세요.'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
        </Case>

        <Case label="체크">
          <Checkbox label="비밀 댓글로 남기기" defaultChecked />
        </Case>
      </Row>

      {/* ── 버튼 ─────────────────────────────────────── */}
      <Row title="버튼" note="주요 하나, 나머지는 보조. 한 화면에 주요 버튼이 둘이면 무엇을 눌러야 할지 흐려진다">
        <Case label="주요 · 보조 · 위험">
          <div className="g-inline">
            <Button>모집글 쓰기</Button>
            <Button tone="ghost">취소</Button>
            <Button tone="danger">글 삭제</Button>
          </div>
        </Case>
        <Case label="작게">
          <div className="g-inline">
            <Button size="sm">답글</Button>
            <Button size="sm" tone="ghost">수정</Button>
          </div>
        </Case>
        <Case label="비활성 · 제출 중">
          <div className="g-inline">
            <Button disabled>모집 완료</Button>
            <Button disabled>올리는 중…</Button>
          </div>
        </Case>
        <Case label="넓게">
          <Button block tone="kakao"><KakaoMark />카카오로 시작하기</Button>
        </Case>
      </Row>

      {/* ── 상태 ─────────────────────────────────────── */}
      <Row
        title="상태"
        note="신청·수락을 두지 않아 모집글 상태는 둘뿐이다. 방장이 완료를 누르면 도장이 찍힌다"
      >
        <Case label="배지">
          <div className="g-inline">
            <Badge state="open" />
            <Badge state="done" />
            <Badge state="off">방장</Badge>
          </div>
        </Case>
        <Case label="모집중 · 완료 · 사진 없음">
          <div className="g-stack g-stack--bleed">
            <PostCard
              state="open"
              title="아이유 콘서트 같이 가실 분"
              when="9/14 (토) 18:00"
              where="잠실 주경기장"
              image="/dev/map-sample.webp"
              comments={7}
            />
            <PostCard
              state="done"
              title="세븐틴 팝업 오전에 같이 가요"
              when="9/7 (일) 08:00"
              where="성수동"
              image="/dev/map-sample.webp"
              comments={12}
            />
            <PostCard
              state="open"
              title="붙은 행사가 없어 포스터가 없는 글"
              when="9/20 (일) 13:00"
              where="홍대입구역 9번 출구"
              comments={0}
            />
          </div>
        </Case>
      </Row>

      {/* ── 사람 ─────────────────────────────────────── */}
      <Row title="사람" note="사진이 없으면 닉네임 첫 글자. 회색 실루엣보다 서로 구분이 쉽다">
        <Case label="아바타 · 이름">
          <div className="g-inline">
            <Avatar name="오리" />
            <Avatar name="덕질" lg />
            <Who name="덕질하는오리" sub="동행 3회" />
          </div>
        </Case>
      </Row>

      {/* ── 댓글 ─────────────────────────────────────── */}
      <Row
        title="댓글"
        note="채팅이 없어 여기가 유일한 사적 통로다. 비밀 댓글 권한이 새면 연락처가 샌다"
      >
        <Case label="다섯 가지가 전부">
          <div className="g-thread">
            <Comment
              name="덕질하는오리"
              time="10분 전"
              text="저 갈게요! 굿즈 줄도 같이 서요"
              acts={<><button>답글</button><button>신고</button></>}
            />
            <Comment
              name="방장님"
              host
              reply
              time="8분 전"
              text="좋아요, 비밀 댓글로 연락처 남겨주세요"
              /* 실제 화면에 수정은 없다. 여기에만 있으면 있는 기능으로 읽힌다 */
              acts={<button>삭제</button>}
            />
            <Comment
              name="조용한덕후"
              time="5분 전"
              secret
              text="카톡 아이디 quiet_duck 입니다"
              acts={<button>삭제</button>}
            />
            <Comment name="다른사람" time="3분 전" secret />
            <Comment name="지운사람" time="1분 전" gone />
          </div>
          <p className="g-hint">
            넷째가 권한 없는 사람이 보는 모습이다. 서버가 본문 필드를 빼고 보낸다.
            화면에서 가리는 게 아니라 <b>애초에 오지 않는다</b>.
          </p>
        </Case>
      </Row>

      {/* ── 탭 ───────────────────────────────────────── */}
      <Row title="탭" note="알림이 없어서 내 활동 내역이 상태를 확인하는 유일한 경로다">
        <Case label="내 활동 내역">
          <Tabs items={['내 모집글', '내 댓글']} on={tab} onPick={setTab} />
        </Case>
      </Row>

      {/* ── 행사 고르기 · 지도 ───────────────────────── */}
      <Row
        title="행사 고르기 · 지도"
        note="쓰기 화면과 상세가 쓰는 조각. 지도는 카카오 키가 없으면 자리표시자로 떨어진다 — 배포에서는 진짜 지도가 같은 크기로 들어간다"
      >
        <Case label="접힘 · 검색 · 고른 뒤">
          <EventPicker all={events} picked={picked} onPick={setPicked} />
        </Case>
        <Case label="만남 장소">
          <div className="post__map">
            <PlaceMap lat={37.5445} lng={127.0557} label="성수역 3번 출구" />
          </div>
        </Case>
      </Row>

      {/* ── 시트 ─────────────────────────────────────── */}
      <Row
        title="시트"
        note="취소 사유 · 신고 · 삭제 확인이 전부 같은 모양을 쓴다. 신고는 실제 ReportSheet 다 — 대상마다 사유가 다르다"
      >
        <Case label="눌러보기">
          <div className="g-inline">
            <Button tone="ghost" onClick={() => setAsk('done')}>모집 완료</Button>
            <Button tone="ghost" onClick={() => setAsk('user')}>유저 신고</Button>
            <Button tone="ghost" onClick={() => setAsk('post')}>모집글 신고</Button>
            <Button tone="ghost" onClick={() => setAsk('comment')}>댓글 신고</Button>
          </div>
        </Case>
      </Row>

      {/* ── 빈 화면 ──────────────────────────────────── */}
      <Row
        title="빈 화면 · 실패"
        note="목록이 API 로 바뀌면 서버가 죽을 때 목록이 통째로 사라진다. 그때 보일 화면"
      >
        <Case label="빈 목록">
          <Blank
            title="아직 모집글이 없어요"
            desc="이 공연에 처음으로 동행을 구해보세요"
            action={<Button size="sm">모집글 쓰기</Button>}
          />
        </Case>
        <Case label="조회 실패">
          <Blank
            title="목록을 불러오지 못했어요"
            desc="잠시 뒤 다시 시도해주세요"
            action={<Button size="sm" tone="ghost">다시 시도</Button>}
          />
        </Case>
        <Case label="권한 없음">
          <Blank title="로그인이 필요해요" desc="모집글 작성과 댓글은 로그인 후에 할 수 있어요" />
        </Case>
        <Case label="기다리는 중">
          <div className="g-stack">
            <Skeleton h={92} />
            <Skeleton h={92} />
          </div>
        </Case>
      </Row>

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

      {ask !== null && ask !== 'done' && (
        /* 화면이 쓰는 그 컴포넌트를 그대로 부른다. 사유 목록이 대상마다
           다른 것도 여기서 눌러보고 확인한다 */
        <ReportSheet
          target={ask}
          name={ask === 'user' ? '조용한덕후' : undefined}
          onClose={() => setAsk(null)}
        />
      )}
    </div>
  )
}
