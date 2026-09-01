/**
 * 입력 계열. 이 앱은 읽기 전용으로 시작해서 폼이 하나도 없었다.
 *
 * 라벨·에러·글자수를 매번 따로 쓰면 화면마다 모양이 갈린다.
 * 껍데기(Field)가 그 셋을 맡고, 안에 들어가는 것만 바꾼다.
 */
import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'

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
  /** 에러 문구. 있으면 통째로 에러 모양이 된다 */
  error?: string
  /** 에러가 없을 때 보여줄 안내. 에러와 같이 있으면 에러만 보인다 */
  hint?: string
  disabled?: boolean
  /** 글자수. [현재, 최대]. 값이 있을 때만 보인다 */
  count?: [number, number]
  children: ReactNode
}

export function Field({ label, required, optional, error, hint, disabled, count, children }: FieldProps) {
  const cls = ['fld', error && 'fld--err', disabled && 'fld--off'].filter(Boolean).join(' ')
  const over = count ? count[0] > count[1] : false
  const msg = error ?? hint
  /* 빈 칸 옆의 0/40 은 알려주는 것이 없다. 세기 시작한 뒤에 나온다 */
  const showCount = count && count[0] > 0

  return (
    <label className={cls}>
      {label && (
        <span className="fld__label">
          {label}
          {required && <span className="fld__req" aria-hidden>*</span>}
          {optional && <span className="fld__opt">선택</span>}
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

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="fld__box">
      <input className="fld__input" {...props} />
    </span>
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
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
