'use client'

import { useEffect, useState } from 'react'
import type { Sanction, Viewer } from '@/types'
import { apiGet } from '@/lib/api/http'
import { USE_API } from '@/lib/api/config'
import { clearTokens, getAccessToken } from './session'

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
}

export interface ViewerState {
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
  const [state, setState] = useState<ViewerState>(() =>
    /* API 를 안 쓰면 기다릴 것이 없다. 토글 값이 곧 답이다 */
    USE_API ? { viewer: GUEST, loading: true } : { viewer: fallback, loading: false },
  )

  useEffect(() => {
    if (!USE_API) {
      setState({ viewer: fallback, loading: false })
      return
    }

    const token = getAccessToken()
    if (!token) {
      setState({ viewer: GUEST, loading: false })
      return
    }

    /* 화면을 떠난 뒤 도착한 응답으로 상태를 건드리지 않는다 */
    let alive = true

    apiGet<Me>('/api/v1/users/me', undefined, token)
      .then((me) => {
        if (!alive) return
        setState({
          viewer: {
            role: hostId && me.id === hostId ? 'host' : 'member',
            userId: me.id,
            sanction: me.sanction ?? null,
          },
          loading: false,
        })
      })
      .catch(() => {
        if (!alive) return
        /*
         * 토큰이 죽었다. **여기서 재발급을 부르지 않는다.**
         *
         * Refresh Rotation 이라 동시에 두 번 부르면 서버가 그 유저의
         * 세션을 통째로 폐기한다 (AU-03). 화면 여럿이 이 훅을 쓰므로
         * 각자 부르면 그 일이 실제로 난다. 재발급은 한 곳에서만 한다.
         *
         * 지금은 지우고 비회원으로 떨어뜨린다. 로그인 화면이 열린다.
         */
        clearTokens()
        setState({ viewer: GUEST, loading: false })
      })

    return () => {
      alive = false
    }
    /* fallback 은 매 렌더 새 객체다. 넣으면 무한 루프가 된다 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId])

  return state
}
