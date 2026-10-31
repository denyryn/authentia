import {LockKeyhole, Plus, Settings, X} from 'lucide-react'
import {useState} from 'react'

import {AccountForm} from '@/components/account-form'
import {AccountList} from '@/components/account-list'
import {PasscodeGate} from '@/components/passcode-gate'
import {Button} from '@/components/ui/button'
import {useNow} from '@/hooks/use-now'
import {useVault} from '@/hooks/use-vault'
import type {Env} from '@/lib/env'
import type {Account} from '@/lib/vault'

type Panel = {mode: 'add'} | {mode: 'edit'; account: Account} | null

export function PopupApp({env}: {env: Env}) {
  const now = useNow(env.now)
  const {state, error, clearError, reload, actions} = useVault(env)
  const [panel, setPanel] = useState<Panel>(null)

  const ready = state?.status === 'open' || state?.status === 'empty'
  const locked = state?.status === 'locked'
  const items = state?.status === 'open' ? state.items : []

  const save = async (account: Account) => {
    const saved =
      panel?.mode === 'edit'
        ? await actions.update(account)
        : await actions.add(account)

    if (saved) {
      clearError()
      setPanel(null)
    }

    return saved
  }

  const openPanel = () => {
    clearError()
    setPanel({mode: 'add'})
  }

  return (
    <main className="app-shell">
      <header className="app-bar">
        <h1 className="wordmark">
          <img
            className="wordmark-mark"
            src="/images/icon-64.png"
            alt=""
            width={20}
            height={20}
          />
          authentia
        </h1>
        {!locked && (
          <div className="app-bar-actions">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Add account"
              disabled={!ready || Boolean(panel)}
              onClick={openPanel}
            >
              <Plus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open settings"
              onClick={() => env.openOptions()}
            >
              <Settings className="size-4" />
            </Button>
          </div>
        )}
      </header>

      <div className="app-body">
        {state === null && (
          <AccountList
            items={[]}
            now={now}
            env={env}
            loading={!error}
            error={error}
            disabled
            onAdd={() => {}}
            onEdit={() => {}}
            onRetry={reload}
            onOpenSettings={() => env.openOptions()}
          />
        )}

        {locked && (
          <PasscodeGate
            env={env}
            now={now}
            onUnlock={actions.unlock}
            onForgot={() => env.openOptions()}
          />
        )}

        {ready && panel && (
          <AccountForm
            key={panel.mode === 'edit' ? panel.account.id : 'add'}
            env={env}
            now={now}
            existing={panel.mode === 'edit' ? panel.account : undefined}
            others={items}
            error={error}
            onSave={save}
            onDelete={
              panel.mode === 'edit'
                ? async () => {
                    const removed = await actions.remove(panel.account.id)
                    if (removed) setPanel(null)
                    return removed
                  }
                : undefined
            }
            onCancel={() => {
              clearError()
              setPanel(null)
            }}
          />
        )}

        {ready && !panel && (
          <>
            {error && (
              <div className="notice" role="alert">
                <p>{error}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="notice-dismiss"
                  aria-label="Dismiss error"
                  onClick={clearError}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
            <AccountList
              items={items}
              now={now}
              env={env}
              loading={false}
              error={null}
              disabled={false}
              onAdd={openPanel}
              onEdit={(account) => {
                clearError()
                setPanel({mode: 'edit', account})
              }}
              onRetry={reload}
              onOpenSettings={() => env.openOptions()}
            />
          </>
        )}
      </div>

      {ready && !panel && (
        <footer className="app-foot">
          <LockKeyhole className="size-3" aria-hidden="true" />
          <span>Vault stored on this device.</span>
        </footer>
      )}
    </main>
  )
}
