type ScanReply = {ok: true} | {ok: false; reason: string}

/**
 * Runs in the page (injected, never bundled as a content script). Draws the
 * selection layer, hides itself so the capture is of the page alone, then asks
 * the background to read the box. Self-contained on purpose: it is serialised
 * with `Function.prototype.toString`, so it may not close over anything.
 */
export function scanOverlay() {
  const HOST = 'authentia-scan'
  if (document.getElementById(HOST)) return

  const host = document.createElement('div')
  host.id = HOST
  host.setAttribute('style', 'all:initial;position:fixed;inset:0;z-index:2147483647')

  const root = host.attachShadow({mode: 'open'})
  root.innerHTML = `
    <style>
      .wrap { position: fixed; inset: 0; cursor: crosshair; background: rgba(20, 18, 15, 0.28) }
      .frame { position: fixed; border: 2px solid #f9f5ef; outline: 2px solid #221d18 }
      .hint { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
              max-width: min(80vw, 32rem); padding: 8px 12px; border-radius: 8px;
              background: #221d18; color: #f9f5ef; text-align: center;
              font: 500 13px/1.4 system-ui, sans-serif }
      .hint[data-tone="error"] { background: #7c2d26 }
      [hidden] { display: none }
    </style>
    <div class="wrap"></div>
    <div class="frame" hidden></div>
    <div class="hint">Drag a box around the QR code · Esc to cancel</div>
  `

  const wrap = root.querySelector('.wrap') as HTMLDivElement
  const frame = root.querySelector('.frame') as HTMLDivElement
  const hint = root.querySelector('.hint') as HTMLDivElement

  let start: {x: number; y: number} | null = null
  let box: {x: number; y: number; width: number; height: number} | null = null

  const say = (text: string, tone: 'info' | 'error' = 'info') => {
    hint.textContent = text
    hint.dataset.tone = tone
  }

  const destroy = () => {
    window.removeEventListener('keydown', onKey, true)
    host.remove()
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      destroy()
    }
  }

  const draw = () => {
    if (!box) return
    const style = frame.style
    style.left = `${box.x}px`
    style.top = `${box.y}px`
    style.width = `${box.width}px`
    style.height = `${box.height}px`
  }

  const finish = () => {
    host.style.display = ''
    wrap.hidden = true
    frame.hidden = true
    say('QR read — open authentia to save the account.')
    window.setTimeout(destroy, 2000)
  }

  const send = () => {
    if (!box) return
    const selection = box
    const viewport = {width: window.innerWidth, height: window.innerHeight}

    // The layer must be off screen before the tab is captured.
    host.style.display = 'none'
    window.setTimeout(() => {
      chrome.runtime.sendMessage(
        {type: 'authentia:scan', rect: selection, viewport},
        (reply: ScanReply) => {
          if (chrome.runtime.lastError || !reply || !reply.ok) {
            host.style.display = ''
            say(
              reply && !reply.ok
                ? reply.reason
                : 'The QR code could not be read. Try again.',
              'error'
            )
            return
          }
          finish()
        }
      )
    }, 80)
  }

  wrap.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    start = {x: event.clientX, y: event.clientY}
    box = {x: start.x, y: start.y, width: 0, height: 0}
    frame.hidden = false
    draw()
    wrap.setPointerCapture(event.pointerId)
  })

  wrap.addEventListener('pointermove', (event) => {
    if (!start || !box) return
    box = {
      x: Math.min(start.x, event.clientX),
      y: Math.min(start.y, event.clientY),
      width: Math.abs(event.clientX - start.x),
      height: Math.abs(event.clientY - start.y)
    }
    draw()
  })

  wrap.addEventListener('pointerup', () => {
    start = null
    if (!box) return
    if (box.width < 24 || box.height < 24) {
      say('Drag a larger box around the code.', 'error')
      return
    }
    say('Reading the QR code…')
    send()
  })

  window.addEventListener('keydown', onKey, true)
  document.documentElement.append(host)
}
