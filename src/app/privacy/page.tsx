import type { Metadata } from 'next'
import { LegalStub } from '@/components/ui/LegalStub'

export const metadata: Metadata = {
  title: '개인정보 처리방침 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <LegalStub
      title="개인정보 처리방침"
      lead="아직 안 썼습니다."
      body="받는 값은 정해져 있습니다. 카카오 로그인 식별자, 닉네임, 연령대, 프로필 사진, 그리고 쓴 글과 댓글입니다. 성별은 안 받습니다. 이걸 문서로 옮기는 일만 남았습니다."
      todo={[
        '수집 항목과 보관 기간',
        '카카오에서 받아오는 값의 범위',
        '탈퇴 시 글·댓글 처리 방식',
      ]}
    />
  )
}
