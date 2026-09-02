'use client'

/**
 * 로고와 검색칸을 한 줄에 세운다.
 *
 * 헤더에는 로고 하나만 남아 있었다. 검색을 필터 옆으로 내리고
 * 실서비스에서는 동행 버튼도 안 그리므로, 91px 짜리 줄이 로고 하나를
 * 이고 첫 화면을 먹고 있었다.
 *
 * 오른쪽이 빈 것이 문제가 아니라 **그 높이를 쓸 만큼 일을 안 하는 것**이
 * 문제였다. 그래서 채우는 대신 검색줄과 합쳤다. 로고는 브랜드 자리를
 * 지키고, 그 줄은 원래부터 사람이 손을 대는 줄이라 높이가 아깝지 않다.
 *
 * **와이어프레임 빌드에서만 켠다.** 실서비스 화면은 지금 헤더를 그대로
 * 쓴다. 팀이 먼저 보고 판단한 뒤에 옮긴다 (lib/wireframe.ts).
 *
 * 동행 입구는 하단 탭으로 옮겼다. 이 줄은 브랜드와 검색만 맡는다.
 *
 * 목록과 지도가 검색칸을 각자 갖고 있어서 이 줄도 양쪽에서 쓴다.
 * 즐겨찾기 탭에는 검색칸이 없어 이 줄도 없다. 거기는 하단 탭으로만
 * 들어오는 화면이라 브랜드를 다시 보여줄 자리가 아니다.
 */
import type { ReactNode } from 'react'
import Logo from './Logo'
import { IS_WIREFRAME } from '@/lib/wireframe'

export function BrandLine({ children }: { children: ReactNode }) {
  return (
    <div className="brandline">
      <h1 className="brandline__logo">
        <Logo />
      </h1>

      {/* 검색칸이 남는 자리를 다 가져간다.

          동행 입구는 하단 탭으로 옮겼다. 여기 두었더니 이 줄 하나가
          브랜드·검색·이동 세 가지를 하게 돼서, 정작 검색칸이 좁아졌다 */}
      {children}
    </div>
  )
}

/**
 * 검색칸을 이 줄에 감쌀지 그대로 둘지.
 *
 * 부르는 쪽마다 `IS_WIREFRAME &&` 을 적으면 세 군데에 같은 분기가
 * 생기고 한 곳만 빠뜨리면 로고가 반쪽만 옮겨간다.
 */
export function withBrand(search: ReactNode): ReactNode {
  return IS_WIREFRAME ? <BrandLine>{search}</BrandLine> : search
}
