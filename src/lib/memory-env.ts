import {SCAN_KEY, type Env, type Store} from './env'

type Memory = {local: Map<string, unknown>; session: Map<string, unknown>}

const store = (memory: Map<string, unknown>): Store => ({
  async get<T>(key: string) {
    return memory.has(key) ? (structuredClone(memory.get(key)) as T) : undefined
  },
  async set(key, value) {
    memory.set(key, structuredClone(value))
  },
  async remove(key) {
    memory.delete(key)
  }
})

/** In-memory Env for tests: same seam the pages are composed with. */
export function createMemoryEnv(startAt = 0) {
  let now = startAt
  const memory: Memory = {local: new Map(), session: new Map()}

  const env: Env = {
    local: store(memory.local),
    session: store(memory.session),
    now: () => now,
    fetch: (() => {
      throw new Error('fetch is not stubbed in this test')
    }) as unknown as typeof fetch,
    copy: async () => {},
    openOptions: () => {},
    startScan: async () => ({
      ok: false,
      reason: 'Scanning needs the extension.'
    }),
    takeScannedLink: async () => {
      const link = memory.local.get(SCAN_KEY)
      memory.local.delete(SCAN_KEY)
      return typeof link === 'string' ? link : undefined
    }
  }

  return {
    env,
    advance(ms: number) {
      now += ms
    },
    setNow(value: number) {
      now = value
    }
  }
}
