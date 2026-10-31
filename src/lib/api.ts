/**
 * Firefox exposes `browser`, Chromium exposes `chrome`. Promise-returning
 * calls work on both (Firefox's `browser` is promise-native, Chromium's
 * `chrome` returns promises in MV3), so one handle is enough.
 */
export const ext: typeof chrome =
  (globalThis as {browser?: typeof chrome}).browser ?? chrome
