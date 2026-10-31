import {useCallback, useEffect, useState} from 'react'

import type {Env} from '@/lib/env'
import {
  loadVault,
  saveItems,
  unlock as unlockVault,
  type Account,
  type OpenVault,
  type UnlockResult,
  type VaultState
} from '@/lib/vault'

type VaultActions = {
  add(account: Account): Promise<boolean>
  update(account: Account): Promise<boolean>
  remove(id: string): Promise<boolean>
  unlock(passcode: string): Promise<UnlockResult>
}

const describe = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export function useVault(env: Env) {
  // null means "still loading"; the popup must not guess at an empty vault.
  const [state, setState] = useState<VaultState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true

    loadVault(env).then(
      (loaded) => {
        if (alive) setState(loaded)
      },
      (failure: unknown) => {
        if (alive) setError(describe(failure, 'The vault could not be read.'))
      }
    )

    return () => {
      alive = false
    }
  }, [env, attempt])

  const persist = useCallback(
    async (items: Account[]) => {
      if (!state) return false

      // A brand-new install has no document yet; the first save creates a
      // plaintext vault so adding an account works before a passcode is set.
      let base: OpenVault | null = null
      if (state.status === 'open') base = state
      else if (state.status === 'empty') {
        base = {status: 'open', mode: 'plaintext', items: []}
      }

      if (!base) return false

      try {
        setState(await saveItems(env, base, items))
        setError(null)
        return true
      } catch (failure) {
        setError(describe(failure, 'The vault could not be saved.'))
        return false
      }
    },
    [env, state]
  )

  const add = useCallback(
    (account: Account) =>
      persist(state?.status === 'open' ? [...state.items, account] : []),
    [persist, state]
  )

  const update = useCallback(
    (account: Account) =>
      persist(
        state?.status === 'open'
          ? state.items.map((item) => (item.id === account.id ? account : item))
          : []
      ),
    [persist, state]
  )

  const remove = useCallback(
    (id: string) =>
      persist(
        state?.status === 'open'
          ? state.items.filter((item) => item.id !== id)
          : []
      ),
    [persist, state]
  )

  const unlock = useCallback(
    async (passcode: string): Promise<UnlockResult> => {
      try {
        const result = await unlockVault(env, passcode)
        if (result.ok) {
          setState(result.state)
          setError(null)
        }
        return result
      } catch (failure) {
        return {
          ok: false,
          error: describe(failure, 'The vault could not be unlocked.')
        }
      }
    },
    [env]
  )

  return {
    state,
    error,
    clearError: () => setError(null),
    reload: () => {
      setState(null)
      setError(null)
      setAttempt((current) => current + 1)
    },
    actions: {add, update, remove, unlock} satisfies VaultActions
  }
}

export type {OpenVault, VaultActions}
