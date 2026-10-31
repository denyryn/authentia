import {useState, type FormEvent} from 'react'

import {Dialog} from '@/components/ui/dialog'
import type {Env} from '@/lib/env'

import {DangerButton, describe, Field, QuietButton, Section} from '../fields'

export function DangerSection({
  env,
  onReset,
  title = 'Danger zone',
  chip = 'Permanent',
  description = 'Removes the vault, its settings and the session key from this browser. A backup file kept somewhere else is the only thing that survives.',
  confirmHint = 'This removes every account, the passcode and the auto-lock setting.',
  action = 'Delete all data',
  confirmTitle = 'Delete all data?',
  confirmDescription = 'Every account, the passcode and the auto-lock setting are removed from this browser. This cannot be undone.'
}: {
  env: Env
  onReset(): void
  title?: string
  chip?: string
  description?: string
  confirmHint?: string
  action?: string
  confirmTitle?: string
  confirmDescription?: string
}) {
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const match = word.trim().toLowerCase() === 'delete'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!match || busy) return

    setBusy(true)
    setError(null)
    try {
      await env.local.remove('vault')
      await env.local.remove('settings')
      await env.session.remove('session')
      setOpen(false)
      onReset()
    } catch (failure) {
      setError(describe(failure, 'Some data could not be deleted. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    if (busy) return
    setOpen(false)
    setWord('')
    setError(null)
  }

  return (
    <Section title={title} chip={chip} tone="alert" description={description}>
      <DangerButton
        type="button"
        onClick={() => {
          setWord('')
          setError(null)
          setOpen(true)
        }}
      >
        {action}
      </DangerButton>

      <Dialog
        open={open}
        onClose={close}
        title={confirmTitle}
        description={confirmDescription}
        footer={
          <>
            <QuietButton type="button" onClick={close} disabled={busy}>
              Cancel
            </QuietButton>
            <DangerButton
              type="submit"
              form="delete-all-form"
              disabled={!match || busy}
            >
              {busy ? 'Deleting…' : action}
            </DangerButton>
          </>
        }
      >
        <form id="delete-all-form" onSubmit={submit} className="flex flex-col">
          <Field
            label={
              <>
                Type <code className="font-mono">delete</code> to confirm
              </>
            }
            value={word}
            onChange={(value) => {
              setWord(value)
              setError(null)
            }}
            autoComplete="off"
            spellCheck={false}
            hint={confirmHint}
            error={
              word && !match ? 'Type the word exactly to continue.' : undefined
            }
            disabled={busy}
          />
          {error ? (
            <p className="dialog-text mt-(--space-xs) text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </Section>
  )
}
