import {expect, it} from 'vitest'

import {createMemoryEnv} from './memory-env'
import {readSettings} from './settings'
import {
  VAULT_KEY,
  loadVault,
  lock,
  removePasscode,
  saveItems,
  setPasscode,
  unlock,
  type Account,
  type OpenVault
} from './vault'

const ITEMS: Account[] = [
  {
    id: 'acc-1',
    issuer: 'GitHub',
    account: 'me@example.com',
    secret: 'SECRET-GITHUB-ABC123',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    createdAt: 100
  },
  {
    id: 'acc-2',
    issuer: 'AWS',
    account: 'root',
    secret: 'SECRET-AWS-XYZ789',
    algorithm: 'SHA256',
    digits: 8,
    period: 60,
    createdAt: 200
  }
]

const plaintextState = (items: Account[] = []): OpenVault => ({
  status: 'open',
  mode: 'plaintext',
  items
})

it('empty storage reports empty', async () => {
  const {env} = createMemoryEnv()
  expect(await loadVault(env)).toEqual({status: 'empty'})
})

it('plaintext mode saves and reloads items unencrypted', async () => {
  const {env} = createMemoryEnv()
  await saveItems(env, plaintextState(), ITEMS)

  const doc = await env.local.get<{encrypted: false; items: Account[]}>(VAULT_KEY)
  expect(doc?.encrypted).toBe(false)
  await expect(loadVault(env)).resolves.toEqual({
    status: 'open',
    mode: 'plaintext',
    items: ITEMS
  })
})

it('setPasscode stores an encrypted doc without plaintext items', async () => {
  const {env} = createMemoryEnv()
  await setPasscode(env, ITEMS, '1111')

  const doc = await env.local.get<Record<string, unknown>>(VAULT_KEY)
  expect(doc?.encrypted).toBe(true)
  expect(JSON.stringify(doc)).not.toContain('SECRET-GITHUB-ABC123')
  // setPasscode opens a session right away, so the vault is open until expiry.
  await expect(loadVault(env)).resolves.toMatchObject({
    status: 'open',
    mode: 'encrypted',
    items: ITEMS
  })
})

it('unlock with the right passcode opens and starts a session', async () => {
  const {env} = createMemoryEnv()
  await setPasscode(env, ITEMS, '1111')

  const result = await unlock(env, '1111')
  if (!result.ok) throw new Error('expected unlock to succeed')
  expect(result.ok).toBe(true)
  expect(result.state.items).toEqual(ITEMS)

  // Session key is in storage, so the next load is open without a prompt.
  const state = await loadVault(env)
  expect(state).toMatchObject({status: 'open', mode: 'encrypted'})
  if (state.status === 'open' && state.mode === 'encrypted') {
    expect(state.items).toEqual(ITEMS)
  }
})

it('unlock with a wrong passcode fails and counts the attempt', async () => {
  const {env} = createMemoryEnv()
  await setPasscode(env, ITEMS, '1111')

  const result = await unlock(env, 'wrong')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error).toMatch(/wrong passcode/i)

  const settings = await readSettings(env)
  expect(settings.failedUnlocks).toBe(1)
})

it('five wrong attempts trigger a lockout that blocks even the right passcode', {timeout: 30_000}, async () => {
  const {env, advance} = createMemoryEnv()
  await setPasscode(env, ITEMS, '1111')

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await unlock(env, 'wrong')
  }
  const fifth = await unlock(env, 'wrong') // 5th wrong attempt sets the lockout
  if (fifth.ok) throw new Error('expected unlock to fail')
  expect(fifth.retryAfterMs).toBeGreaterThanOrEqual(29999)
  expect(fifth.retryAfterMs).toBeLessThanOrEqual(30001)

  const blocked = await unlock(env, '1111')
  if (blocked.ok) throw new Error('expected unlock to be blocked')
  expect(blocked.error).toMatch(/too many attempts/i)

  advance(30000)
  const after = await unlock(env, '1111')
  expect(after.ok).toBe(true)
})

it('session expires after autoLockMinutes', async () => {
  const {env, advance} = createMemoryEnv()
  await setPasscode(env, ITEMS, '1111')
  await expect(loadVault(env)).resolves.toMatchObject({status: 'open'})

  advance(15 * 60_000 + 1)
  await expect(loadVault(env)).resolves.toMatchObject({status: 'locked'})
})

it('lock clears the session', async () => {
  const {env} = createMemoryEnv()
  await setPasscode(env, ITEMS, '1111')
  await expect(loadVault(env)).resolves.toMatchObject({status: 'open'})

  await lock(env)
  await expect(loadVault(env)).resolves.toMatchObject({status: 'locked'})
})

it('removePasscode writes plaintext and clears the session', async () => {
  const {env} = createMemoryEnv()
  await setPasscode(env, ITEMS, '1111')

  await removePasscode(env, ITEMS)
  const doc = await env.local.get<{encrypted: false; items: Account[]}>(VAULT_KEY)
  expect(doc?.encrypted).toBe(false)
  expect(doc?.items).toEqual(ITEMS)
  await expect(loadVault(env)).resolves.toEqual({
    status: 'open',
    mode: 'plaintext',
    items: ITEMS
  })
})

it('changing the passcode keeps items and invalidates the old one', async () => {
  const {env} = createMemoryEnv()
  await setPasscode(env, ITEMS, '1111')
  const changed = await setPasscode(env, ITEMS, '2222')
  expect(changed.items).toEqual(ITEMS)

  const oldResult = await unlock(env, '1111')
  expect(oldResult.ok).toBe(false)
  if (!oldResult.ok) expect(oldResult.error).toMatch(/wrong passcode/i)

  const newResult = await unlock(env, '2222')
  expect(newResult.ok).toBe(true)
  if (newResult.ok) expect(newResult.state.items).toEqual(ITEMS)
})
