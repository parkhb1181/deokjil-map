import { ApiFailure } from './http'

/**
 * 서버 응답을 화면 타입으로 옮길 때 쓰는 검사기.
 *
 * ─────────────────────────────────────────────────────────
 * **왜 한 곳에 모으나.**
 *
 * 처음에는 행사 매퍼 안에만 있었다. 그때는 API 를 부르는 곳이 행사
 * 하나였고, `/api/v1/users/me` 는 `apiGet<Me>` 로 그냥 캐스팅해서
 * 받았다. **그래서 아무도 못 본 채로 어긋났다** — 서버는 `id` 를
 * 숫자로 주는데 `Viewer.userId` 는 `string | null` 이라, 켜는 순간
 * `viewer.userId === hostId` 가 조용히 false 가 된다. 타입 단언은
 * 런타임에 아무것도 안 하므로 컴파일도 통과하고 에러도 안 난다.
 * 증상은 「방장인데 버튼이 안 보인다」 하나뿐이라 원인을 찾기 어렵다.
 *
 * 경계에서 한 번 정규화하면 그 뒤로는 화면이 안심하고 `===` 로 비교할
 * 수 있다. 그래서 **응답을 받는 모든 자리가 이 검사기를 지난다.**
 *
 * ─────────────────────────────────────────────────────────
 * **식별자는 문자열로 통일한다.**
 *
 * 서버가 숫자로 주는 것이 틀린 게 아니다. API 컨벤션은 식별자의 타입을
 * 정하지 않았고, 행사만 외부 식별자(`pg_8709`)라 문자열인 특수한 경우다.
 * 둘을 화면에서 섞으면 비교가 깨지므로 **받는 쪽에서 넓은 쪽(문자열)로
 * 맞춘다.** 숫자로 되돌릴 일은 없다 — 계산에 쓰지 않고 비교와 주소에만
 * 쓴다.
 */

/**
 * 계약 위반 예외. 던지는 것은 부르는 쪽이다.
 *
 * **`fail` 을 여기서 내보내지 않는 이유가 있다.** 타입스크립트는 「never 를
 * 반환하는 호출」 로 타입을 좁힐 때 그 호출 대상이 *함수 선언이거나 명시적
 * 타입을 단 const* 일 것을 요구하고, **구조분해로 받은 바인딩은 인정하지
 * 않는다.** `const { fail } = guards(...)` 로 받으면
 * `if (!Array.isArray(v)) fail(...)` 다음 줄에서 `v` 가 안 좁혀져 컴파일이
 * 깨진다. 그래서 각 매퍼가 자기 `fail` 을 함수 선언으로 두고 이 함수로
 * 문구만 만든다.
 */
export function contractError(
  subject: string,
  hint: string,
  field: string,
  why: string,
): ApiFailure {
  return new ApiFailure(
    'CONTRACT_MISMATCH',
    `${subject} 응답이 계약과 다릅니다 — ${field}: ${why}. ${hint}`,
    0,
  )
}

/** 값 검사기. `fail` 은 각 매퍼가 따로 둔다 (위 설명) */
export interface Guards {
  str: (v: unknown, field: string) => string
  num: (v: unknown, field: string) => number
  bool: (v: unknown, field: string) => boolean
  strOrNull: (v: unknown, field: string) => string | null
}

/**
 * 도메인마다 다른 문구를 달아 검사기 한 벌을 만든다.
 *
 * **틀리면 조용히 넘기지 않고 던진다.** 빈 값을 채워 넘기면 화면에 회색
 * 카드가 뜨고, 데이터가 없는 건지 모양이 어긋난 건지 알 수가 없다.
 * 빌드가 그 자리에서 멈추고 어느 필드가 어떻게 어긋났는지 말하게 한다.
 *
 * @param subject 사람이 읽을 이름. 「행사」 · 「모집글」
 * @param hint    어느 문서를 보고 맞출지
 */
export function guards(subject: string, hint: string): Guards {
  function fail(field: string, why: string): never {
    throw contractError(subject, hint, field, why)
  }

  /** 식별자와 문자열 칸. **숫자로 와도 문자열로 바꾼다** (위 설명) */
  function str(v: unknown, field: string): string {
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    return fail(field, `문자열이어야 하는데 ${typeof v} 다`)
  }

  function num(v: unknown, field: string): number {
    if (typeof v === 'number') return v
    /* DECIMAL(10,7) 이 문자열로 오는 드라이버가 있다. 좌표는 숫자여야 지도가 쓴다 */
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
    return fail(field, `숫자여야 하는데 ${JSON.stringify(v)} 다`)
  }

  function bool(v: unknown, field: string): boolean {
    if (typeof v === 'boolean') return v
    return fail(field, `불리언이어야 하는데 ${typeof v} 다`)
  }

  /** 있으면 문자열로, 없거나 null 이면 null. 계약이 「null 로 명시」 라고 한 칸 */
  function strOrNull(v: unknown, field: string): string | null {
    if (v === null || v === undefined) return null
    return str(v, field)
  }

  return { str, num, bool, strOrNull }
}
