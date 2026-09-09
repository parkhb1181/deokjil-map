'use client'

import { useEffect } from 'react'

/**
 * 서비스워커를 붙인다.
 *
 * ─────────────────────────────────────────────────────────
 * **개발에서는 안 붙인다.**
 *
 * 붙이면 캐시가 끼어들어 「고쳤는데 화면이 안 바뀐다」 가 개발 중에
 * 계속 생긴다. 원인이 코드가 아니라 캐시라서 찾는 데 시간이 든다.
 * 오프라인과 설치 배너는 배포된 것에서만 확인하면 되는 값이다.
 *
 * **로드가 끝난 뒤에 붙인다.** 등록 자체가 네트워크를 쓰므로 첫 화면이
 * 그려지는 동안 자리를 다투게 두지 않는다. 계측 스크립트를
 * `afterInteractive` 로 둔 것과 같은 판단이다 (CLAUDE.md).
 *
 * **실패해도 조용히 넘어간다.** 서비스워커가 없어도 서비스는 그대로
 * 돌아간다. 여기서 화면에 오류를 띄우면 아무것도 못 하는 사람에게
 * 고칠 수 없는 말을 하는 셈이다.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
