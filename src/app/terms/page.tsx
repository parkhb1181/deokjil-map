import type { Metadata } from 'next'
import { LegalStub } from '@/components/ui/LegalStub'

export const metadata: Metadata = {
  title: '이용약관 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <LegalStub
      title="이용약관"
      lead="아직 쓰지 않았습니다."
      body="로그인 화면이 이 문서에 동의하는 것으로 본다고 적어두고 있는데, 문서가 없으면 무엇에 동의하는지 알 수 없습니다. 실서비스로 열기 전에 반드시 채워야 합니다."
      todo={[
        '서비스 범위와 계정 정책',
        '금지 행위와 이용 제한 기준 (신고·차단과 연결)',
        '동행 중 생긴 일에 대한 책임 범위',
      ]}
    />
  )
}
