import {useState} from 'react'

import {PasscodeGate} from '@/components/passcode-gate'
import {useNow} from '@/hooks/use-now'
import {useVault} from '@/hooks/use-vault'
import type {Env} from '@/lib/env'
import type {OpenVault, UnlockResult, VaultState} from '@/lib/vault'

import {QuietButton} from './fields'
import {BackupSection} from './sections/backup'
import {DangerSection} from './sections/danger'
import {PasscodeSection} from './sections/passcode'

const countLabel = (count: number) =>
  count === 0 ? 'No accounts' : `${count} ${count === 1 ? 'account' : 'accounts'}`

function Header({count}: {count: string | null}) {
  return (
    <header className="flex flex-col gap-(--space-xs) border-b border-border pb-(--space-lg)">
      <h1 className="text-(length:--text-xl) font-semibold tracking-[-0.02em] text-foreground">
        Authentia Settings
      </h1>
      <div className="flex flex-wrap items-baseline justify-between gap-(--space-sm)">
        <p className="text-(length:--text-md) text-muted-foreground">
          Everything stays on this machine.
        </p>
        {count ? (
          <p className="text-(length:--text-base) tabular-nums text-muted-foreground">
            {count}
          </p>
        ) : null}
      </div>
    </header>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only">Reading the vault.</p>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="animate-pulse border-b border-border py-(--space-xl) motion-reduce:animate-none"
        >
          <div className="flex justify-between gap-(--space-md)">
            <div className="h-4 w-28 rounded-xs bg-(--paper-2)" />
            <div className="h-5 w-16 rounded-full bg-(--paper-2)" />
          </div>
          <div className="mt-(--space-sm) h-3 w-full max-w-[28rem] rounded-xs bg-(--paper-2)" />
          <div className="mt-(--space-lg) h-20 w-full max-w-[26rem] rounded-md bg-(--paper-2)" />
        </div>
      ))}
    </div>
  )
}

function ReadError({message}: {message: string}) {
  return (
    <section className="border-b border-border py-(--space-xl)">
      <h2 className="text-(length:--text-lg) font-semibold text-foreground">
        The vault could not be read
      </h2>
      <p className="mt-(--space-xs) max-w-[60ch] text-(length:--text-md) leading-[1.55] text-destructive">
        {message}
      </p>
      <p className="mt-(--space-2xs) max-w-[60ch] text-(length:--text-base) leading-[1.5] text-muted-foreground">
        Nothing was changed. Reload the page to try again.
      </p>
      <QuietButton
        type="button"
        className="mt-(--space-md)"
        onClick={() => window.location.reload()}
      >
        Reload the page
      </QuietButton>
    </section>
  )
}

function LockedSection({
  env,
  onUnlock,
  onReset
}: {
  env: Env
  onUnlock(passcode: string): Promise<UnlockResult>
  onReset(): void
}) {
  const now = useNow(env.now)

  return (
    <>
      <div className="py-(--space-xl)">
        <PasscodeGate env={env} now={now} onUnlock={onUnlock} />
      </div>
      <DangerSection
        env={env}
        onReset={onReset}
        title="Forgot your passcode?"
        chip="Erase"
        description="A vault cannot be read without its passcode. Erasing it removes every account kept here; a backup made earlier still restores them afterwards."
        confirmHint="Every account in this browser will be removed."
        action="Erase the vault"
        confirmTitle="Erase this vault?"
        confirmDescription="Every account kept in this browser is deleted. A backup you made earlier can be restored afterwards."
      />
    </>
  )
}

export function OptionsApp({env}: {env: Env}) {
  const {state, error, actions} = useVault(env)
  const [written, setWritten] = useState<VaultState | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const vault = written ?? state
  const open = vault?.status === 'open' ? vault : null
  const items = open?.items ?? []
  const encrypted = open?.mode === 'encrypted'

  const handleVault = (next: OpenVault) => {
    setWritten(next)
    setNotice(null)
  }

  const handleReset = () => {
    setWritten({status: 'empty'})
    setResetKey((key) => key + 1)
    setNotice('All data deleted. The page is back to a fresh install.')
  }

  return (
    <main className="flex flex-col">
      <Header
        count={vault && vault.status !== 'locked' ? countLabel(items.length) : null}
      />

      {notice ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-(--space-md) text-(length:--text-base) text-foreground"
        >
          {notice}
        </p>
      ) : null}

      {vault === null ? (
        error ? (
          <ReadError message={error} />
        ) : (
          <Skeleton />
        )
      ) : vault.status === 'locked' ? (
        <LockedSection
          env={env}
          onUnlock={actions.unlock}
          onReset={handleReset}
        />
      ) : (
        <div key={resetKey} className="flex flex-col divide-y divide-border">
          <PasscodeSection
            env={env}
            items={items}
            encrypted={encrypted}
            onVault={handleVault}
          />
          <BackupSection
            env={env}
            items={items}
            open={open}
            onVault={handleVault}
          />
          <DangerSection env={env} onReset={handleReset} />
        </div>
      )}
    </main>
  )
}
