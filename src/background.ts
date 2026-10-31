import {ext} from './lib/api'
import {parseOtpAuth} from './lib/otpauth'
import {SCAN_KEY} from './lib/env'
import {readQr, type ScanRect, type ScanViewport} from './lib/scan'

type ScanMessage = {
  type: 'authentia:scan'
  rect: ScanRect
  viewport: ScanViewport
}

type ScanReply = {ok: true} | {ok: false; reason: string}

const isScan = (message: unknown): message is ScanMessage =>
  typeof message === 'object' &&
  message !== null &&
  (message as ScanMessage).type === 'authentia:scan'

/**
 * Captures the visible tab after the page overlay hid itself, crops to the
 * dragged box and hands the decoded `otpauth://` link to the popup. The popup
 * parses it; the background never touches the vault.
 */
async function scan(message: ScanMessage, sender: chrome.runtime.MessageSender) {
  const windowId = sender.tab?.windowId
  if (windowId === undefined) return {ok: false, reason: 'No active tab.'} as ScanReply

  let dataUrl: string
  try {
    dataUrl = await ext.tabs.captureVisibleTab(windowId, {format: 'png'})
  } catch {
    return {
      ok: false,
      reason: 'This browser will not capture this page.'
    } as ScanReply
  }

  const link = await readQr(dataUrl, message.rect, message.viewport)
  if (!link) {
    return {
      ok: false,
      reason: 'No QR code in that frame. Drag a tighter box around it.'
    } as ScanReply
  }

  try {
    parseOtpAuth(link)
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'That QR code is not an authenticator setup link.'
    } as ScanReply
  }

  await ext.storage.local.set({[SCAN_KEY]: link})
  return {ok: true} as ScanReply
}

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isScan(message)) return false

  void scan(message, sender)
    .catch(
      () =>
        ({
          ok: false,
          reason: 'The screen could not be read. Try again.'
        }) as ScanReply
    )
    .then(sendResponse)

  return true
})
