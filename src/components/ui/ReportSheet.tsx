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

/* 공통 사유를 앞에 두고 대상별 사유를 뒤에 붙인다. 순서가 화면마다
   달라지면 습관으로 누르던 자리가 바뀐다 */
const COMMON = ['광고 · 홍보', '부적절한 내용', '욕설 · 비방']
const EXTRA: Record<ReportTarget, string[]> = {
  user: ['약속을 지키지 않음', '사칭'],
  post: ['허위 정보', '동행과 무관한 글'],
  comment: ['허위 정보'],
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
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [tried, setTried] = useState(false)

  const title = target === 'user' && name ? `${name} ${TITLE.user}` : TITLE[target]
  const reasons = [...COMMON, ...EXTRA[target]]

  const submit = () => {
    setTried(true)
    if (!reason) return
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
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="" disabled>골라주세요</option>
          {reasons.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </Select>
      </Field>

      <Field
        label="자세히"
        optional
        hint="적어주시면 처리가 빨라져요"
        count={[detail.length, 300]}
      >
        <TextArea
          placeholder="어떤 점이 문제였는지 적어주세요"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
        />
      </Field>
    </Sheet>
  )
}
