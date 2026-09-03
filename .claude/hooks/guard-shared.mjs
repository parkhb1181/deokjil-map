#!/usr/bin/env node
/**
 * 팀 공용 파일을 Bash 로 고치는 것을 막는다.
 *
 * settings.json 의 `permissions.deny` 는 Edit 도구만 본다. Bash 는 다른
 * 도구라 `sed -i` 나 `cat >` 로 같은 파일에 그대로 닿는다. 그 문을 닫는
 * 것이 이 훅의 전부다 (docs/HARNESS.md 「왜 두 겹인가」).
 *
 * 읽기는 통과시킨다. `cat .githooks/x` 는 되고 `cat > .githooks/x` 는 안 된다.
 * 참고하려고 열어보는 것까지 막으면 규칙을 지키기가 더 어려워진다.
 *
 * 완전하지 않다. 쓰기를 표현하는 방법은 무한하고 여기 적힌 패턴은 유한하다.
 * 작정한 우회가 아니라 실수를 잡는 장치다.
 */

// 경로 앞은 문자열 시작이거나 단어가 아닌 문자다. 명령 한가운데 공백 뒤에
// 오는 경우가 대부분이라 '/' 만 보면 걸리지 않는다.
const PROTECTED = [
  /(?:^|[^\w.-])\.githooks\//,
  /(?:^|[^\w.-])\.github\/scripts\//,
  /(?:^|[^\w.-])\.github\/workflows\/jira-[\w.-]*\.ya?ml/,
  /(?:^|[^\w.-])\.github\/PULL_REQUEST_TEMPLATE\.md/,
]

/**
 * 제자리에서 파일을 바꾸는 명령들. 리다이렉션은 아래에서 따로 본다.
 *
 * 한 줄짜리 정규식이었는데 갈래가 늘어 배열로 폈다. 어느 갈래가 무엇을
 * 잡는지 보이지 않으면 빠진 것도 안 보인다.
 *
 * **인터프리터는 이름만으로 판단하지 않는다.** `node` 가 보인다고 막으면
 * 읽는 것까지 막힌다. `node -e "readFileSync('.githooks/x')"` 는 그냥
 * 열어보는 것이라 통과해야 한다. 백엔드 원본이 어떻게 생겼는지 못 보면
 * 무엇을 요청해야 할지도 모르게 된다. 그래서 **쓰는 함수가 같이 있을
 * 때만** 막는다.
 */
const MUTATORS = new RegExp(
  [
    /* 파일을 지우거나 옮기거나 덮어쓰는 명령 */
    /\b(rm|mv|cp|tee|truncate|chmod|chown|ln|install|patch|dd|shred)\b/,

    /* 제자리 편집 옵션. `-i` 가 붙어야 파일을 바꾼다 */
    /\bsed\b[^|;]*\s-\w*i/,
    /\bperl\b[^|;]*\s-\w*i/,
    /\bawk\b[^|;]*\s-i\s*inplace/,

    /* 작업 트리를 되돌리는 git 명령 */
    /\bgit\s+(checkout|restore|apply|am|rm|mv)\b/,

    /* 인터프리터로 쓰기.
       앞의 갈래들과 달리 `[^|;]*` 로 좁히지 않는다. 스크립트 안에는
       세미콜론과 `||` 가 흔해서, 좁히면 `const fs = require('fs');
       fs.writeFileSync(...)` 같은 평범한 한 줄이 그냥 빠져나간다 */
    /\b(node|python3?|ruby)\b[\s\S]*\b(writeFileSync|appendFileSync|createWriteStream|copyFileSync|renameSync|unlinkSync|rmSync|mkdirSync|writeFile|write_text|write_bytes)\b/,

    /* 파이썬 `open()` 은 읽기도 쓰기도 한다. 모드 문자로 가른다.
       `open(p)` 와 `open(p, 'r')` 은 통과, `'w'` `'a'` `'x'` 는 막는다 */
    /\bpython3?\b[\s\S]*\bopen\s*\([^)]*['"][wax]/,

    /* 모듈째 쓰는 경우 */
    /\bpython3?\b[\s\S]*\b(shutil|os\.remove|os\.rename|os\.replace)\b/,
  ]
    .map((r) => r.source)
    .join('|'),
)

const isProtected = (p) => PROTECTED.some((re) => re.test(p))

function reason(cmd) {
  // ① 리다이렉션 대상이 보호 경로인가. '>' '>>' '>|' '2>' 를 모두 본다.
  for (const m of cmd.matchAll(/\d?>>?\|?\s*['"]?([^\s'"|;&()<>]+)/g)) {
    if (isProtected(m[1])) return `리다이렉션 대상이 보호 경로입니다: ${m[1]}`
  }
  // ② 파일을 바꾸는 명령과 보호 경로가 같이 나오는가.
  if (MUTATORS.test(cmd)) {
    const hit = PROTECTED.find((re) => re.test(cmd))
    if (hit) return `보호 경로를 바꾸는 명령으로 보입니다: ${cmd.match(hit)[0].trim()}`
  }
  return null
}

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  let input
  try {
    input = JSON.parse(raw)
  } catch {
    process.exit(0) // 입력을 못 읽으면 막지 않는다. 훅 때문에 작업이 멈추면 안 된다.
  }

  if (input.tool_name !== 'Bash') process.exit(0)
  const cmd = input.tool_input?.command
  if (typeof cmd !== 'string') process.exit(0)

  const why = reason(cmd)
  if (!why) process.exit(0)

  process.stderr.write(
    `${why}\n\n` +
      '이 파일들은 백엔드 저장소가 정본이고 여기는 사본입니다. 여기서 고치면 ' +
      '두 저장소가 다르게 동작합니다.\n' +
      '고쳐야 하면 무엇이 왜 필요한지 적어 담당자에게 넘기세요 ' +
      '(docs/HARNESS.md 「사본이 갈라진다」).\n' +
      '읽기는 막지 않습니다.\n'
  )
  process.exit(2)
})
