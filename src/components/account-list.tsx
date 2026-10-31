import {Search, X} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'

import {AccountRow} from '@/components/account-row'
import {Button} from '@/components/ui/button'
import type {Env} from '@/lib/env'
import type {Account} from '@/lib/vault'

type AccountListProps = {
  items: Account[]
  now: number
  env: Env
  loading: boolean
  error: string | null
  disabled: boolean
  onAdd(): void
  onEdit(account: Account): void
  onRetry(): void
  onOpenSettings(): void
}

function SkeletonRow() {
  return (
    <div
      className="skeleton-row animate-pulse motion-reduce:animate-none"
      aria-hidden="true"
    >
      <div className="skeleton-identity">
        <span className="skeleton-line skeleton-issuer" />
        <span className="skeleton-line skeleton-account" />
      </div>
      <div className="skeleton-code">
        <span className="skeleton-block" />
        <span className="skeleton-rule" />
      </div>
    </div>
  )
}

export function AccountList({
  items,
  now,
  env,
  loading,
  error,
  disabled,
  onAdd,
  onEdit,
  onRetry,
  onOpenSettings
}: AccountListProps) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const searchable = items.length > 5

  useEffect(() => {
    if (!searchable) return

    const onShortcut = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
        return
      }

      event.preventDefault()
      searchRef.current?.focus()
    }

    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [searchable])

  if (loading) {
    return (
      <>
        <div className="account-panel" aria-busy="true" aria-label="Loading accounts">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
        <span className="sr-only" role="status">
          Loading accounts…
        </span>
      </>
    )
  }

  if (error) {
    return (
      <div className="vault-error" role="alert">
        <h2>The vault could not be read</h2>
        <p className="vault-error-detail">{error}</p>
        <p>
          Your accounts are still on this device. Try again, or restore a backup
          from settings.
        </p>
        <div className="vault-error-actions">
          <Button onClick={onRetry}>Try again</Button>
          <Button variant="secondary" onClick={onOpenSettings}>
            Open settings
          </Button>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="vault-empty">
        <h2>No codes yet</h2>
        <p>
          Add the account that gave you the code. Paste a setup link, or type the
          setup key it showed you.
        </p>
        <Button onClick={onAdd} disabled={disabled}>
          Add account
        </Button>
      </div>
    )
  }

  const term = searchable ? query.trim().toLowerCase() : ''
  const visible = term
    ? items.filter(
        (item) =>
          item.issuer.toLowerCase().includes(term) ||
          item.account.toLowerCase().includes(term)
      )
    : items

  return (
    <div className="account-region">
      {searchable && (
        <div className="search-field">
          <Search className="search-icon" aria-hidden="true" />
          <label htmlFor="account-search" className="sr-only">
            Search accounts
          </label>
          <input
            ref={searchRef}
            id="account-search"
            name="search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              if (query) {
                setQuery('')
              } else {
                event.currentTarget.blur()
              }
            }}
            placeholder="Search accounts"
            autoComplete="off"
            spellCheck={false}
            aria-keyshortcuts="/"
            aria-controls="account-list"
            className="search-input"
          />
          {query ? (
            <Button
              variant="ghost"
              size="icon"
              className="search-clear"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                searchRef.current?.focus()
              }}
            >
              <X className="size-4" />
            </Button>
          ) : (
            <kbd className="search-key" aria-hidden="true">
              /
            </kbd>
          )}
        </div>
      )}

      <div id="account-list">
        {visible.length === 0 ? (
          <div className="search-empty">
            <p>No accounts match “{query.trim()}”.</p>
            <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
              Clear search
            </Button>
          </div>
        ) : (
          <ul className="account-panel">
            {visible.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                now={now}
                env={env}
                onEdit={onEdit}
              />
            ))}
          </ul>
        )}
      </div>

      <span className="sr-only" role="status">
        {term ? `${visible.length} of ${items.length} accounts` : ''}
      </span>
    </div>
  )
}
