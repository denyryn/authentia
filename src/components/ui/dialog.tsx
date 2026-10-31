import {useEffect, useId, useRef, type ReactNode} from 'react'

type DialogProps = {
  open: boolean
  onClose(): void
  title: string
  description?: string
  children?: ReactNode
  footer: ReactNode
  /** `field` opens with the first input focused; the default lands on Cancel. */
  initialFocus?: 'footer' | 'field'
}

/**
 * Native `<dialog>`: the browser provides the focus trap, Escape, the top layer
 * and the inert page behind it. Only the visuals are ours.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  initialFocus = 'footer'
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
      // Destructive dialogs land on the safe action; a form dialog lands on its
      // first field.
      const target =
        initialFocus === 'field'
          ? dialog.querySelector<HTMLElement>('.dialog-body input, .dialog-body textarea')
          : dialog.querySelector<HTMLElement>('.dialog-actions button, .dialog-actions a')
      ;(target ?? dialog).focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, initialFocus])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="dialog-body">
          <h2 id={titleId} className="dialog-title">
            {title}
          </h2>
          {description && <p className="dialog-text">{description}</p>}
          {children}
          <div className="dialog-actions">{footer}</div>
        </div>
      )}
    </dialog>
  )
}
