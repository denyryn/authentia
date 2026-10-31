import {
  VAULT_AAD,
  createKdf,
  deriveKey,
  exportRawKey,
  importRawKey,
  seal,
  unseal,
  type Envelope,
  type KdfParams
} from './crypto'
import type {Env} from './env'
import {readSettings, writeSettings} from './settings'
import type {Algorithm, Digits} from './totp'

export type Account = {
  id: string
  issuer: string
  account: string
  secret: string
  algorithm: Algorithm
  digits: Digits
  period: number
  createdAt: number
}

export type VaultData = {version: 1; items: Account[]}

export type VaultDoc = ({version: 1; encrypted: false} & VaultData) | Envelope

export type OpenVault =
  | {status: 'open'; mode: 'plaintext'; items: Account[]}
  | {
      status: 'open'
      mode: 'encrypted'
      items: Account[]
      key: CryptoKey
      kdf: KdfParams
    }

export type VaultState =
  | {status: 'empty'}
  | {status: 'locked'; kdf: KdfParams}
  | OpenVault

export const VAULT_KEY = 'vault'
const SESSION_KEY = 'session'
const LOCKOUT_STEP_MS = 30_000
const LOCKOUT_LONG_MS = 5 * 60_000

type SessionRecord = {key: string; expiresAt: number}

async function readSessionKey(env: Env): Promise<CryptoKey | null> {
  const record = await env.session.get<SessionRecord>(SESSION_KEY)
  if (!record) return null

  if (record.expiresAt <= env.now()) {
    await env.session.remove(SESSION_KEY)
    return null
  }

  return importRawKey(record.key)
}

async function writeSessionKey(
  env: Env,
  key: CryptoKey,
  autoLockMinutes: number
) {
  await env.session.set(SESSION_KEY, {
    key: await exportRawKey(key),
    expiresAt: env.now() + autoLockMinutes * 60_000
  } satisfies SessionRecord)
}

export async function lock(env: Env) {
  await env.session.remove(SESSION_KEY)
}

export async function loadVault(env: Env): Promise<VaultState> {
  const doc = await env.local.get<VaultDoc>(VAULT_KEY)
  if (!doc) return {status: 'empty'}
  if (!doc.encrypted) return {status: 'open', mode: 'plaintext', items: doc.items}

  const key = await readSessionKey(env)
  if (!key) return {status: 'locked', kdf: doc.kdf}

  try {
    const data = await unseal<VaultData>(doc, key, VAULT_AAD)
    return {status: 'open', mode: 'encrypted', items: data.items, key, kdf: doc.kdf}
  } catch {
    await lock(env)
    return {status: 'locked', kdf: doc.kdf}
  }
}

export async function saveItems(
  env: Env,
  state: OpenVault,
  items: Account[]
): Promise<OpenVault> {
  if (state.mode === 'plaintext') {
    await env.local.set(VAULT_KEY, {
      version: 1,
      encrypted: false,
      items
    } satisfies VaultDoc)
    return {...state, items}
  }

  await env.local.set(VAULT_KEY, await seal({version: 1, items}, state.key, state.kdf, VAULT_AAD))
  const settings = await readSettings(env)
  await writeSessionKey(env, state.key, settings.autoLockMinutes)

  return {...state, items}
}

export async function setPasscode(
  env: Env,
  items: Account[],
  passcode: string
): Promise<OpenVault> {
  const kdf = await createKdf()
  const key = await deriveKey(passcode, kdf)
  await env.local.set(VAULT_KEY, await seal({version: 1, items}, key, kdf, VAULT_AAD))

  const settings = await readSettings(env)
  await writeSessionKey(env, key, settings.autoLockMinutes)

  return {status: 'open', mode: 'encrypted', items, key, kdf}
}

export async function removePasscode(
  env: Env,
  items: Account[]
): Promise<OpenVault> {
  await env.local.set(VAULT_KEY, {
    version: 1,
    encrypted: false,
    items
  } satisfies VaultDoc)
  await lock(env)

  return {status: 'open', mode: 'plaintext', items}
}

export type UnlockResult =
  | {ok: true; state: OpenVault}
  | {ok: false; error: string; retryAfterMs?: number}

export async function unlock(
  env: Env,
  passcode: string
): Promise<UnlockResult> {
  const doc = await env.local.get<VaultDoc>(VAULT_KEY)
  if (!doc) return {ok: false, error: 'There is no vault to unlock'}
  if (!doc.encrypted) {
    return {ok: false, error: 'No passcode is set'}
  }

  const settings = await readSettings(env)
  const now = env.now()

  if (settings.lockoutUntil > now) {
    return {
      ok: false,
      error: 'Too many attempts. Wait a moment and try again.',
      retryAfterMs: settings.lockoutUntil - now
    }
  }

  const key = await deriveKey(passcode, doc.kdf)

  try {
    const data = await unseal<VaultData>(doc, key, VAULT_AAD)
    await writeSettings(env, {failedUnlocks: 0, lockoutUntil: 0})
    await writeSessionKey(env, key, settings.autoLockMinutes)

    return {
      ok: true,
      state: {status: 'open', mode: 'encrypted', items: data.items, key, kdf: doc.kdf}
    }
  } catch {
    const failed = settings.failedUnlocks + 1
    const lockoutUntil =
      failed >= 10
        ? now + LOCKOUT_LONG_MS
        : failed >= 5
          ? now + LOCKOUT_STEP_MS
          : 0

    await writeSettings(env, {
      failedUnlocks: failed >= 10 ? 0 : failed,
      lockoutUntil
    })

    return {
      ok: false,
      error: lockoutUntil ? 'Too many attempts. Wait a moment.' : 'Wrong passcode.',
      retryAfterMs: lockoutUntil ? lockoutUntil - now : undefined
    }
  }
}
