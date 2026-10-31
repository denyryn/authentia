import {decodeBase32} from './base32'
import type {Algorithm, Digits} from './totp'

export type OtpAuthAccount = {
  issuer: string
  account: string
  secret: string
  algorithm: Algorithm
  digits: Digits
  period: number
}

const ALGORITHMS: Algorithm[] = ['SHA1', 'SHA256', 'SHA512']

/**
 * Parses `otpauth://totp/...` setup links. Google Authenticator's
 * `otpauth-migration://` export uses a protobuf payload and is rejected on
 * purpose rather than misread.
 */
export function parseOtpAuth(input: string): OtpAuthAccount {
  const trimmed = input.trim()

  if (/^otpauth-migration:\/\//i.test(trimmed)) {
    throw new Error(
      'Google Authenticator migration links are not supported. Export one account at a time instead.'
    )
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('That is not a valid otpauth link')
  }

  if (url.protocol !== 'otpauth:') throw new Error('That is not an otpauth link')
  if (url.hostname.toLowerCase() !== 'totp') {
    throw new Error('Only otpauth://totp links are supported')
  }

  const label = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!label) throw new Error('The link has no account label')

  const separator = label.indexOf(':')
  const labelIssuer = separator === -1 ? '' : label.slice(0, separator).trim()
  const account = (separator === -1 ? label : label.slice(separator + 1)).trim()
  const issuer = (url.searchParams.get('issuer') ?? labelIssuer).trim()

  const secret = (url.searchParams.get('secret') ?? '').replace(/\s/g, '')
  if (!secret) throw new Error('The link has no secret')
  decodeBase32(secret)

  const rawAlgorithm = (url.searchParams.get('algorithm') ?? 'SHA1').toUpperCase()
  const algorithm = ALGORITHMS.includes(rawAlgorithm as Algorithm)
    ? (rawAlgorithm as Algorithm)
    : null
  if (!algorithm) throw new Error(`Unsupported algorithm "${rawAlgorithm}"`)

  const digits = Number(url.searchParams.get('digits') ?? 6)
  if (digits !== 6 && digits !== 8) throw new Error('Digits must be 6 or 8')

  const period = Number(url.searchParams.get('period') ?? 30)
  if (!Number.isInteger(period) || period < 15 || period > 120) {
    throw new Error('Period must be 15 to 120 seconds')
  }

  return {issuer, account, secret, algorithm, digits, period}
}
