import {
  useEffect,
  useId,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent
} from 'react'

import {cn} from '@/lib/utils'

type PasscodeInputProps = {
  value: string
  onChange(value: string): void
  onComplete?(value: string): void
  invalid?: boolean
  disabled?: boolean
}

const LENGTH = 6

export function PasscodeInput({
  value,
  onChange,
  onComplete,
  invalid = false,
  disabled = false
}: PasscodeInputProps) {
  const labelId = useId()
  const boxes = useRef<Array<HTMLInputElement | null>>([])

  const cells = () => Array.from({length: LENGTH}, (_, index) => value[index] ?? '')
  const focusBox = (index: number) => boxes.current[index]?.focus()

  // A failed attempt clears the value while the boxes are disabled, which drops
  // focus to the page; bring it back to the start for a keyboard retry.
  useEffect(() => {
    if (!disabled && value.length === 0) boxes.current[0]?.focus()
  }, [disabled, value.length])

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    // Entry is sequential: a click on a later box appends at the end instead of
    // leaving a gap the compact string value cannot represent.
    const slot = Math.min(index, value.length)
    const next = cells()
    next[slot] = digit
    const nextValue = next.join('')

    onChange(nextValue)
    if (digit && slot < LENGTH - 1) focusBox(slot + 1)
    if (nextValue.length === LENGTH) onComplete?.(nextValue)
  }

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (disabled) return

      const next = cells()
      if (next[index]) {
        next[index] = ''
      } else if (index > 0) {
        next[index - 1] = ''
        focusBox(index - 1)
      }
      onChange(next.join(''))
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (index > 0) focusBox(index - 1)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (index < LENGTH - 1) focusBox(index + 1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (!disabled && value.length === LENGTH) onComplete?.(value)
    }
  }

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    if (disabled) return

    const pasted = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!pasted) return

    const next = cells()

    if (pasted.length >= LENGTH) {
      for (let cursor = 0; cursor < LENGTH; cursor += 1) {
        next[cursor] = pasted[cursor]
      }
      const nextValue = next.join('')
      onChange(nextValue)
      focusBox(LENGTH - 1)
      onComplete?.(nextValue)
      return
    }

    let cursor = Math.min(index, value.length)
    for (const char of pasted) {
      if (cursor >= LENGTH) break
      next[cursor] = char
      cursor += 1
    }

    const nextValue = next.join('')
    onChange(nextValue)
    focusBox(Math.min(cursor, LENGTH - 1))
    if (nextValue.length === LENGTH) onComplete?.(nextValue)
  }

  return (
    <div className="passcode-boxes" role="group" aria-labelledby={labelId}>
      <label id={labelId} className="sr-only">
        Passcode
      </label>
      {Array.from({length: LENGTH}, (_, index) => (
        <span className="passcode-cell" key={index}>
          <input
            ref={(element) => {
              boxes.current[index] = element
            }}
            value={value[index] ?? ''}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={(event) => event.currentTarget.select()}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoFocus={index === 0}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={`Passcode digit ${index + 1} of ${LENGTH}`}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn('passcode-box', invalid && 'animate-shake')}
          />
        </span>
      ))}
    </div>
  )
}
