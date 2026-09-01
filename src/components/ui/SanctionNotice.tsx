'use client'

/**
 * 제재 안내.
 *
 * 백오피스에서 제재를 주기만 하고 **받는 쪽에 알려주는 자리가 없었다.**
 * 제재 시트의 사유 칸에 「본인에게 보이는 문구입니다」 라고 적어두고도
 * 보여줄 화면을 안 만들었다.
 *
 * 무엇을 잘못했는지 모르면 고칠 수가 없다. 그러면 제재가 사람을
 * 고치는 장치가 아니라 그냥 벌이 된다. 이의를 제기할 근거도 없다.
 *
 * 두 가지로 나뉜다.
 *
 *   경고        막지 않는다. 계속 쓸 수 있고 배너로만 알린다
 *   정지·영구   쓰기를 막고 안내를 화면 가운데 세운다 (AD-04)
 *
 * 경고를 막지 않는 것이 중요하다. 막을 거면 정지를 주면 된다.
 * 경고는 "다음에 같은 일이 있으면 정지된다" 는 예고다.
 */
import type { Sanction } from '@/types'

const KIND_LABEL: Record<string, string> = {
  WARNED: '경고를 받았어요',
  SUSPENDED: '이용이 일시 정지되었어요',
  BANNED: '이용이 영구 정지되었어요',
}

/** '2026-09-08T00:00' → '9월 8일 (화)' */
function untilText(iso: string) {
  const [d] = iso.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const dow = '일월화수목금토'[new Date(y, m - 1, day).getDay()]
  return `${m}월 ${day}일 (${dow})`
}

/** 느낌표. 이모지를 쓰지 않는다. 기기마다 모양이 달라 톤이 흐트러진다 */
function AlertMark() {
  return (
    <svg className="sanc__icon" viewBox="0 0 20 20" aria-hidden focusable="false">
      <circle cx="10" cy="10" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 5.8v4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="13.9" r="1.05" fill="currentColor" />
    </svg>
  )
}

/**
 * 경고 배너.
 *
 * 당근 SEED 의 Callout 구조를 따랐다. 앞머리 아이콘 · 제목 · 본문 ·
 * 링크 라벨이다. 전에는 글자 세 줄만 쌓아두어서 무엇이 제목이고
 * 무엇이 사유인지 눈으로 안 끊겼고, 읽고 나서 할 수 있는 것도 없었다.
 *
 * **링크가 중요하다.** 경고를 읽은 사람이 다음에 하는 생각이 "이거
 * 왜 받았지" 아니면 "잘못된 것 같은데" 둘 중 하나인데, 나가는 길이
 * 없으면 어느 쪽도 못 한다.
 *
 * 시트로 띄우지 않는다. 경고는 지금 하려던 일을 막을 이유가 없는데
 * 시트는 무조건 한 번 닫아야 한다. 배너면 읽고 지나갈 수 있다.
 *
 * 닫기 버튼도 두지 않는다. 닫으면 다시 볼 방법이 없고, 제재는
 * 사용자가 치워도 되는 알림이 아니다.
 */
export function SanctionBanner({ sanction }: { sanction?: Sanction | null }) {
  if (!sanction || sanction.kind !== 'WARNED') return null
  return (
    <div className="sanc" role="status">
      <AlertMark />
      <div className="sanc__main">
        <p className="sanc__head">
          운영자 경고
          <span className="sanc__when">{untilText(sanction.issuedAt)}</span>
        </p>
        <p className="sanc__body">{sanction.reason}</p>
        <p className="sanc__note">같은 일이 반복되면 이용이 정지될 수 있어요.</p>
        <a className="sanc__link" href="mailto:help@duckmoim.com">
          이의 제기
          <svg viewBox="0 0 12 12" aria-hidden focusable="false">
            <path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </div>
  )
}

/**
 * 정지 안내. 화면을 통째로 차지한다 (AD-04).
 *
 * 로그인은 되지만 그다음이 이 화면 하나다. 목록을 보여주고 쓰기만
 * 막으면 "왜 안 써지지" 를 알 방법이 없다.
 */
export function SanctionBlock({ sanction }: { sanction: Sanction }) {
  const banned = sanction.kind === 'BANNED'
  return (
    <div className="sblock">
      <img className="sblock__art" src="/duck-face.webp" alt="" width={96} height={96} />
      <h1 className="sblock__title">{KIND_LABEL[sanction.kind]}</h1>

      {/* 사유가 제일 중요하다. 무엇을 잘못했는지 모르면 고칠 수 없다.
          라벨을 붙이고 왼쪽에 색선을 세운다. 전에는 회색 상자 안의
          본문 크기 글자라 안내 문구와 무게가 같았다 */}
      <div className="sblock__reason">
        <p className="sblock__rlabel">제재 사유</p>
        <p className="sblock__rtext">{sanction.reason}</p>
      </div>

      {/* 사용자가 알고 싶은 것은 "언제 다시 쓸 수 있나" 지 "언제
          벌받았나" 가 아니다. 해제일을 크게 세우고 제재일은 밑에
          작게 둔다. 전에는 둘을 같은 크기로 나란히 놓아서 두 날짜가
          한 덩어리로 보였다 */}
      {banned ? (
        <p className="sblock__until sblock__until--ban">다시 이용할 수 없어요</p>
      ) : (
        sanction.until && (
          <p className="sblock__until">
            <b>{untilText(sanction.until)}</b>
            <span>까지</span>
          </p>
        )
      )}
      <p className="sblock__since">{untilText(sanction.issuedAt)}에 제재되었어요</p>

      {!banned && (
        <p className="sblock__note">그날이 지나면 자동으로 풀려요. 따로 신청하지 않아도 됩니다.</p>
      )}

      {/* 이의 제기 경로. 없으면 사용자가 할 수 있는 것이 하나도 없다.
          메일 주소는 서비스 도메인이 정해지면 바꾼다 */}
      <p className="sblock__appeal">
        잘못 처리되었다고 생각하면 <a href="mailto:help@duckmoim.com">help@duckmoim.com</a> 으로
        알려주세요.
      </p>
    </div>
  )
}
