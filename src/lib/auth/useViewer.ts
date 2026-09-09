'use client'

import { useEffect, useState } from 'react'
import type { Viewer } from '@/types'
import { ApiFailure } from '@/lib/api/http'
import { USE_API } from '@/lib/api/config'
import { fetchMe, type Me } from '@/lib/api/users'
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

/**
 * 응답 모양과 매퍼는 `lib/api/users.ts` 에 있다. **여기서 캐스팅으로 받지
 * 않는다** — 서버가 `id` 를 숫자로 주는데 `Viewer.userId` 는 문자열이라,
 * 정규화를 건너뛰면 아래 `me.id === hostId` 가 조용히 false 가 된다.
 */

export interface ViewerState {
  /*
   * **관리자 여부를 여기서 주지 않는다.** 한때 `isAdmin` 이 있었고
   * `/users/me` 의 `role` 을 봤는데, 그런 칸이 서버에도 계약에도 없어서
   * (API 설계 2-2) 늘 거짓이었다. 백오피스가 관리자 API 를 직접 불러
   * 403 인지로 판정한다 (`admin15616/Admin.tsx`).
   */
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
      (token) => (token ? fetchMe(token) : Promise.resolve(null)),
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
            sanction: me.sanction,
          },
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
