import {describe, expect, it} from 'vitest'

import {currentStep, generate, stepRemainingMs} from './totp'

const SEEDS = {
  SHA1: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  SHA256:
    'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA',
  SHA512:
    'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA'
}

// RFC 6238 appendix B, 8 digits, the same seeds the RFC uses.
const VECTORS: Array<[seconds: number, sha1: string, sha256: string, sha512: string]> = [
  [59, '94287082', '46119246', '90693936'],
  [1111111109, '07081804', '68084774', '25091201'],
  [1111111111, '14050471', '67062674', '99943326'],
  [1234567890, '89005924', '91819424', '93441116'],
  [2000000000, '69279037', '90698825', '38618901'],
  [20000000000, '65353130', '77737706', '47863826']
]

describe('generate', () => {
  it.each(VECTORS)('matches RFC 6238 at T=%s', async (seconds, sha1, sha256, sha512) => {
    const atMs = seconds * 1000
    expect(await generate(SEEDS.SHA1, {algorithm: 'SHA1', digits: 8}, atMs)).toBe(sha1)
    expect(await generate(SEEDS.SHA256, {algorithm: 'SHA256', digits: 8}, atMs)).toBe(
      sha256
    )
    expect(await generate(SEEDS.SHA512, {algorithm: 'SHA512', digits: 8}, atMs)).toBe(
      sha512
    )
  })

  it('defaults to SHA1, 6 digits, 30 seconds', async () => {
    expect(await generate(SEEDS.SHA1, {}, 59_000)).toBe('287082')
  })

  it('supports a 60 second period', async () => {
    const opts = {digits: 8, period: 60} as const
    expect(await generate(SEEDS.SHA1, opts, 59_000)).toBe(
      await generate(SEEDS.SHA1, opts, 0)
    )
    expect(await generate(SEEDS.SHA1, opts, 61_000)).not.toBe(
      await generate(SEEDS.SHA1, opts, 0)
    )
  })

  it('changes exactly at the step boundary', async () => {
    const before = await generate(SEEDS.SHA1, {}, 59_999)
    const after = await generate(SEEDS.SHA1, {}, 60_000)
    expect(before).not.toBe(after)
    expect(await generate(SEEDS.SHA1, {}, 29_999)).toBe(
      await generate(SEEDS.SHA1, {}, 30_000 - 1)
    )
  })

  it('rejects an unusable secret', async () => {
    await expect(generate('', {}, 0)).rejects.toThrow()
    await expect(generate('MZXW6YTB1', {}, 0)).rejects.toThrow()
  })
})

describe('step helpers', () => {
  it('counts whole steps', () => {
    expect(currentStep(0)).toBe(0)
    expect(currentStep(29_999)).toBe(0)
    expect(currentStep(30_000)).toBe(1)
  })

  it('reports the time left in the current step', () => {
    expect(stepRemainingMs(0)).toBe(30_000)
    expect(stepRemainingMs(1_000)).toBe(29_000)
    expect(stepRemainingMs(30_000)).toBe(30_000)
  })
})
