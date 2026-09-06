'use client'

import { useEffect, useState } from 'react'
import type { Sanction, Viewer } from '@/types'
import { apiGet, ApiFailure } from '@/lib/api/http'
import { USE_API } from '@/lib/api/config'
import { withAuth } from './refresh'

/**
 * 보는 사람이 누구인가.
 *
 * 화면 대부분이 이 값으로 갈린다 — 댓글을 쓸 수 있나, 신고 버튼을
 * 그리나, 이 글의 방장인가, 비밀 댓글 본문이 보이나.
 *
 * ─────────────────────────────────────────────────────────
 * **개발용 토글을 아직 지우지 않는다.**
 *
 * 서버가 없으면 우리는 로그인 여부밖에 모른다. 내가 누구인지(userId)와
 * 제재 상태는 서버만 안다. 지금 토글을 지우면 팀이 미리보기에서 방장
 * 화면도, 제재 화면도 볼 수 없다.
 *
 * 그래서 **API 주소가 있을 때만** 세션을 본다. 없으면 화면이 넘겨준
 * 토글 값을 그대로 돌려준다. 백엔드가 뜨는 날 토글을 지우고 이 분기도
 * 같이 지운다.
 */

/** `GET /api/v1/users/me` 중 화면이 쓰는 것만 (API 설계 2-2) */
interface Me {
  id: string
  /** 가입 정보를 넣었는가. 안 넣었으면 쓰기가 막힌다 (AU-07) */
  signupCompleted: boolean
  /** 없으면 제재가 없다는 뜻이다 */
  sanction?: Sanction | null
  /**
   * 관리자인가 (AD-06).
   *
   * 로그인은 모두 카카오 하나로 하고 역할만 얹는다 (2026-09-05 결정).
   * 관리자 전용 로그인 화면을 만들지 않는다 — 비밀번호를 우리가
   * 다루면 해싱·재설정·유출 대응을 떠안는데, 그 문 안에 비밀 댓글
   * 본문이 있다 (CM-17).
   *
   * **판정은 서버가 한다.** 화면이 판정하면 상태를 뒤집는 것으로
   * 그냥 뚫린다. 여기 값은 무엇을 그릴지 정하는 데만 쓴다.
   */
  role?: 'USER' | 'ADMIN'
}

export interface ViewerState {
  /** 관리자인가. 백오피스가 본다 */
  isAdmin?: boolean
  viewer: Viewer
  /**
   * 아직 모른다.
   *
   * 첫 렌더에서 항상 참이다. **서버 렌더에는 `localStorage` 가 없어서**
   * 로그인 상태를 알 방법이 없고, 알기 전에 「로그인하세요」 를 그리면
   * 이미 로그인한 사람이 그 화면을 한 번 본다.
   */
  loading: boolean
}

const GUEST: Viewer = { role: 'guest', userId: null, sanction: null }

/**
 * @param fallback 개발용 토글이 정한 값. API 주소가 없을 때만 쓴다
 * @param hostId   이 글의 방장. 나와 같으면 role 이 host 가 된다
 */
export function useViewer(fallback: Viewer, hostId?: string): ViewerState {
  const [state, setState] = useState<ViewerState>({ viewer: GUEST, loading: true })

  useEffect(() => {
    if (!USE_API) return

    /* 화면을 떠난 뒤 도착한 응답으로 상태를 건드리지 않는다 */
    let alive = true

    /*
     * withAuth 가 토큰을 붙이고, 만료면 재발급해 한 번 더 부른다.
     * 재발급은 진행 중인 것 하나로 묶이므로 화면 여럿이 이 훅을 써도
     * 서버는 한 번만 맞는다 (refresh.ts).
     */
    withAuth<Me | null>(
      (token) => (token ? apiGet<Me>('/api/v1/users/me', undefined, token) : Promise.resolve(null)),
      (e) => e instanceof ApiFailure && e.httpStatus === 401,
    )
      .then((me) => {
        if (!alive) return
        if (!me) {
          /* 로그인한 적이 없다. 공개 화면은 그대로 읽힌다 (CM-20) */
          setState({ viewer: GUEST, loading: false })
          return
        }
        setState({
          viewer: {
            role: hostId && me.id === hostId ? 'host' : 'member',
            userId: me.id,
            sanction: me.sanction ?? null,
          },
          isAdmin: me.role === 'ADMIN',
          loading: false,
        })
      })
      .catch(() => {
        if (!alive) return
        /*
         * 재발급까지 실패했다. Refresh 도 죽었거나(14일 경과·재사용
         * 탐지) 서버에 못 닿았다. refresh.ts 가 이미 세션을 지웠다.
         *
         * 비회원으로 떨어뜨린다. 공개 화면은 계속 읽히고, 쓰려고 하면
         * 로그인 안내가 뜬다.
         */
        setState({ viewer: GUEST, loading: false })
      })

    return () => {
      alive = false
    }
    /* fallback 은 매 렌더 새 객체다. 넣으면 무한 루프가 된다 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId])

  /*
   * API 를 안 쓰면 토글 값이 곧 답이다. **상태에 담지 않고 그대로
   * 돌려준다.**
   *
   * 한때 담았다가 토글이 죽었다 — 이펙트 의존성이 hostId 뿐이라
   * 토글을 눌러도 다시 돌지 않았다. fallback 을 의존성에 넣으면
   * 매 렌더 새 객체라 무한 루프가 된다. 담지 않으면 둘 다 없다.
   */
  if (!USE_API) return { viewer: fallback, loading: false }

  return state
}
