/**
 * 팀 공용 파일을 Bash 경유로 고치는 것을 막는다.
 *
 * permissions.deny 의 Edit() 규칙은 Edit 도구만 본다. 공식 문서가 명시한다.
 * 그래서 `sed -i`, `cat > 파일`, `git checkout` 은 그 규칙에 안 걸린다.
 * 이 훅이 그 문을 닫는다.
 *
 * 완전하지 않다. 쓰기를 표현하는 방법은 무한하고 여기 적힌 패턴은 유한하다.
 * 로컬 방어는 실수를 잡는 것이고, 진짜 보장은 원격의 CODEOWNERS 와
 * 브랜치 보호다. docs/harness/frontend.md 의 "손대면 안 되는 곳" 참고.
 */
const PROTECTED = [
  '.githooks/',
  '.github/scripts/',
  '.github/PULL_REQUEST_TEMPLATE.md',
]
const PROTECTED_RE = [/\.github\/workflows\/jira-[\w-]*\.ya?ml/]

/* 쓰기를 뜻하는 표현들. 읽기만 하는 명령은 통과시킨다 */
const WRITES = /(^|[\s;&|])(rm|mv|cp|tee|truncate|install|dd|chmod|touch)\s|>>?\s*\S|sed\s+(-\S*\s+)*-i|perl\s+(-\S*\s+)*-i|git\s+(checkout|restore|rm|mv|apply|clean)|(node|python3?|ruby)\s+-[ec]/

let raw = ''
for await (const chunk of process.stdin) raw += chunk

let cmd = ''
try {
  cmd = JSON.parse(raw)?.tool_input?.command ?? ''
} catch {
  process.exit(0)            /* 못 읽으면 통과. 훅이 작업을 막아서는 안 된다 */
}

const hit =
  PROTECTED.find((p) => cmd.includes(p)) ??
  PROTECTED_RE.find((re) => re.test(cmd))?.source

if (!hit || !WRITES.test(cmd)) process.exit(0)

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      `팀 공용 파일이다. 프론트에서 고치지 않는다: ${hit}\n` +
      `필요하면 무엇이 왜 필요한지 적어 담당자에게 넘긴다. ` +
      `근거는 docs/harness/frontend.md.`,
  },
}))
process.exit(2)
