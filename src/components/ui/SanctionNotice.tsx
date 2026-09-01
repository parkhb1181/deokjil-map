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

/**
 * 경고 배너. 화면 맨 위에 한 줄로 얹는다.
 *
 * 시트로 띄우지 않는다. 경고는 지금 하려던 일을 막을 이유가 없는데
 * 시트는 무조건 한 번 닫아야 한다. 배너면 읽고 지나갈 수 있다.
 */
export function SanctionBanner({ sanction }: { sanction?: Sanction | null }) {
  if (!sanction || sanction.kind !== 'WARNED') return null
  return (
    <div className="sanc" role="status">
      <p className="sanc__head">운영자 경고</p>
      <p className="sanc__body">{sanction.reason}</p>
      <p className="sanc__foot">
        같은 일이 반복되면 이용이 정지될 수 있어요.
      </p>
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

      {/* 사유가 제일 중요하다. 무엇을 잘못했는지 모르면 고칠 수 없다 */}
      <p className="sblock__reason">{sanction.reason}</p>

      <dl className="sblock__facts">
        <div>
          <dt>제재일</dt>
          <dd>{untilText(sanction.issued_at)}</dd>
        </div>
        {!banned && sanction.until && (
          <div>
            <dt>해제일</dt>
            <dd>{untilText(sanction.until)}</dd>
          </div>
        )}
      </dl>

      <p className="sblock__note">
        {banned
          ? '이 계정으로는 다시 이용할 수 없어요.'
          : '해제일이 지나면 자동으로 다시 쓸 수 있어요.'}
      </p>

      {/* 이의 제기 경로. 없으면 사용자가 할 수 있는 것이 하나도 없다.
          메일 주소는 서비스 도메인이 정해지면 바꾼다 */}
      <p className="sblock__appeal">
        잘못 처리되었다고 생각하면 <a href="mailto:help@duckmoim.com">help@duckmoim.com</a> 으로
        알려주세요.
      </p>
    </div>
  )
}
