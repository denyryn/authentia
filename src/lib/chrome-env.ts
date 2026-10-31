import {ext} from './api'
import type {Env, Store} from './env'

const toStore = (area: chrome.storage.StorageArea): Store => ({
  async get<T>(key: string) {
    const result = await area.get(key)
    return result[key] as T | undefined
  },
  async set(key, value) {
    await area.set({[key]: value})
  },
  async remove(key) {
    await area.remove(key)
  }
})

// MV3 has a real session area that dies with the browser; MV2 (Firefox) has
// none, so the unlock key goes to local storage, still bounded by its own
// expiresAt inside the vault module.
const sessionArea = (ext.storage as {session?: chrome.storage.StorageArea})
  .session

export const env: Env = {
  local: toStore(ext.storage.local),
  session: toStore(sessionArea ?? ext.storage.local),
  now: () => Date.now(),
  fetch: (input, init) => fetch(input, init),
  copy: (text) => navigator.clipboard.writeText(text),
  openOptions: () => ext.runtime.openOptionsPage()
}
