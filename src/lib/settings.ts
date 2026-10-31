import type {Env} from './env'

export type Settings = {
  version: 1
  autoLockMinutes: number
  clockEndpoint?: string
  failedUnlocks: number
  lockoutUntil: number
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  autoLockMinutes: 15,
  failedUnlocks: 0,
  lockoutUntil: 0
}

export async function readSettings(env: Env): Promise<Settings> {
  const stored = await env.local.get<Settings>('settings')
  return {...DEFAULT_SETTINGS, ...stored, version: 1}
}

export async function writeSettings(
  env: Env,
  patch: Partial<Settings>
): Promise<Settings> {
  const next = {...(await readSettings(env)), ...patch, version: 1 as const}
  await env.local.set('settings', next)
  return next
}
