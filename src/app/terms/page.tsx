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
      lead="아직 안 썼습니다."
      body="로그인 화면에서는 이 문서에 동의한 걸로 처리하고 있는데 정작 문서가 없습니다. 실서비스로 열기 전에 채워야 합니다."
      todo={[
        '서비스 범위와 계정 정책',
        '금지 행위와 이용 제한 기준 (신고·차단과 연결)',
        '동행 중 생긴 일에 대한 책임 범위',
      ]}
    />
  )
}
