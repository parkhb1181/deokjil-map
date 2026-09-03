#!/usr/bin/env node
/**
 * guard-shared.mjs 시험.
 *
 * 훅은 실패해도 아무 일이 일어나지 않는다. 그냥 통과시킨다. 그래서 패턴이
 * 깨져도 알 방법이 없어 시험을 붙여둔다. 실제로 처음 짰을 때 막아야 할 7개
 * 중 4개가 그냥 통과했다 — 경로 정규식 앵커를 `(^|/)` 로 잡아서 명령 중간에
 * 공백 뒤로 오는 경로가 안 걸렸다.
 *
 *   node .claude/hooks/guard-shared.test.mjs
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'guard-shared.mjs')

const BLOCK = [
  'sed -i "s/x/y/" .githooks/prepare-commit-msg',
  'cat > .github/scripts/jira.sh',
  'echo x >> .githooks/prepare-commit-msg',
  'git checkout main -- .github/workflows/jira-dispatch.yml',
  'rm .github/PULL_REQUEST_TEMPLATE.md',
  'cp /tmp/x .github/scripts/pr_body.py',
  'tee .githooks/prepare-commit-msg < /tmp/x',
  /* 인터프리터로 쓰기. `sed` 가 못 다루는 것(여러 줄 JSX·한글·따옴표)을
     이렇게 고치는 일이 잦아서, 여기가 뚫려 있으면 제일 자주 새는 구멍이
     된다. 실제로 처음에는 아래 셋이 전부 그냥 통과했다 */
  `node -e "require('fs').writeFileSync('.githooks/prepare-commit-msg','x')"`,
  `node -e "const fs = require('fs'); fs.writeFileSync('.github/scripts/jira.sh','x')"`,
  `python -c "open('.github/PULL_REQUEST_TEMPLATE.md','w').write('x')"`,
  'awk -i inplace "1" .githooks/prepare-commit-msg',
  /* 힙독으로 넘기는 것도 같은 일이다. 줄바꿈이 끼어 있어도 걸려야 한다 */
  "node - <<'EOF'\nimport fs from 'node:fs'\nfs.writeFileSync('.githooks/prepare-commit-msg', 'x')\nEOF",
]

const PASS = [
  // 읽기는 막지 않는다
  'cat .githooks/prepare-commit-msg',
  'grep -n jira .github/scripts/jira.sh',
  'git diff .github/workflows/jira-pr-sync.yml',
  'cat .github/PULL_REQUEST_TEMPLATE.md > /dev/null',
  /* 인터프리터로 **읽는** 것은 통과해야 한다. 이름만 보고 막으면 여기가
     같이 막히고, 그러면 백엔드 원본이 어떻게 생겼는지 볼 방법이 없어져
     규칙을 지키기가 오히려 어려워진다 */
  `node -e "console.log(require('fs').readFileSync('.githooks/prepare-commit-msg','utf8'))"`,
  `python -c "print(open('.github/scripts/jira.sh').read())"`,
  `python -c "print(open('.github/scripts/jira.sh', 'r').read())"`,
  'git show HEAD:.githooks/prepare-commit-msg | node -e "process.stdin.pipe(process.stdout)"',
  // refresh-data.yml 은 우리 것이라 보호 대상이 아니다
  'cat .github/workflows/refresh-data.yml',
  // 보호 경로가 아니면 무엇을 하든 통과한다
  'npm run build',
  'sed -i "s/x/y/" src/app/page.tsx',
  'rm -rf .next',
  'rm -rf node_modules/.cache',
  /* 보호 대상이 아닌 파일은 인터프리터로 마음껏 고친다. 이게 막히면
     평소 작업이 통째로 멈춘다 */
  `node -e "require('fs').writeFileSync('src/app/page.tsx','x')"`,
  "node - <<'EOF'\nimport fs from 'node:fs'\nfs.writeFileSync('src/lib/poster.ts', 'x')\nEOF",
  'node scripts/og-shots.mjs',
]

const run = (command) =>
  spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  }).status

let failed = 0
for (const [want, list] of [[2, BLOCK], [0, PASS]]) {
  for (const cmd of list) {
    const got = run(cmd)
    const ok = got === want
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${want === 2 ? '차단' : '통과'}  ${cmd}`)
  }
}

// Bash 가 아닌 도구는 훅이 손대지 않는다
const other = spawnSync(process.execPath, [HOOK], {
  input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '.githooks/x' } }),
  encoding: 'utf8',
}).status
if (other !== 0) { failed++; console.log('FAIL  통과  (Bash 아닌 도구)') }
else console.log('ok    통과  (Bash 아닌 도구)')

console.log(failed ? `\n${failed}건 실패` : `\n${BLOCK.length + PASS.length + 1}건 전부 통과`)
process.exit(failed ? 1 : 0)
