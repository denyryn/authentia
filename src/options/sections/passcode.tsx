import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent
} from 'react'

import {PasscodeInput} from '@/components/passcode-input'
import {Dialog} from '@/components/ui/dialog'
import type {Env} from '@/lib/env'
import {readSettings, writeSettings} from '@/lib/settings'
import {
  removePasscode,
  setPasscode,
  type Account,
  type OpenVault
} from '@/lib/vault'
import {cn} from '@/lib/utils'

import {
  DangerButton,
  describe,
  FeedbackLine,
  PrimaryButton,
  QuietButton,
  Section,
  controlClass,
  type Feedback
} from '../fields'

type AutoLockStatus = 'idle' | 'saving' | 'saved' | 'error' | 'off'

function PasscodeGroup({
  label,
  value,
  onChange,
  note,
  invalid,
  disabled
}: {
  label: string
  value: string
  onChange(value: string): void
  note?: string
  invalid?: boolean
  disabled?: boolean
}) {
  const id = useId()

  return (
    <div className="flex min-w-0 flex-col gap-(--space-2xs)">
      <p
        id={id}
        className="text-(length:--text-base) font-medium text-foreground"
      >
        {label}
      </p>
      <div role="group" aria-labelledby={id}>
        <PasscodeInput
          value={value}
          onChange={onChange}
          invalid={invalid}
          disabled={disabled}
        />
      </div>
      <p className="min-h-[1lh] text-(length:--text-base) leading-[1.45] text-destructive">
        {note ?? ''}
      </p>
    </div>
  )
}

function AutoLockRow({
  minutes,
  status,
  disabled,
  onChange
}: {
  minutes: number | null
  status: AutoLockStatus
  disabled: boolean
  onChange(minutes: number): void
}) {
  const id = useId()

  const help =
    status === 'off'
      ? 'Set a passcode first; it only applies to an encrypted vault.'
      : status === 'saving'
        ? 'Saving…'
        : status === 'saved'
          ? 'Saved. It applies the next time the passcode is entered.'
          : status === 'error'
            ? 'Auto-lock could not be saved. Try again.'
            : 'It applies the next time the passcode is entered.'

  return (
    <div className="flex flex-col gap-(--space-xs)">
      <div className="flex flex-wrap items-center justify-between gap-(--space-sm)">
        <label
          htmlFor={id}
          className="text-(length:--text-base) font-medium text-foreground"
        >
          Auto-lock after
        </label>
        <select
          id={id}
          value={minutes ?? 15}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className={cn(
            controlClass,
            'h-9 cursor-pointer bg-card px-(--space-xs) pr-(--space-2xs)'
          )}
        >
          {[5, 15, 30, 60].map((option) => (
            <option key={option} value={option}>
              {option} minutes
            </option>
          ))}
        </select>
      </div>
      <p
        aria-live="polite"
        className={cn(
          'min-h-[1lh] text-(length:--text-base) leading-[1.45]',
          status === 'error' ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {help}
      </p>
    </div>
  )
}

export function PasscodeSection({
  env,
  items,
  encrypted,
  onVault
}: {
  env: Env
  items: Account[]
  encrypted: boolean
  onVault(next: OpenVault): void
}) {
  const [code, setCode] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [open, setOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)


  const [autoLock, setAutoLock] = useState<number | null>(null)
  const [autoLockStatus, setAutoLockStatus] =
    useState<AutoLockStatus>('idle')
  const writes = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    let alive = true
    readSettings(env).then(
      (settings) => {
        if (alive) setAutoLock(settings.autoLockMinutes)
      },
      () => {
        if (alive) setAutoLock(15)
      }
    )
    return () => {
      alive = false
    }
  }, [env])

  const saveAutoLock = (minutes: number) => {
    setAutoLock(minutes)
    setAutoLockStatus('saving')
    writes.current = writes.current.then(async () => {
      try {
        await writeSettings(env, {autoLockMinutes: minutes})
        setAutoLockStatus('saved')
      } catch {
        setAutoLockStatus('error')
      }
    })
  }

  const openDialog = () => {
    setCode('')
    setFieldError(null)
    setDialogError(null)
    setFeedback(null)
    setOpen(true)
  }

  const closeDialog = () => {
    if (busy) return
    setOpen(false)
    setCode('')
    setFieldError(null)
    setDialogError(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return

    setFieldError(null)
    setDialogError(null)

    if (code.length !== 6) {
      setFieldError('Enter all six digits.')
      return
    }

    const changing = encrypted
    setBusy(true)

    try {
      onVault(await setPasscode(env, items, code))
      setCode('')
      setOpen(false)
      setFeedback({
        tone: 'ok',
        text: changing
          ? 'Passcode changed. The vault is encrypted with the new one.'
          : 'Passcode set. The vault is encrypted from now on.'
      })
    } catch (failure) {
      setDialogError(
        describe(failure, 'The passcode could not be saved. Try again.')
      )
    } finally {
      setBusy(false)
    }
  }

  const submitRemove = async () => {
    if (busy) return

    setBusy(true)
    setRemoveError(null)
    try {
      onVault(await removePasscode(env, items))
      setRemoveOpen(false)
      setFeedback({
        tone: 'ok',
        text: 'Passcode removed. The vault is no longer encrypted.'
      })
    } catch (failure) {
      setRemoveError(
        describe(failure, 'The passcode could not be removed. Try again.')
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="Passcode"
      chip={encrypted ? 'On' : 'Off'}
      tone={encrypted ? 'on' : 'alert'}
      description={
        encrypted
          ? 'Your six-digit passcode encrypts the vault. It is asked for once, then the vault stays open for the auto-lock window.'
          : 'A six-digit passcode encrypts the vault. Without one, anyone who opens this browser can read your accounts.'
      }
    >
      {encrypted ? (
        <>
          <AutoLockRow
            minutes={autoLock}
            status={autoLockStatus}
            disabled={autoLock === null}
            onChange={saveAutoLock}
          />

          <div className="mt-(--space-lg) border-t border-border pt-(--space-md)">
            <div className="flex flex-wrap gap-(--space-sm)">
              <QuietButton type="button" onClick={openDialog}>
                Change passcode
              </QuietButton>
              <QuietButton
                type="button"
                onClick={() => {
                  setRemoveError(null)
                  setRemoveOpen(true)
                }}
              >
                Remove passcode
              </QuietButton>
            </div>

            <Dialog
              open={removeOpen}
              onClose={() => {
                if (!busy) setRemoveOpen(false)
              }}
              title="Remove the passcode?"
              description="The vault is written back as plain text. Anyone who opens this browser can read every account. A backup file stays encrypted either way."
              footer={
                <>
                  <QuietButton
                    type="button"
                    onClick={() => setRemoveOpen(false)}
                    disabled={busy}
                  >
                    Keep it
                  </QuietButton>
                  <DangerButton
                    type="button"
                    disabled={busy}
                    onClick={() => void submitRemove()}
                  >
                    {busy ? 'Removing…' : 'Remove passcode'}
                  </DangerButton>
                </>
              }
            >
              {removeError ? (
                <p className="dialog-text text-destructive" role="alert">
                  {removeError}
                </p>
              ) : null}
            </Dialog>
          </div>

          <FeedbackLine feedback={feedback} className="mt-(--space-sm)" />

          <p className="mt-(--space-md) max-w-[60ch] text-(length:--text-base) leading-[1.5] text-muted-foreground">
            Five wrong tries pause entry for 30 seconds; ten pause it for 5
            minutes.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-(--space-sm)">
            <PrimaryButton type="button" onClick={openDialog}>
              Set passcode
            </PrimaryButton>
            <p className="max-w-[60ch] text-(length:--text-base) leading-[1.5] text-muted-foreground">
              A backup is the only way back in if you forget the passcode.
            </p>
          </div>
          <FeedbackLine feedback={feedback} className="mt-(--space-sm)" />
          <div className="mt-(--space-lg) border-t border-border pt-(--space-md)">
            <AutoLockRow
              minutes={15}
              status="off"
              disabled
              onChange={() => undefined}
            />
          </div>
        </>
      )}

      <Dialog
        open={open}
        initialFocus="field"
        onClose={closeDialog}
        title={encrypted ? 'Change your passcode' : 'Set a passcode'}
        description="Six digits, entered once. It encrypts the vault on this browser and is asked for again after the auto-lock window."
        footer={
          <>
            <QuietButton type="button" onClick={closeDialog} disabled={busy}>
              Cancel
            </QuietButton>
            <PrimaryButton type="submit" form="passcode-form" disabled={busy}>
              {busy
                ? 'Saving…'
                : encrypted
                  ? 'Update passcode'
                  : 'Set passcode'}
            </PrimaryButton>
          </>
        }
      >
        <form
          id="passcode-form"
          onSubmit={submit}
          className="flex flex-col gap-(--space-xs)"
        >
          <PasscodeGroup
            label="Passcode"
            value={code}
            onChange={(next) => {
              setCode(next)
              setFieldError(null)
            }}
            note={fieldError ?? undefined}
            disabled={busy}
          />
          {dialogError ? (
            <p className="dialog-text text-destructive" role="alert">
              {dialogError}
            </p>
          ) : null}
        </form>
      </Dialog>
    </Section>
  )
}
