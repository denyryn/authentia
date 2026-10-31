import {expect, it} from 'vitest'

import {
  createKdf,
  deriveKey,
  exportRawKey,
  fromBase64,
  importRawKey,
  seal,
  toBase64,
  unseal
} from './crypto'

// Cheap kdf for tests: production code enforces 600k via createKdf.
const testKdf = () => ({
  name: 'PBKDF2' as const,
  hash: 'SHA-256' as const,
  iterations: 1000,
  salt: toBase64(new TextEncoder().encode('testsalt-16bytes..'))
})

it('round-trips base64 including bytes > 127', () => {
  const bytes = new Uint8Array([0, 1, 127, 128, 200, 254, 255])
  expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes))
})

it('createKdf uses 600k PBKDF2-SHA256 with a fresh random salt', async () => {
  const kdf = await createKdf()
  expect(kdf.iterations).toBe(600000)
  expect(kdf.hash).toBe('SHA-256')
  expect(kdf.name).toBe('PBKDF2')
  expect(fromBase64(kdf.salt).length).toBe(16)
  expect((await createKdf()).salt).not.toBe(kdf.salt)
})

it('seals and unseals with an explicit AAD', async () => {
  const kdf = testKdf()
  const key = await deriveKey('pass', kdf)
  const value = {items: ['a', 'b'], n: 7}

  const env = await seal(value, key, kdf, 'my-aad')
  expect(env.encrypted).toBe(true)
  expect(await unseal(env, key, 'my-aad')).toEqual(value)
})

it('rejects a wrong passphrase', async () => {
  const kdf = testKdf()
  const key = await deriveKey('right', kdf)
  const env = await seal({secret: 'x'}, key, kdf, 'aad')

  const wrong = await deriveKey('wrong', kdf)
  await expect(unseal(env, wrong, 'aad')).rejects.toThrow()
})

it('rejects a tampered ciphertext', async () => {
  const kdf = testKdf()
  const key = await deriveKey('pass', kdf)
  const env = await seal({secret: 'x'}, key, kdf, 'aad')

  const flip = env.ct[0] === 'A' ? 'B' : 'A'
  const tampered = {...env, ct: flip + env.ct.slice(1)}
  await expect(unseal(tampered, key, 'aad')).rejects.toThrow()
})

it('rejects a wrong AAD', async () => {
  const kdf = testKdf()
  const key = await deriveKey('pass', kdf)
  const env = await seal({secret: 'x'}, key, kdf, 'right-aad')

  await expect(unseal(env, key, 'wrong-aad')).rejects.toThrow()
})

it('seals the same value twice with a fresh iv and ciphertext', async () => {
  const kdf = testKdf()
  const key = await deriveKey('pass', kdf)

  const first = await seal('same', key, kdf, 'aad')
  const second = await seal('same', key, kdf, 'aad')

  expect(first.iv).not.toBe(second.iv)
  expect(first.ct).not.toBe(second.ct)
})

it('exports and imports a raw key that decrypts the original data', async () => {
  const kdf = testKdf()
  const key = await deriveKey('pass', kdf)
  const env = await seal({kept: true}, key, kdf, 'aad')

  const raw = await exportRawKey(key)
  const imported = await importRawKey(raw)
  expect(raw.length).toBeGreaterThan(0)
  expect(await unseal(env, imported, 'aad')).toEqual({kept: true})
})
