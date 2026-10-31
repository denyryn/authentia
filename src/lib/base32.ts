const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * RFC 4648 base32 decoding for TOTP secrets: case-insensitive, tolerates
 * spaces and missing padding, rejects anything outside the alphabet.
 */
export function decodeBase32(input: string): Uint8Array<ArrayBuffer> {
  const clean = input.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase()

  if (!clean) throw new Error('Secret is empty')

  let bits = 0
  let value = 0
  const out: number[] = []

  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index === -1) throw new Error(`Secret contains "${char}", which is not base32`)

    value = (value << 5) | index
    bits += 5

    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  if (out.length === 0) throw new Error('Secret is too short')

  return Uint8Array.from(out)
}
