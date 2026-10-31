import {createRoot} from 'react-dom/client'

import {PopupApp} from '@/action/PopupApp'
import {createMemoryEnv} from '@/lib/memory-env'
import type {Account} from '@/lib/vault'
import {OptionsApp} from '@/options/OptionsApp'
import '@/styles/globals.css'

const now = Date.now()

const seed: Account[] = [
  {
    id: 'github',
    issuer: 'GitHub',
    account: 'me@example.com',
    secret: 'JBSWY3DPEHPK3PXP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    createdAt: now - 86_400_000
  },
  {
    id: 'cloudflare',
    issuer: 'Cloudflare',
    account: 'ops@example.com',
    secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    createdAt: now - 172_800_000
  },
  {
    id: 'proton',
    issuer: 'Proton',
    account: 'private@proton.me',
    secret: 'MZXW6YTBOI======',
    algorithm: 'SHA256',
    digits: 8,
    period: 30,
    createdAt: now - 259_200_000
  }
]

const {env} = createMemoryEnv(now)

const params = new URLSearchParams(location.search)
const screen = params.get('screen') ?? 'popup'
const locked = params.get('locked') === '1'
const empty = params.get('empty') === '1'
const many = params.get('many') === '1'

const services = [
  'GitHub',
  'Cloudflare',
  'Proton',
  'Stripe',
  'Figma',
  'Linear',
  'Hetzner',
  'Fastmail'
]

if (locked) {
  // Encrypted vault with no session: the gate is the only thing on screen.
  await env.local.set('vault', {
    version: 1,
    encrypted: true,
    kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt: 'AAAA'},
    iv: 'AAAA',
    ct: 'AAAA'
  })
} else {
  const items = empty
    ? []
    : many
      ? services.map((service, index) => ({
          id: service.toLowerCase(),
          issuer: service,
          account: `team-${index + 1}@example.com`,
          secret: index % 2 ? 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' : 'JBSWY3DPEHPK3PXP',
          algorithm: 'SHA1' as const,
          digits: index === 3 ? (8 as const) : (6 as const),
          period: 30,
          createdAt: now - index * 86_400_000
        }))
      : seed

  await env.local.set('vault', {version: 1, encrypted: false, items})
}

document.body.className = screen === 'options' ? 'options' : 'popup'
if (screen === 'popup') document.body.style.margin = '0 auto'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    screen === 'options' ? <OptionsApp env={env} /> : <PopupApp env={env} />
  )
}
