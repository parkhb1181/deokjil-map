'use client'

/**
 * 홈 화면 추가 계측 (NT-15 · poc-plan 7번).
 *
 * 둘을 쏜다.
 *
 *   install_app       추가되는 순간. 안드로이드 크롬이 `appinstalled` 를
 *                     준다. iOS 는 안 준다
 *   launch_installed  아이콘으로 열린 세션. iOS 는 이것으로만 설치를
 *                     안다. 세션당 한 번 — 화면을 오갈 때마다 쏘면 방문
 *                     수와 구분이 안 된다
 *
 * 화면을 그리지 않는다. 레이아웃에 한 번 꽂힌다.
 */
import { useEffect } from 'react'
import { track } from '@/lib/analytics'
import { launchedInstalled } from '@/lib/push'

const SEEN = 'duckmoim.launch_installed'

export default function InstallTrack() {
  useEffect(() => {
    const onInstalled = () => track('install_app')
    window.addEventListener('appinstalled', onInstalled)

    if (launchedInstalled()) {
      let seen = false
      try {
        seen = sessionStorage.getItem(SEEN) === '1'
        sessionStorage.setItem(SEEN, '1')
      } catch {
        /* 저장소가 막혀 있으면 매번 쏜다. 과다 계상이 누락보다 낫다 */
      }
      if (!seen) track('launch_installed')
    }

    return () => window.removeEventListener('appinstalled', onInstalled)
  }, [])
  return null
}
