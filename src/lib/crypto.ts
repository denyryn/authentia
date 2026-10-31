export type KdfParams = {
  name: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  salt: string
}

export type Envelope = {
  version: 1
  encrypted: true
  kdf: KdfParams
  iv: string
  ct: string
}

const ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12

export const VAULT_AAD = 'authentia:vault:v1'
export const BACKUP_AAD = 'authentia:backup:v1'

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

const randomBytes = (length: number) =>
  crypto.getRandomValues(new Uint8Array(length))

export async function createKdf(): Promise<KdfParams> {
  return {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: ITERATIONS,
    salt: toBase64(randomBytes(SALT_BYTES))
  }
}

export async function deriveKey(
  passphrase: string,
  kdf: KdfParams
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromBase64(kdf.salt),
      iterations: kdf.iterations,
      hash: kdf.hash
    },
    material,
    {name: 'AES-GCM', length: 256},
    true,
    ['encrypt', 'decrypt']
  )
}

export async function seal(
  value: unknown,
  key: CryptoKey,
  kdf: KdfParams,
  aad: string
): Promise<Envelope> {
  const iv = randomBytes(IV_BYTES)
  const ct = await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad)},
    key,
    new TextEncoder().encode(JSON.stringify(value))
  )

  return {
    version: 1,
    encrypted: true,
    kdf,
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ct))
  }
}

/** Throws when the key is wrong or the ciphertext was altered. */
export async function unseal<T>(
  envelope: Envelope,
  key: CryptoKey,
  aad: string
): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(envelope.iv),
      additionalData: new TextEncoder().encode(aad)
    },
    key,
    fromBase64(envelope.ct)
  )

  return JSON.parse(new TextDecoder().decode(plain)) as T
}

export async function exportRawKey(key: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key)))
}

export async function importRawKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(raw), 'AES-GCM', true, [
    'encrypt',
    'decrypt'
  ])
}
