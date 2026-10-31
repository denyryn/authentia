import {useState} from 'react'

import {PasscodeInput} from '@/components/passcode-input'
import type {Env} from '@/lib/env'
import type {UnlockResult} from '@/lib/vault'

type PasscodeGateProps = {
  env: Env
  now: number
  onUnlock(passcode: string): Promise<UnlockResult>
  onForgot?(): void
}

type GateError = {message: string; until?: number}

export function PasscodeGate({
  env,
  now,
  onUnlock,
  onForgot
}: PasscodeGateProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<GateError | null>(null)
  const [busy, setBusy] = useState(false)

  const remaining = error?.until
    ? Math.max(0, Math.ceil((error.until - now) / 1000))
    : 0
  const blocked = remaining > 0

  const submit = async (passcode: string) => {
    if (busy || blocked || passcode.length !== 6) return

    setBusy(true)
    const result = await onUnlock(passcode)
    setBusy(false)

    if (result.ok) return

    setValue('')
    setError({
      message: result.error,
      until: result.retryAfterMs ? env.now() + result.retryAfterMs : undefined
    })
  }

  const message = busy
    ? 'Checking…'
    : error
      ? blocked
        ? `Try again in ${remaining}s.`
        : error.message
      : ''

  return (
    <div className="gate">
      <div className="gate-head">
        <h2>Enter your passcode</h2>
        <p>Enter the six-digit passcode you set for this browser.</p>
      </div>

      <form
        className="gate-form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit(value)
        }}
      >
        <PasscodeInput
          value={value}
          onChange={(next) => {
            setValue(next)
            setError(null)
          }}
          onComplete={(complete) => {
            void submit(complete)
          }}
          invalid={Boolean(error) && !blocked}
          disabled={busy || blocked}
        />

        <p className={busy ? 'gate-line gate-line-quiet' : 'gate-line'} aria-live="polite">
          {message}
        </p>

        {onForgot && (
          <button type="button" onClick={onForgot} className="text-link">
            Forgot passcode?
          </button>
        )}

        <button type="submit" className="sr-only">
          Open codes
        </button>
      </form>
    </div>
  )
}
