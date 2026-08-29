'use client'

import { createContext, useContext } from 'react'
import type { EventItem } from '@/types'

/**
 * 담기 상태 전달용 컨텍스트.
 *
 * 카드는 홈·전체·지도·검색·내 코스 다섯 화면에 나온다. 담기 상태를 props 로 내리면
 * 중간 컴포넌트 다섯 개가 자기와 상관없는 값을 받아 넘기기만 하는 통로가 된다.
 * 카드가 직접 꺼내 쓰게 두면 그 다섯 개를 손대지 않아도 된다.
 *
 * 상태 자체는 page.tsx 가 들고 있다. localStorage 쓰기와 계측이 거기 모여 있어야
 * 담기 한 번에 이벤트가 두 번 나가는 일이 안 생긴다.
 */
export interface SaveApi {
  isSaved: (id: string) => boolean
  toggle: (event: EventItem) => void
}

const noop: SaveApi = { isSaved: () => false, toggle: () => {} }

const SaveContext = createContext<SaveApi>(noop)

export const SaveProvider = SaveContext.Provider

export function useSave(): SaveApi {
  return useContext(SaveContext)
}
