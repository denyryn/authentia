// @vitest-environment jsdom
import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import {AccountForm} from './account-form'
import {createMemoryEnv} from '@/lib/memory-env'

afterEach(cleanup)

const link =
  'otpauth://totp/GitHub:me@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub'

describe('AccountForm', () => {
  it('fills the form from a scanned link', async () => {
    const {env} = createMemoryEnv()

    render(
      <AccountForm
        env={env}
        now={0}
        seed={link}
        others={[]}
        onSave={async () => true}
        onCancel={() => {}}
      />
    )

    // The parser runs on a debounce after the seeded setup link.
    expect(await screen.findByDisplayValue('GitHub')).toBeTruthy()
    expect(await screen.findByDisplayValue('me@example.com')).toBeTruthy()
  })
})
