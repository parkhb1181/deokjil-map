import type { Metadata } from 'next'
import Gallery from './Gallery'
import './gallery.css'

/** 내부용 화면이다. 검색에 걸리면 안 된다 */
export const metadata: Metadata = {
  title: '공용 조각 · 덕모임',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Gallery />
}
