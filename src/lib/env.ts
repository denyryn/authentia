export type Store = {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}

/**
 * The single seam every page is composed with: storage, time and the two
 * browser effects. Tests inject an in-memory implementation; the extension
 * injects the Chrome/Firefox one.
 */
export type Env = {
  local: Store
  session: Store
  now(): number
  fetch: typeof fetch
  copy(text: string): Promise<void>
  openOptions(): void
}
