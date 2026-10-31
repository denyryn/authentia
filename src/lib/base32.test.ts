import {describe, expect, it} from 'vitest'

import {decodeBase32} from './base32'

const ascii = (input: Uint8Array) => String.fromCharCode(...input)

describe('decodeBase32', () => {
  it('decodes RFC 4648 vectors', () => {
    expect(ascii(decodeBase32('MZXW6YTBOI======'))).toBe('foobar')
    expect(ascii(decodeBase32('MY======'))).toBe('f')
    expect(ascii(decodeBase32('MZXQ===='))).toBe('fo')
  })

  it('decodes the RFC 6238 seed', () => {
    expect(ascii(decodeBase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'))).toBe(
      '12345678901234567890'
    )
  })

  it('accepts lowercase, spaces, dashes and missing padding', () => {
    const expected = ascii(decodeBase32('MZXW6YTBOI'))
    expect(ascii(decodeBase32('mzxw 6ytb-oi'))).toBe(expected)
    expect(ascii(decodeBase32('MZXW6YTBOI======'))).toBe(expected)
  })

  it('rejects characters outside the alphabet', () => {
    expect(() => decodeBase32('MZXW6YTBO1')).toThrow(/not base32/)
    expect(() => decodeBase32('MZXW6YTBO¥')).toThrow(/not base32/)
  })

  it('rejects empty and one-character secrets', () => {
    expect(() => decodeBase32('   ')).toThrow(/empty/)
    expect(() => decodeBase32('A')).toThrow(/too short/)
  })
})
