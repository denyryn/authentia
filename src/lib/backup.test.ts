import {expect, it} from 'vitest'

import {createBackup, mergeAccounts, readBackup} from './backup'
import type {Account} from './vault'

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

it('creates a readable backup without plaintext secrets', async () => {
  const json = await createBackup(ITEMS, 'pass', 5000)
  const file = JSON.parse(json) as {kind: string; version: number}
  expect(file.kind).toBe('authentia-backup')
  expect(file.version).toBe(1)
  expect(json).not.toContain('SECRET-GITHUB-ABC123')
  await expect(readBackup(json, 'pass')).resolves.toEqual(ITEMS)
})

it('readBackup rejects a wrong passphrase', async () => {
  const json = await createBackup(ITEMS, 'pass', 5000)
  await expect(readBackup(json, 'nope')).rejects.toThrow(/Wrong passphrase/)
})

it('readBackup rejects invalid and foreign JSON', async () => {
  await expect(readBackup('not json', 'pass')).rejects.toThrow(
    'That text is not a backup file'
  )
  await expect(readBackup('{"kind":"other"}', 'pass')).rejects.toThrow(
    'That is not an authentia backup'
  )
})

it('two backups with the same passphrase have distinct ciphertexts', async () => {
  const first = await createBackup(ITEMS, 'pass', 5000)
  const second = await createBackup(ITEMS, 'pass', 5000)
  expect(second).not.toBe(first)
})

it('mergeAccounts adds, updates, skips, and normalizes identity', () => {
  const existing: Account[] = [ITEMS[0], ITEMS[1]]
  const incoming: Account[] = [
    ITEMS[0], // identical duplicate
    {...ITEMS[1], secret: 'NEW-AWS-ROTATED'}, // changed secret -> update
    {...ITEMS[0], issuer: '  GITHUB  ', account: ' me@example.com ', secret: 'NEW-GH-KEY'},
    {id: 'acc-3', issuer: 'Bitwarden', account: 'x', secret: 'S3', algorithm: 'SHA1', digits: 6, period: 30, createdAt: 300}
  ]

  const existingCopy = JSON.parse(JSON.stringify(existing)) as typeof existing
  const result = mergeAccounts(existing, incoming)

  expect(result.added).toBe(1)
  expect(result.updated).toBe(2)
  expect(result.skipped).toBe(1)
  expect(result.items).toHaveLength(3)
  expect(existing).toEqual(existingCopy)

  const updated = result.items.find((item) => item.id === 'acc-2')
  expect(updated?.secret).toBe('NEW-AWS-ROTATED')
  // Update keeps the existing id.
  expect(result.items.some((item) => item.id === 'acc-1' && item.secret === 'NEW-GH-KEY')).toBe(true)
})
