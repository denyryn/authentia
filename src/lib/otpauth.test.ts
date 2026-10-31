import {describe, expect, it} from 'vitest'

import {parseOtpAuth} from './otpauth'

const SECRET = 'JBSWY3DPEHPK3PXP'

describe('parseOtpAuth', () => {
  it('reads a full link', () => {
    expect(
      parseOtpAuth(
        `otpauth://totp/GitHub:me@example.com?secret=${SECRET}&issuer=GitHub&algorithm=SHA512&digits=8&period=60`
      )
    ).toEqual({
      issuer: 'GitHub',
      account: 'me@example.com',
      secret: SECRET,
      algorithm: 'SHA512',
      digits: 8,
      period: 60
    })
  })

  it('defaults to SHA1, 6 digits, 30 seconds', () => {
    expect(parseOtpAuth(`otpauth://totp/me@example.com?secret=${SECRET}`)).toEqual({
      issuer: '',
      account: 'me@example.com',
      secret: SECRET,
      algorithm: 'SHA1',
      digits: 6,
      period: 30
    })
  })

  it('prefers the issuer parameter over the label prefix', () => {
    expect(
      parseOtpAuth(`otpauth://totp/Old:acct?secret=${SECRET}&issuer=New`).issuer
    ).toBe('New')
  })

  it('decodes percent-encoded labels', () => {
    expect(
      parseOtpAuth(`otpauth://totp/ACME%20Co:john.doe%40acme.com?secret=${SECRET}`)
    ).toMatchObject({issuer: 'ACME Co', account: 'john.doe@acme.com'})
  })

  it('tolerates lowercase algorithms and secrets with spaces', () => {
    expect(
      parseOtpAuth(
        `otpauth://totp/acct?secret=JBSW%20Y3DP&algorithm=sha256`
      )
    ).toMatchObject({secret: 'JBSWY3DP', algorithm: 'SHA256'})
  })

  it.each([
    ['otpauth-migration://offline?data=abc', /migration links are not supported/],
    ['otpauth://hotp/acct?secret=JBSWY3DP&counter=1', /only otpauth:\/\/totp/i],
    ['https://example.com', /not an otpauth link/],
    ['not a url', /not a valid otpauth link/],
    ['otpauth://totp/acct', /no secret/],
    [`otpauth://totp/acct?secret=${SECRET}&digits=7`, /digits must be 6 or 8/i],
    [`otpauth://totp/acct?secret=${SECRET}&period=5`, /period must be 15 to 120/i],
    [`otpauth://totp/acct?secret=${SECRET}&algorithm=MD5`, /unsupported algorithm/i],
    ['otpauth://totp/acct?secret=1111', /not base32/],
    [`otpauth://totp/?secret=${SECRET}`, /no account label/]
  ])('rejects %s', (input, message) => {
    expect(() => parseOtpAuth(input)).toThrow(message)
  })
})
