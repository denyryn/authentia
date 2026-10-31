import {Check, Copy, Pencil} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'

import {groupCode} from '@/components/code'
import {CountdownRule} from '@/components/countdown-rule'
import {Button} from '@/components/ui/button'
import type {Env} from '@/lib/env'
import {currentStep, generate, stepRemainingMs} from '@/lib/totp'
import type {Account} from '@/lib/vault'

type AccountRowProps = {
  account: Account
  now: number
  env: Env
  onEdit(account: Account): void
}

const accountLabel = (account: Account) =>
  account.issuer.trim() || account.account.trim() || 'this account'

export function AccountRow({account, now, env, onEdit}: AccountRowProps) {
  const [code, setCode] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const label = accountLabel(account)
  const step = currentStep(now, account.period)
  const remainingMs = stepRemainingMs(now, account.period)
  const seconds = Math.ceil(remainingMs / 1000)

  useEffect(() => {
    let alive = true

    generate(
      account.secret,
      {
        algorithm: account.algorithm,
        digits: account.digits,
        period: account.period
      },
      now
    ).then(
      (next) => {
        if (!alive) return
        setCode(next)
        setFailed(false)
      },
      () => {
        if (!alive) return
        setCode(null)
        setFailed(true)
      }
    )

    return () => {
      alive = false
    }
    // `now` is read only when the step changes, not on every tick.
  }, [account.secret, account.algorithm, account.digits, account.period, step])

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    },
    []
  )

  const copy = async () => {
    if (!code) return

    try {
      await env.copy(code)
      setCopyError(null)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
      setCopyError('Could not copy. Try again.')
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopyError(null), 2400)
    }
  }

  const copyLabel = code
    ? `Copy ${label} code ${groupCode(code)}, ${seconds} seconds left`
    : failed
      ? `Copy ${label} code, unavailable`
      : `Copy ${label} code, loading`

  return (
    <li className="account-row">
      <div className="account-row-main">
        <button
          type="button"
          className="copy-target"
          onClick={copy}
          disabled={!code}
          aria-label={copyLabel}
        >
          <span className="identity">
            <span className="issuer">{account.issuer || 'Account'}</span>
            <span className="identity-sub">
              {copied ? (
                <span className="copy-chip">
                  <Check aria-hidden="true" />
                  Copied
                </span>
              ) : copyError ? (
                <span className="copy-error">{copyError}</span>
              ) : (
                <>
                  <span className="account-name">{account.account}</span>
                  <span className="copy-hint" aria-hidden="true">
                    <Copy />
                    Copy code
                  </span>
                </>
              )}
            </span>
          </span>

          <span className="code-column">
            {failed ? (
              <span className="code-failed">No code</span>
            ) : code ? (
              <>
                <span className="code-value">{groupCode(code)}</span>
                <CountdownRule
                  key={step}
                  remainingMs={remainingMs}
                  periodMs={account.period * 1000}
                />
              </>
            ) : (
              <span
                className="code-loading animate-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
          </span>
        </button>

        <div className="row-actions">
          <Button
            variant="ghost"
            size="icon"
            className="row-action"
            aria-label={`Edit ${label}`}
            onClick={() => onEdit(account)}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>

      {copied && (
        <span className="sr-only" role="status">
          Code copied
        </span>
      )}
      {copyError && (
        <span className="sr-only" role="status">
          {copyError}
        </span>
      )}
    </li>
  )
}
