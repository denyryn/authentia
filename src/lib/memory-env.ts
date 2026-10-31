import type {Env, Store} from './env'

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
    openOptions: () => {}
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
