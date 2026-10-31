import {useEffect, useRef, useState, type FormEvent} from 'react'

import {Dialog} from '@/components/ui/dialog'
import {Tabs} from '@/components/ui/tabs'
import type {Env} from '@/lib/env'
import {
  createBackup,
  mergeAccounts,
  readBackup
} from '@/lib/backup'
import {saveItems, type Account, type OpenVault} from '@/lib/vault'

import {
  Area,
  DangerButton,
  describe,
  FeedbackLine,
  Field,
  PrimaryButton,
  QuietButton,
  Section,
  Well,
  type Feedback
} from '../fields'

const MIN_PASSPHRASE = 8

const plural = (count: number) => (count === 1 ? 'account' : 'accounts')

const fileStamp = (at: number) => {
  const date = new Date(at)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

export function BackupSection({
  env,
  items,
  open,
  onVault
}: {
  env: Env
  items: Account[]
  open: OpenVault | null
  onVault(next: OpenVault): void
}) {
  const empty = items.length === 0

  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{passphrase?: string; confirm?: string}>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [file, setFile] = useState<{text: string; at: number} | null>(null)
  const [copied, setCopied] = useState(false)

  const [restorePass, setRestorePass] = useState('')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [source, setSource] = useState<'file' | 'paste'>('file')
  const [view, setView] = useState<'create' | 'restore'>('create')
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [pending, setPending] = useState<{
    incoming: Account[]
    existing: number
  } | null>(null)
  const [restoreErrors, setRestoreErrors] = useState<{
    passphrase?: string
    text?: string
  }>({})
  const [importing, setImporting] = useState(false)
  const [restoreFeedback, setRestoreFeedback] = useState<Feedback>(null)

  const fileInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || empty) return

    const next: {passphrase?: string; confirm?: string} = {}
    if (passphrase.length < MIN_PASSPHRASE) {
      next.passphrase = `Use at least ${MIN_PASSPHRASE} characters.`
    }
    if (confirm !== passphrase) {
      next.confirm = 'The two passphrases do not match.'
    }
    setErrors(next)
    setFeedback(null)
    if (Object.keys(next).length) return

    setBusy(true)
    setFeedback({tone: 'busy', text: 'Encrypting the backup…'})
    try {
      const at = env.now()
      const backup = await createBackup(items, passphrase, at)
      setFile({text: backup, at})
      setPassphrase('')
      setConfirm('')
      setFeedback({
        tone: 'ok',
        text: 'Backup created. Copy or download it before you close this page.'
      })
    } catch (failure) {
      setFeedback({
        tone: 'error',
        text: describe(failure, 'The backup could not be created. Try again.')
      })
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!file) return
    try {
      await env.copy(file.text)
      setCopied(true)
    } catch {
      setFeedback({
        tone: 'error',
        text: 'Copying was blocked. Select the text and copy it by hand.'
      })
    }
  }

  const download = () => {
    if (!file) return
    const url = URL.createObjectURL(
      new Blob([file.text], {type: 'application/json'})
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `authentia-backup-${fileStamp(file.at)}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const pickFile = async (chosen: File) => {
    try {
      const content = await chosen.text()
      setText(content)
      setFileName(chosen.name)
      setRestoreErrors({})
      setPending(null)
      setRestoreFeedback(null)
    } catch {
      setRestoreFeedback({
        tone: 'error',
        text: 'That file could not be read. Pick another one.'
      })
    }
  }

  const save = async (
    incoming: Account[],
    replace: boolean,
    existing: number
  ) => {
    const base: OpenVault =
      open ?? {status: 'open', mode: 'plaintext', items: []}
    const merged = replace ? null : mergeAccounts(items, incoming)

    setImporting(true)
    setRestoreFeedback({tone: 'busy', text: 'Saving the accounts…'})
    try {
      onVault(await saveItems(env, base, merged ? merged.items : incoming))
      setRestoreFeedback({
        tone: 'ok',
        text: merged
          ? `Added ${merged.added}, updated ${merged.updated}, skipped ${merged.skipped}.`
          : existing === 0
            ? `Imported ${incoming.length} ${plural(incoming.length)}.`
            : `Replaced ${existing} ${plural(existing)} with ${incoming.length} from the backup.`
      })
      setText('')
      setFileName(null)
      setRestorePass('')
      setPending(null)
      if (fileInput.current) fileInput.current.value = ''
    } catch (failure) {
      setRestoreFeedback({
        tone: 'error',
        text: describe(failure, 'The accounts could not be saved. Try again.')
      })
    } finally {
      setImporting(false)
    }
  }

  const restore = async (event: FormEvent) => {
    event.preventDefault()
    if (importing) return

    const next: {passphrase?: string; text?: string} = {}
    if (!restorePass) {
      next.passphrase = 'Enter the passphrase this backup was made with.'
    }
    if (!text.trim()) {
      next.text =
        source === 'file' ? 'Choose a backup file.' : 'Paste the backup text.'
    }
    setRestoreErrors(next)
    setRestoreFeedback(null)
    setPending(null)
    if (Object.keys(next).length) return

    setImporting(true)
    setRestoreFeedback({tone: 'busy', text: 'Reading the backup…'})

    let incoming: Account[]
    try {
      incoming = await readBackup(text, restorePass)
    } catch (failure) {
      setImporting(false)
      setRestoreFeedback({
        tone: 'error',
        text: describe(failure, 'That backup could not be read.')
      })
      return
    }

    setImporting(false)
    if (mode === 'replace') {
      setPending({incoming, existing: items.length})
      setRestoreFeedback(null)
      return
    }
    await save(incoming, false, items.length)
  }

  return (
    <Section
      title="Backup"
      chip={empty ? 'Empty' : 'Encrypted'}
      description="An encrypted file you keep somewhere else. Its passphrase can be different from the vault passcode."
    >
      <Tabs
        label="Backup action"
        value={view}
        onChange={(next) => setView(next as 'create' | 'restore')}
        items={[
          {value: 'create', label: 'Create backup'},
          {value: 'restore', label: 'Restore backup'}
        ]}
      />

      {view === 'create' ? (
        <div className="mt-(--space-lg)">
          <p className="max-w-[60ch] text-(length:--text-base) leading-[1.5] text-muted-foreground">
            This passphrase is the only way back into the file, so keep it with
            the file and not only in your head.
          </p>

          <form onSubmit={create} className="mt-(--space-md)">
            <Well className="flex flex-col gap-(--space-md)">
              <div className="flex flex-col gap-(--space-md)">
                <Field
                  label="Backup passphrase"
                  type="password"
                  autoComplete="new-password"
                  value={passphrase}
                  onChange={(value) => {
                    setPassphrase(value)
                    setErrors((current) => ({...current, passphrase: undefined}))
                  }}
                  hint="At least 8 characters."
                  error={errors.passphrase}
                  disabled={empty || busy}
                />
                <Field
                  label="Confirm passphrase"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(value) => {
                    setConfirm(value)
                    setErrors((current) => ({...current, confirm: undefined}))
                  }}
                  error={errors.confirm}
                  disabled={empty || busy}
                />
              </div>
              <div>
                <PrimaryButton type="submit" disabled={empty || busy}>
                  {busy ? 'Creating…' : 'Create backup'}
                </PrimaryButton>
              </div>
              <FeedbackLine feedback={feedback} />
            </Well>
          </form>

          {empty ? (
            <p className="mt-(--space-sm) text-(length:--text-base) text-muted-foreground">
              There is nothing to back up yet. Add an account from the toolbar
              popup first.
            </p>
          ) : null}

          {file ? (
            <Area
              className="mt-(--space-lg)"
              label="Backup file"
              value={file.text}
              readOnly
              selectOnFocus
              rows={8}
              hint={`Saved as authentia-backup-${fileStamp(file.at)}.json. Keep it wherever you keep other recovery files.`}
              action={
                <div className="flex gap-(--space-sm)">
                  <QuietButton type="button" onClick={() => void copy()}>
                    {copied ? 'Copied' : 'Copy'}
                  </QuietButton>
                  <QuietButton type="button" onClick={download}>
                    Download
                  </QuietButton>
                </div>
              }
            />
          ) : null}
        </div>
      ) : (
        <div className="mt-(--space-lg)">
          <p className="max-w-[60ch] text-(length:--text-base) leading-[1.5] text-muted-foreground">
            Bring accounts back from a file or pasted text. The passphrase is
            the one the backup was made with.
          </p>

          <form onSubmit={restore} className="mt-(--space-md)">
            <Well className="flex flex-col gap-(--space-md)">
              <div className="flex flex-col gap-(--space-md)">
                <Field
                  label="Backup passphrase"
                  type="password"
                  autoComplete="off"
                  value={restorePass}
                  onChange={(value) => {
                    setRestorePass(value)
                    setRestoreErrors((current) => ({
                      ...current,
                      passphrase: undefined
                    }))
                  }}
                  error={restoreErrors.passphrase}
                  disabled={importing}
                />
                <div className="flex flex-col gap-(--space-xs)">
                  <Tabs
                    label="Where the backup comes from"
                    value={source}
                    onChange={(next) => {
                      setSource(next as 'file' | 'paste')
                      setRestoreErrors((current) => ({
                        ...current,
                        text: undefined
                      }))
                    }}
                    items={[
                      {value: 'file', label: 'Upload file'},
                      {value: 'paste', label: 'Paste text'}
                    ]}
                  />

                  {source === 'file' ? (
                    <div className="flex flex-col gap-(--space-2xs)">
                      <div className="flex items-center gap-(--space-sm)">
                        <label className="relative inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-transparent px-(--space-sm) text-(length:--text-base) text-foreground transition-colors duration-(--dur-micro) hover:bg-(--paper-2) after:absolute after:-inset-1 after:content-[''] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
                          Choose file
                          <input
                            ref={fileInput}
                            type="file"
                            accept="application/json,.json"
                            className="sr-only"
                            onChange={(event) => {
                              const chosen = event.target.files?.[0]
                              if (chosen) void pickFile(chosen)
                            }}
                          />
                        </label>
                        <p className="min-w-0 truncate text-(length:--text-base) text-muted-foreground">
                          {fileName ?? 'No file chosen'}
                        </p>
                      </div>
                      <p className="min-h-[1lh] text-(length:--text-base) leading-[1.45] text-destructive">
                        {restoreErrors.text ?? ''}
                      </p>
                    </div>
                  ) : (
                    <Area
                      label="Backup text"
                      value={text}
                      onChange={(value) => {
                        setText(value)
                        setRestoreErrors((current) => ({
                          ...current,
                          text: undefined
                        }))
                        setPending(null)
                      }}
                      rows={4}
                      hint="Paste the contents of the .json file here."
                      error={restoreErrors.text}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-(--space-xs)">
                <p className="text-(length:--text-base) font-medium text-foreground">
                  When an account already exists
                </p>
                <Tabs
                  label="When an account already exists"
                  value={mode}
                  onChange={(next) => {
                    setMode(next as 'merge' | 'replace')
                    setPending(null)
                  }}
                  items={[
                    {value: 'merge', label: 'Merge'},
                    {value: 'replace', label: 'Replace all'}
                  ]}
                />
                <p className="min-h-[1lh] max-w-[60ch] text-(length:--text-base) leading-[1.45] text-muted-foreground">
                  {mode === 'merge'
                    ? 'Matching accounts are updated, new ones are added, the rest are left alone.'
                    : 'Every account here is deleted first. This cannot be undone.'}
                </p>
              </div>

              <div>
                <PrimaryButton type="submit" disabled={importing}>
                  {importing ? 'Importing…' : 'Import backup'}
                </PrimaryButton>
              </div>

              <Dialog
                open={Boolean(pending)}
                onClose={() => {
                  if (!importing) setPending(null)
                }}
                title="Replace all accounts?"
                description={
                  pending
                    ? `The ${pending.existing} ${plural(pending.existing)} here are deleted and replaced by the ${pending.incoming.length} in this backup. This cannot be undone.`
                    : ''
                }
                footer={
                  <>
                    <QuietButton
                      type="button"
                      disabled={importing}
                      onClick={() => setPending(null)}
                    >
                      Cancel
                    </QuietButton>
                    <DangerButton
                      type="button"
                      disabled={importing}
                      onClick={() =>
                        pending &&
                        void save(pending.incoming, true, pending.existing)
                      }
                    >
                      {importing ? 'Replacing…' : 'Replace all'}
                    </DangerButton>
                  </>
                }
              />

              <FeedbackLine feedback={restoreFeedback} />
            </Well>
          </form>
        </div>
      )}
    </Section>
  )
}
