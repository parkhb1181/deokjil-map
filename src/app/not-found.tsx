import Link from 'next/link'

/**
 * 404.
 *
 * 마감된 이벤트가 목록에서 빠지므로 (poc-plan 4.3) 공유받은 링크가
 * 죽는 일이 흔하다. 커뮤니티에서 링크를 타고 온 사람이 대부분이라
 * 여기서 그냥 돌려보내면 그 사람은 다시 안 온다.
 *
 * 그래서 "없다" 로 끝내지 않고 갈 곳을 준다.
 */
export default function NotFound() {
  return (
    <div className="nf">
      <img className="blank__art" src="/duck-face.webp" alt="" width={112} height={112} />
      <h1 className="nf__title">찾는 페이지가 없어요</h1>
      <p className="nf__desc">
        주소가 바뀌었거나 이미 끝난 행사일 수 있어요.
        <br />
        지금 열리는 것들을 대신 보여드릴게요.
      </p>
      <div className="nf__acts">
        <Link className="btn btn--primary" href="/">
          지금 열리는 곳 보기
        </Link>
        <Link className="btn btn--ghost" href="/p">
          동행 구하는 글 보기
        </Link>
      </div>
    </div>
  )
}
