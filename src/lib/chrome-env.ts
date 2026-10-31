import {ext} from './api'
import {SCAN_KEY, type Env, type Store} from './env'
import {scanOverlay} from './scan-overlay'

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
  openOptions: () => ext.runtime.openOptionsPage(),
  startScan: async () => {
    const [tab] = await ext.tabs.query({active: true, currentWindow: true})
    if (!tab?.id) return {ok: false, reason: 'No active tab.'}

    try {
      // MV3 injects a function; MV2 only takes source text.
      if (ext.scripting?.executeScript) {
        await ext.scripting.executeScript({target: {tabId: tab.id}, func: scanOverlay})
      } else {
        await ext.tabs.executeScript(tab.id, {
          code: `(${scanOverlay.toString()})()`
        })
      }
      return {ok: true}
    } catch {
      return {
        ok: false,
        reason: 'This page cannot be scanned. Open a regular web page and try again.'
      }
    }
  },
  takeScannedLink: async () => {
    const local = toStore(ext.storage.local)
    const link = await local.get<string>(SCAN_KEY)
    if (typeof link === 'string') await local.remove(SCAN_KEY)
    return typeof link === 'string' ? link : undefined
  }
}
