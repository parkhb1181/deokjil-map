/**
 * 입력 계열. 이 앱은 읽기 전용으로 시작해서 폼이 하나도 없었다.
 *
 * 라벨·에러·글자수를 매번 따로 쓰면 화면마다 모양이 갈린다.
 * 껍데기(Field)가 그 셋을 맡고, 안에 들어가는 것만 바꾼다.
 */
import type {
  ReactNode,
  ComponentPropsWithRef,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from 'react'

type FieldProps = {
  label?: string
  /**
   * 라벨 옆에 `*` 를 붙인다.
   *
   * **한 폼 안에서 이것과 `optional` 을 섞지 않는다.** 당근 SEED 의
   * 규칙이다. 한 화면에서 필드의 2/3 이상이 필수면 선택인 것에만
   * '선택' 을 달고, 그렇지 않으면 필수인 것에만 `*` 를 단다.
   *
   * 다섯 칸이 전부 필수인 폼에 별표를 다섯 개 달면 아무것도
   * 구분해주지 못하고 노이즈만 된다.
   */
  required?: boolean
  /** 라벨 옆에 '선택' 을 붙인다. required 와 같은 폼에서 섞지 않는다 */
  optional?: boolean
  /**
   * 라벨 오른쪽에 붙는 보조 동작. 중복 확인처럼 그 칸에서만 쓰는
   * 버튼을 둔다 (SEED 의 Suffix Slot).
   *
   * 입력칸 오른쪽이 아니라 라벨 옆인 이유가 있다. 입력칸 안에 넣으면
   * 글자가 길어질 때 버튼에 가려지고, 옆에 붙이면 칸이 좁아진다.
   * 라벨 줄은 어차피 비어 있다.
   */
  suffix?: ReactNode
  /** 에러 문구. 있으면 통째로 에러 모양이 된다 */
  error?: string
  /** 에러가 없을 때 보여줄 안내. 에러와 같이 있으면 에러만 보인다 */
  hint?: string
  disabled?: boolean
  /** 글자수. [현재, 최대]. 값이 있을 때만 보인다 */
  count?: [number, number]
  children: ReactNode
}

export function Field({ label, required, optional, suffix, error, hint, disabled, count, children }: FieldProps) {
  const cls = ['fld', error && 'fld--err', disabled && 'fld--off'].filter(Boolean).join(' ')
  const over = count ? count[0] > count[1] : false
  const msg = error ?? hint
  /* 빈 칸 옆의 0/40 은 알려주는 것이 없다. 세기 시작한 뒤에 나온다 */
  const showCount = count && count[0] > 0

  return (
    <label className={cls}>
      {(label || suffix) && (
        <span className="fld__label">
          {label}
          {required && <span className="fld__req" aria-hidden>*</span>}
          {optional && <span className="fld__opt">선택</span>}
          {suffix && <span className="fld__suffix">{suffix}</span>}
        </span>
      )}
      {children}
      {(msg || showCount) && (
        <span className="fld__foot">
          {msg && <span className="fld__msg">{msg}</span>}
          {showCount && (
            <span className={`fld__count${over ? ' fld__count--over' : ''}`}>
              {count![0]}/{count![1]}
            </span>
          )}
        </span>
      )}
    </label>
  )
}

export function TextInput({ after, ...rest }: InputHTMLAttributes<HTMLInputElement> & {
  /**
   * 입력칸 오른쪽에 붙는 것. 중복 확인처럼 **입력한 값에 대고 바로
   * 누르는** 버튼을 둔다.
   *
   * 라벨 옆(Field 의 suffix)과 다른 자리다. 거기는 그 칸과 상관없이
   * 늘 있는 보조 동작이고, 여기는 지금 친 값을 두고 하는 동작이다.
   * 눈이 값에서 버튼으로 바로 넘어간다.
   */
  after?: ReactNode
}) {
  return (
    <span className={`fld__box${after ? ' fld__box--after' : ''}`}>
      <input className="fld__input" {...rest} />
      {after && <span className="fld__after">{after}</span>}
    </span>
  )
}

/* 부르는 쪽이 ref 를 넘길 수 있어야 한다. 모집글 상세의 답글이
   맨 아래 입력칸 하나를 빌려 쓰면서 거기에 초점을 옮겨야 한다.
   React 19 부터 ref 가 보통 prop 이라 forwardRef 없이 넘어간다 */
export function TextArea(props: ComponentPropsWithRef<'textarea'>) {
  return (
    <span className="fld__box">
      <textarea className="fld__area" {...props} />
    </span>
  )
}

export function Select({ children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="fld__box fld__box--select">
      <select className="fld__select" {...rest}>
        {children}
      </select>
    </span>
  )
}

/**
 * 기본 체크박스는 색을 못 바꾼다. 진짜 input 은 숨겨두고
 * 옆의 네모를 그린다. 키보드 초점은 숨긴 input 이 그대로 받는다.
 */
export function Checkbox({
  label,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="chk">
      <input type="checkbox" {...rest} />
      <span className="chk__box" aria-hidden />
      <span className="chk__text">{label}</span>
    </label>
  )
}

/**
 * 고르는 칸을 칩으로.
 *
 * 선택지가 서넛이면 드롭다운보다 칩이 낫다. 드롭다운은 누르고,
 * 목록에서 찾고, 고르는 세 동작인데 칩은 한 번이다. 무엇을 고를 수
 * 있는지도 열어보기 전에 보인다.
 *
 * 당근도 거래 방식(판매하기·나눔하기)을 드롭다운이 아니라 칩으로 둔다.
 * 선택지가 열을 넘어가면 그때 드롭다운으로 바꾼다.
 */
export function ChoiceChips<T extends string | number>({ value, options, onPick }: {
  value: T | ''
  options: { value: T; label: string }[]
  onPick: (v: T) => void
}) {
  return (
    <span className="chips2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`chip2${value === o.value ? ' chip2--on' : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onPick(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}
