'use client'

/**
 * 신고 시트.
 *
 * 유저·모집글·댓글 셋을 한 컴포넌트가 맡는다. 화면마다 따로 만들면
 * 사유 목록이 갈라지고, 갈라지면 백오피스에서 같은 신고를 다른
 * 이름으로 받게 된다.
 *
 * 대상에 따라 사유가 조금 다르다. 사람에게만 "약속을 지키지 않음"
 * 이 있고 글에만 "허위 정보" 가 있다. 그 차이만 표로 두고 나머지는
 * 같은 흐름을 쓴다.
 *
 * 신고 사실은 상대에게 알리지 않는다. 알리면 보복이 오고, 그러면
 * 아무도 신고하지 않는다.
 */
import { useState } from 'react'
import { Button, Sheet } from './Basics'
import { Field, TextArea, Select } from './Field'

export type ReportTarget = 'user' | 'post' | 'comment'

/**
 * 나이 신고 사유.
 *
 * 「만 14세 미만으로 보입니다」 라고 적으려다 말았다. **신고하는 사람은
 * 남의 나이를 판정할 수 없다.** 판정을 시키면 어려 보인다는 인상만으로
 * 신고가 쌓이고, 우리는 그걸로 아무것도 못 한다.
 *
 * 그래서 본 것만 적게 한다. 「속인 것 같다」 는 판정이 아니라 인상이고,
 * 인상만으로는 조치하지 않는다는 것을 아래 note 에서 그대로 말한다.
 * 처리방침 제10조가 「근거가 추측뿐인 경우 아무 조치도 하지 않는다」 고
 * 못박아 둔 것과 같은 규칙이다.
 */
/**
 * 신고 사유. **코드가 계약이고 라벨은 화면 문구다.**
 *
 * 서버가 `reason` 을 enum 으로 검증한다 (결정 D-6). 라벨을 그대로
 * 보내면 문구를 한 글자만 다듬어도 서버가 400 을 낸다.
 *
 * 여덟이다 (2026-09-05 확정). **사칭은 뺐다** — 신고자가 무엇을 근거로
 * 사칭을 판정하며 접수 후 관리자가 무엇을 할 수 있는지가 없었다. 1차에
 * 신원 확인 수단이 아예 없어 조치할 수 없는 신고만 쌓인다. 주최자
 * 사칭은 모집글 내용이라 POST 의 FALSE_INFO 로 받는다.
 */
export type ReportReason =
  | 'ADVERTISEMENT'
  | 'INAPPROPRIATE'
  | 'ABUSE'
  | 'NO_SHOW'
  | 'AGE_SUSPICION'
  | 'FALSE_INFO'
  | 'OFF_TOPIC'

const LABEL: Record<ReportReason, string> = {
  ADVERTISEMENT: '광고 · 홍보',
  INAPPROPRIATE: '부적절한 내용',
  ABUSE: '욕설 · 비방',
  NO_SHOW: '약속을 지키지 않음',
  AGE_SUSPICION: '나이를 속인 것 같아요',
  FALSE_INFO: '허위 정보',
  OFF_TOPIC: '동행과 무관한 글',
}

/* 공통 사유를 앞에 두고 대상별 사유를 뒤에 붙인다. 순서가 화면마다
   달라지면 습관으로 누르던 자리가 바뀐다.

   이 표가 곧 서버의 조합 검증표다. USER 전용 사유를 COMMENT 로
   보내면 400 이다 */
const COMMON: ReportReason[] = ['ADVERTISEMENT', 'INAPPROPRIATE', 'ABUSE']
const EXTRA: Record<ReportTarget, ReportReason[]> = {
  user: ['NO_SHOW', 'AGE_SUSPICION'],
  post: ['FALSE_INFO', 'OFF_TOPIC'],
  comment: ['FALSE_INFO'],
}

const TITLE: Record<ReportTarget, string> = {
  user: '님을 신고할까요?',
  post: '이 모집글을 신고할까요?',
  comment: '이 댓글을 신고할까요?',
}

export function ReportSheet({ target, name, onClose }: {
  target: ReportTarget
  /** 사람을 신고할 때만 쓴다. 제목에 닉네임을 넣는다 */
  name?: string
  onClose: () => void
}) {
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [detail, setDetail] = useState('')
  const [tried, setTried] = useState(false)

  const title = target === 'user' && name ? `${name} ${TITLE.user}` : TITLE[target]
  const reasons = [...COMMON, ...EXTRA[target]]

  /* 나이 신고만 자세히 칸이 필수다. 다른 사유는 신고된 글·댓글이
     그 자체로 증거지만, 나이는 화면에 남는 것이 없어 신고자가 무엇을
     보았는지 적지 않으면 판단할 재료가 하나도 없다 */
  /* 코드로 본다. 라벨 문구를 다듬어도 이 검증이 안 풀린다 */
  const ageCase = reason === 'AGE_SUSPICION'
  const needDetail = ageCase && !detail.trim()

  const submit = () => {
    setTried(true)
    if (!reason || needDetail) return
    /* API 가 붙으면 여기서 POST 한다. 같은 대상을 두 번 신고하면
       서버가 막는다 (SF-01) */
    onClose()
  }

  return (
    <Sheet
      title={title}
      desc="검토 후 조치합니다. 신고 사실은 상대에게 알리지 않아요."
      foot={
        <>
          <Button tone="ghost" onClick={onClose}>취소</Button>
          <Button tone="danger" onClick={submit}>신고</Button>
        </>
      }
    >
      <Field label="사유" error={tried && !reason ? '사유를 골라주세요' : undefined}>
        <Select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          <option value="" disabled>골라주세요</option>
          {reasons.map((r) => (
            <option key={r} value={r}>{LABEL[r]}</option>
          ))}
        </Select>
      </Field>

      <Field
        label="자세히"
        optional={!ageCase}
        error={tried && needDetail ? '무엇을 보고 그렇게 생각했는지 적어주세요' : undefined}
        hint={
          ageCase
            ? '본인이 밝힌 말이나 글이 있으면 어디서 봤는지 적어주세요. 어려 보인다는 인상만으로는 조치하지 않습니다'
            : '적어주시면 처리가 빨라져요'
        }
        count={[detail.length, 300]}
      >
        <TextArea
          placeholder={
            ageCase
              ? '어느 글·댓글에서 무엇을 보았는지 적어주세요'
              : '어떤 점이 문제였는지 적어주세요'
          }
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
        />
      </Field>
    </Sheet>
  )
}
