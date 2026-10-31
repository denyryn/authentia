// @vitest-environment jsdom
import {cleanup, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {useState} from 'react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {PasscodeInput} from './passcode-input'

afterEach(cleanup)

function Harness({onComplete}: {onComplete?: (value: string) => void}) {
  const [value, setValue] = useState('')
  return (
    <PasscodeInput value={value} onChange={setValue} onComplete={onComplete} />
  )
}

const boxes = () =>
  screen.getAllByRole('textbox') as HTMLInputElement[]

const values = () => boxes().map((box) => box.value)

describe('PasscodeInput', () => {
  it('advances while typing and completes at six digits', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)

    await user.click(boxes()[0])
    await user.keyboard('123456')

    expect(values()).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('moves back on backspace', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(boxes()[0])
    await user.keyboard('123')
    expect(document.activeElement).toBe(boxes()[3])

    await user.keyboard('{Backspace}')

    expect(document.activeElement).toBe(boxes()[2])
    expect(values()).toEqual(['1', '2', '', '', '', ''])
  })

  it('distributes a pasted six-digit code', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(boxes()[0])
    await user.paste('123456')

    expect(values()).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('moves focus with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(boxes()[2])
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(boxes()[1])

    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(boxes()[2])
  })
})
