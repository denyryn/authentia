import {decodeBase32} from './base32'

export type Algorithm = 'SHA1' | 'SHA256' | 'SHA512'
export type Digits = 6 | 8

export type TotpOptions = {
  algorithm?: Algorithm
  digits?: Digits
  period?: number
}

const HASH_NAMES: Record<Algorithm, string> = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA512: 'SHA-512'
}

export function currentStep(atMs: number, period = 30) {
  return Math.floor(atMs / 1000 / period)
}

export function stepRemainingMs(atMs: number, period = 30) {
  const length = period * 1000
  return length - (atMs % length)
}

/** RFC 6238 / RFC 4226 code for the given secret (base32) and instant. */
export async function generate(
  secret: string,
  options: TotpOptions,
  atMs: number
): Promise<string> {
  const algorithm = options.algorithm ?? 'SHA1'
  const digits = options.digits ?? 6
  const period = options.period ?? 30

  const counter = currentStep(atMs, period)
  const message = new ArrayBuffer(8)
  const view = new DataView(message)
  view.setUint32(0, Math.floor(counter / 2 ** 32))
  view.setUint32(4, counter >>> 0)

  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey(
      'raw',
      decodeBase32(secret),
      {name: 'HMAC', hash: HASH_NAMES[algorithm]},
      false,
      ['sign']
    )
  } catch (error) {
    throw error instanceof Error ? error : new Error('Secret cannot be used')
  }

  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, message)
  )
  const offset = signature[signature.length - 1] & 0x0f
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    (signature[offset + 1] << 16) |
    (signature[offset + 2] << 8) |
    signature[offset + 3]

  return String(binary % 10 ** digits).padStart(digits, '0')
}
