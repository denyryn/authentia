import {BACKUP_AAD, createKdf, deriveKey, seal, unseal, type KdfParams} from './crypto'
import type {Account} from './vault'

export type BackupFile = {
  version: 1
  kind: 'authentia-backup'
  createdAt: number
  kdf: KdfParams
  iv: string
  ct: string
}

export async function createBackup(
  items: Account[],
  passphrase: string,
  atMs: number
): Promise<string> {
  const kdf = await createKdf()
  const key = await deriveKey(passphrase, kdf)
  const envelope = await seal({version: 1, items}, key, kdf, BACKUP_AAD)

  const file: BackupFile = {
    version: 1,
    kind: 'authentia-backup',
    createdAt: atMs,
    kdf,
    iv: envelope.iv,
    ct: envelope.ct
  }

  return JSON.stringify(file, null, 2)
}

export async function readBackup(
  text: string,
  passphrase: string
): Promise<Account[]> {
  let file: Partial<BackupFile>
  try {
    file = JSON.parse(text) as Partial<BackupFile>
  } catch {
    throw new Error('That text is not a backup file')
  }

  if (file.kind !== 'authentia-backup' || !file.kdf || !file.iv || !file.ct) {
    throw new Error('That is not an authentia backup')
  }

  try {
    const key = await deriveKey(passphrase, file.kdf)
    const data = await unseal<{items: Account[]}>(
      {version: 1, encrypted: true, kdf: file.kdf, iv: file.iv, ct: file.ct},
      key,
      BACKUP_AAD
    )
    return data.items
  } catch {
    throw new Error('Wrong passphrase, or the backup is damaged')
  }
}

export type MergeResult = {
  items: Account[]
  added: number
  updated: number
  skipped: number
}

const identity = (account: Account) =>
  `${account.issuer.trim().toLowerCase()}\u0000${account.account.trim().toLowerCase()}`

/**
 * Matches on issuer + account name rather than id, because ids are generated per
 * install: importing another machine's backup must update, not duplicate.
 */
export function mergeAccounts(
  existing: Account[],
  incoming: Account[]
): MergeResult {
  const items = [...existing]
  let added = 0
  let updated = 0
  let skipped = 0

  for (const candidate of incoming) {
    const index = items.findIndex((item) => identity(item) === identity(candidate))

    if (index === -1) {
      items.push(candidate)
      added += 1
      continue
    }

    const current = items[index]
    const identical =
      current.secret === candidate.secret &&
      current.algorithm === candidate.algorithm &&
      current.digits === candidate.digits &&
      current.period === candidate.period

    if (identical) {
      skipped += 1
      continue
    }

    items[index] = {
      ...current,
      secret: candidate.secret,
      algorithm: candidate.algorithm,
      digits: candidate.digits,
      period: candidate.period
    }
    updated += 1
  }

  return {items, added, updated, skipped}
}
