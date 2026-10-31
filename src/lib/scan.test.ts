import {describe, expect, it} from 'vitest'

import {cropRect} from './scan'

const viewport = {width: 1200, height: 800}

describe('cropRect', () => {
  it('scales a CSS selection to device pixels', () => {
    expect(
      cropRect({x: 100, y: 50, width: 200, height: 100}, viewport, {
        width: 2400,
        height: 1600
      })
    ).toEqual({x: 200, y: 100, width: 400, height: 200})
  })

  it('keeps 1:1 frames untouched', () => {
    expect(
      cropRect({x: 10, y: 20, width: 30, height: 40}, viewport, viewport)
    ).toEqual({x: 10, y: 20, width: 30, height: 40})
  })

  it('clamps a selection that runs past the captured frame', () => {
    expect(
      cropRect({x: 1100, y: 700, width: 300, height: 300}, viewport, {
        width: 1200,
        height: 800
      })
    ).toEqual({x: 1100, y: 700, width: 100, height: 100})
  })

  it('never returns a zero-size box', () => {
    const box = cropRect({x: 2000, y: 2000, width: 10, height: 10}, viewport, {
      width: 1200,
      height: 800
    })
    expect(box.width).toBeGreaterThanOrEqual(1)
    expect(box.height).toBeGreaterThanOrEqual(1)
  })
})
