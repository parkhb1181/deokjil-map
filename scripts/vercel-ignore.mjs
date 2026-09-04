/**
 * Vercel 빌드를 건너뛸지 정한다.
 *
 * vercel.json 의 ignoreCommand 가 이걸 부른다.
 *   종료코드 0 → 빌드하지 않는다
 *   종료코드 1 → 빌드한다
 *
 * 왜 필요한가. main 에 푸시할 때마다 프로덕션 빌드가 도는데, 이틀에
 * 커밋이 49개 올라간 적이 있다. 그중 상당수가 문서·워크플로만 고친
 * 것이었다. 화면이 하나도 안 바뀌는데 페이지 289장과 OG 카드 63장을
 * 다시 만들었고, 그게 청구서에서 제일 큰 줄이 됐다.
 *
 * **판단은 보수적으로 한다.** 확실히 빌드가 필요 없는 것만 건너뛰고,
 * 애매하면 빌드한다. 건너뛰어서 배포가 안 나가는 쪽이 쓸데없이 한 번
 * 더 빌드하는 쪽보다 훨씬 나쁘다.
 *
 * 손으로 다시 돌리려면 Vercel 대시보드의 Redeploy 를 누르면 된다.
 * 이 스크립트를 타지 않는다.
 */
import { execSync } from 'node:child_process'

/** 종료코드를 헷갈리지 않게 이름을 붙여 둔다 */
const BUILD = () => process.exit(1)
const SKIP = () => process.exit(0)

const say = (...a) => console.log('[vercel-ignore]', ...a)

/**
 * 바뀌어도 화면에 영향이 없는 것들.
 *
 * scripts/ 는 넣지 않는다. prebuild 가 scripts/og-shots.mjs 를 돌리고,
 * 이 파일 자체도 거기 있다. 빌드 결과를 바꾸는 자리다.
 *
 * .github/ 는 넣는다. 워크플로는 Actions 에서 돌지 Vercel 에서 돌지 않는다.
 * 다만 데이터 갱신 커밋은 src/data/events.json 을 건드리므로 아래 규칙에
 * 걸리지 않고 정상적으로 빌드된다.
 */
const SKIPPABLE = [
  /^docs\//,
  /^\.github\//,
  /^\.claude\//,
  /^\.vscode\//,
  /^\.idea\//,
  /\.md$/,
  /^LICENSE$/,
  /^\.gitignore$/,
  /^\.editorconfig$/,
]

/*
 * 프리뷰도 같은 규칙으로 거른다.
 *
 * 한때 프리뷰는 무조건 빌드했다. "브랜치를 올려놓고 확인하려는 것이라
 * 건너뛰면 확인할 것이 안 생긴다" 는 이유였는데, 작업을 develop 에서
 * 하기로 하면서 그 예외가 손해로 바뀌었다. 문서만 고친 커밋이 전에는
 * 0번 빌드였는데 develop 을 거치면서 프리뷰 빌드가 하나 붙는다.
 *
 * 같은 규칙을 태우면 문서 커밋은 양쪽 다 건너뛴다. 대가는 하나다 —
 * 한 번도 배포된 적 없는 브랜치의 첫 푸시가 문서뿐이면 프리뷰 주소가
 * 안 생긴다. 다음 코드 푸시에 생기므로 감수한다.
 */

let changed
try {
  /* HEAD^ 가 아니라 HEAD~1 이다. Windows cmd 에서 ^ 는 이스케이프
     문자라 execSync 가 그냥 HEAD 로 넘기고, 그러면 아무 차이도 안 나와서
     늘 빌드한다. Vercel 은 리눅스라 거기서는 안 드러났을 버그다.

     Vercel 은 얕은 클론을 준다. HEAD~1 이 없을 수 있어 실패를 잡는다 */
  changed = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
} catch {
  /* 비교할 것이 없으면 빌드한다. 여기서 건너뛰면 첫 배포가 안 나간다 */
  say('직전 커밋을 못 읽었다. 그대로 빌드한다')
  BUILD()
}

if (changed.length === 0) {
  say('바뀐 파일을 못 찾았다. 그대로 빌드한다')
  BUILD()
}

const matters = changed.filter((f) => !SKIPPABLE.some((re) => re.test(f)))

if (matters.length === 0) {
  say(`${changed.length}개 파일 전부 화면 밖이라 건너뛴다`)
  say('  ' + changed.slice(0, 8).join(', ') + (changed.length > 8 ? ' …' : ''))
  SKIP()
}

say(`빌드가 필요한 파일 ${matters.length}개`)
say('  ' + matters.slice(0, 8).join(', ') + (matters.length > 8 ? ' …' : ''))
BUILD()
