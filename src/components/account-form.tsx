import {useEffect, useMemo, useRef, useState, type FormEvent} from 'react'

import {groupCode} from '@/components/code'
import {CountdownRule} from '@/components/countdown-rule'
import {Button} from '@/components/ui/button'
import {Dialog} from '@/components/ui/dialog'
import {decodeBase32} from '@/lib/base32'
import type {Env} from '@/lib/env'
import {parseOtpAuth, type OtpAuthAccount} from '@/lib/otpauth'
import {currentStep, generate, stepRemainingMs} from '@/lib/totp'
import type {Account} from '@/lib/vault'

type AccountFormProps = {
  env: Env
  now: number
  existing?: Account
  others: Account[]
  error?: string | null
  onSave(account: Account): Promise<boolean>
  onDelete?(): Promise<boolean>
  onCancel(): void
}

type Preview = Pick<OtpAuthAccount, 'secret' | 'algorithm' | 'digits' | 'period'>
type Credentials = {credentials?: OtpAuthAccount; setupError?: string; accountError?: string}

const describe = (error: unknown) =>
  error instanceof Error && error.message ? error.message : 'That value is not valid'

function secretProblem(secret: string) {
  if (!secret.trim()) return 'Paste a setup link or type the setup key.'
  try {
    decodeBase32(secret)
    return null
  } catch (error) {
    return describe(error)
  }
}

export function AccountForm({
  env,
  now,
  existing,
  others,
  error,
  onSave,
  onDelete,
  onCancel
}: AccountFormProps) {
  const [input, setInput] = useState(existing?.secret ?? '')
  const [issuer, setIssuer] = useState(existing?.issuer ?? '')
  const [account, setAccount] = useState(existing?.account ?? '')
  const [parsed, setParsed] = useState<OtpAuthAccount | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [inputTouched, setInputTouched] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<Account | null>(null)
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const setupRef = useRef<HTMLInputElement>(null)
  const accountRef = useRef<HTMLInputElement>(null)

  const defaults = {
    algorithm: existing?.algorithm ?? 'SHA1',
    digits: existing?.digits ?? 6,
    period: existing?.period ?? 30
  } as const

  const raw = input.trim()
  const isLink = /^otpauth/i.test(raw)

  useEffect(() => {
    if (!isLink) {
      setParsed(null)
      setParseError(null)
      return
    }

    const id = setTimeout(() => {
      try {
        const next = parseOtpAuth(raw)
        setParsed(next)
        setParseError(null)
        if (next.issuer) setIssuer(next.issuer)
        if (next.account) setAccount(next.account)
      } catch (failure) {
        setParsed(null)
        setParseError(describe(failure))
      }
    }, 250)

    return () => clearTimeout(id)
  }, [isLink, raw])

  const preview = useMemo<Preview | null>(() => {
    if (!raw) return null
    if (isLink) {
      return parsed
        ? {
            secret: parsed.secret,
            algorithm: parsed.algorithm,
            digits: parsed.digits,
            period: parsed.period
          }
        : null
    }

    return {
      secret: raw,
      algorithm: defaults.algorithm,
      digits: defaults.digits,
      period: defaults.period
    }
  }, [raw, isLink, parsed, defaults.algorithm, defaults.digits, defaults.period])

  const step = currentStep(now, preview?.period ?? 30)

  useEffect(() => {
    let alive = true
    setPreviewCode(null)
    setPreviewFailed(false)
    if (!preview) return

    const id = setTimeout(() => {
      generate(
        preview.secret,
        {
          algorithm: preview.algorithm,
          digits: preview.digits,
          period: preview.period
        },
        now
      ).then(
        (code) => {
          if (alive) setPreviewCode(code)
        },
        () => {
          if (alive) {
            setPreviewCode(null)
            setPreviewFailed(true)
          }
        }
      )
    }, 180)

    return () => {
      alive = false
      clearTimeout(id)
    }
    // `now` is read only when the step changes, not on every tick.
  }, [preview, step])

  const setupMessage = setupError ?? (inputTouched ? parseError : null)
  const clearDuplicate = () => setDuplicate(null)

  const readCredentials = (): Credentials => {
    if (!raw) return {setupError: 'Paste a setup link or type the setup key.'}

    if (isLink) {
      try {
        const link = parseOtpAuth(raw)
        const name = account.trim() || link.account
        if (!name) return {accountError: 'Add the account name.'}
        return {
          credentials: {
            ...link,
            issuer: issuer.trim() || link.issuer,
            account: name
          }
        }
      } catch (failure) {
        return {setupError: describe(failure)}
      }
    }

    const problem = secretProblem(raw)
    if (problem) return {setupError: problem}
    if (!account.trim()) return {accountError: 'Add the account name.'}

    return {
      credentials: {
        issuer: issuer.trim(),
        account: account.trim(),
        secret: raw.replace(/\s/g, ''),
        algorithm: defaults.algorithm,
        digits: defaults.digits,
        period: defaults.period
      }
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    setInputTouched(true)
    const result = readCredentials()
    setSetupError(result.setupError ?? null)
    setAccountError(result.accountError ?? null)

    if (!result.credentials) {
      setDuplicate(null)
      ;(result.setupError ? setupRef : accountRef).current?.focus()
      return
    }

    const match = others.find(
      (item) =>
        item.id !== existing?.id &&
        item.account.trim().toLowerCase() ===
          result.credentials!.account.trim().toLowerCase() &&
        item.issuer.trim().toLowerCase() ===
          result.credentials!.issuer.trim().toLowerCase()
    )

    if (match && !duplicate) {
      setDuplicate(match)
      return
    }

    setDuplicate(null)
    const next: Account = {
      id: existing?.id ?? crypto.randomUUID(),
      createdAt: existing?.createdAt ?? env.now(),
      ...result.credentials
    }

    setSaving(true)
    const ok = await onSave(next)
    if (!ok) setSaving(false)
  }

  const remove = async () => {
    if (!onDelete || deleting) return
    setDeleting(true)
    const removed = await onDelete()
    if (!removed) setDeleting(false)
  }

  const saveLabel = duplicate
    ? 'Save anyway'
    : existing
      ? 'Save changes'
      : 'Add account'

  return (
    <section className="entry-screen" aria-labelledby="entry-title">
      <div className="entry-head">
        <h2 id="entry-title">{existing ? 'Edit account' : 'Add account'}</h2>
        <p>
          {existing
            ? 'Adjust the name, or replace the setup key.'
            : 'Paste a setup link, or type the key it contains.'}
        </p>
      </div>

      <form
        className="entry-form"
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || saving) return
          event.stopPropagation()
          onCancel()
        }}
      >
        <div className="field-group">
          <label htmlFor="account-setup" className="field-label">
            Setup link or key
          </label>
          <input
            ref={setupRef}
            id="account-setup"
            name="setup"
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              setSetupError(null)
              clearDuplicate()
            }}
            onBlur={() => setInputTouched(true)}
            aria-invalid={Boolean(setupMessage) || undefined}
            aria-describedby="account-setup-line"
            aria-required="true"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            disabled={saving}
            className="field font-mono"
            placeholder="otpauth://… or JBSWY3DPEHPK3PXP"
          />
          <p id="account-setup-line" className="field-line">
            {setupMessage ? (
              <span className="field-error">{setupMessage}</span>
            ) : (
              <span>
                {existing
                  ? 'The key saved with this account.'
                  : 'A link fills in the issuer and account.'}
              </span>
            )}
          </p>
        </div>

        <div className="field-group">
          <label htmlFor="account-issuer" className="field-label">
            Issuer <span className="field-optional">(optional)</span>
          </label>
          <input
            id="account-issuer"
            name="issuer"
            value={issuer}
            onChange={(event) => {
              setIssuer(event.target.value)
              clearDuplicate()
            }}
            disabled={saving}
            className="field"
            placeholder="GitHub"
          />
        </div>

        <div className="field-group">
          <label htmlFor="account-name" className="field-label">
            Account name
          </label>
          <input
            id="account-name"
            name="account"
            value={account}
            onChange={(event) => {
              setAccount(event.target.value)
              setAccountError(null)
              clearDuplicate()
            }}
            aria-invalid={Boolean(accountError) || undefined}
            aria-describedby="account-name-line"
            aria-required="true"
            autoComplete="off"
            spellCheck={false}
            disabled={saving}
            className="field"
            placeholder="you@example.com"
          />
          <p id="account-name-line" className="field-line">
            {accountError && <span className="field-error">{accountError}</span>}
          </p>
          {duplicate && (
            <p className="field-warning" role="status">
              {duplicate.issuer || 'This service'} and {duplicate.account} are
              already saved. {saveLabel} to keep both.
            </p>
          )}
        </div>

        <div className="preview-well">
          <div className="preview-head">
            <span>Preview</span>
            {preview && (
              <span>
                {preview.digits} digits, {preview.period} seconds
              </span>
            )}
          </div>
          {previewCode && preview ? (
            <span className="preview-code">
              <span className="code-value">{groupCode(previewCode)}</span>
              <CountdownRule
                key={step}
                remainingMs={stepRemainingMs(now, preview.period)}
                periodMs={preview.period * 1000}
              />
            </span>
          ) : (
            <span className="preview-placeholder">
              {previewFailed
                ? 'This key cannot make a code. Check the setup key and try again.'
                : preview
                  ? 'Working out the code…'
                  : 'Your code will appear here.'}
            </span>
          )}
        </div>

        {error && (
          <p className="entry-error" role="alert">
            {error}
          </p>
        )}

        <div className="entry-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || deleting}>
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </div>
      </form>

      {existing && onDelete && (
        <div className="flex justify-end border-t border-border pt-(--space-sm)">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete account
          </Button>
        </div>
      )}

      <Dialog
        open={confirmingDelete}
        onClose={() => {
          if (!deleting) setConfirmingDelete(false)
        }}
        title={`Delete ${existing?.issuer || existing?.account || 'this account'}?`}
        description="Its codes stop working here. Without the setup key it cannot be restored."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => void remove()}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </>
        }
      />
    </section>
  )
}
