import jsQR from 'jsqr'

export type ScanRect = {x: number; y: number; width: number; height: number}
export type ScanViewport = {width: number; height: number}

/**
 * A selection is in CSS pixels; the captured frame is in device pixels and may
 * be clipped to the window, so map through the frame/viewport ratio.
 */
export function cropRect(
  rect: ScanRect,
  viewport: ScanViewport,
  frame: ScanViewport
) {
  const scale = viewport.width > 0 ? frame.width / viewport.width : 1
  const x = Math.min(frame.width - 1, Math.max(0, Math.round(rect.x * scale)))
  const y = Math.min(frame.height - 1, Math.max(0, Math.round(rect.y * scale)))
  return {
    x,
    y,
    width: Math.max(1, Math.min(frame.width - x, Math.round(rect.width * scale))),
    height: Math.max(
      1,
      Math.min(frame.height - y, Math.round(rect.height * scale))
    )
  }
}

const canvasOf = (width: number, height: number) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/** Reads the QR text inside the selection, or `null` when there is none. */
export async function readQr(
  dataUrl: string,
  rect: ScanRect,
  viewport: ScanViewport
): Promise<string | null> {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob())
  const box = cropRect(rect, viewport, {
    width: bitmap.width,
    height: bitmap.height
  })

  const canvas = canvasOf(box.width, box.height)
  const context = canvas.getContext('2d')
  if (!context) return null

  context.drawImage(
    bitmap,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    box.width,
    box.height
  )
  bitmap.close()

  const {data} = context.getImageData(0, 0, box.width, box.height)
  return jsQR(data, box.width, box.height, {inversionAttempts: 'attemptBoth'})
    ?.data ?? null
}
