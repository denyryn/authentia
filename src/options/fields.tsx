import {useId, type ComponentProps, type ReactNode} from 'react'

import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'

export type Feedback = {tone: 'ok' | 'error' | 'busy'; text: string} | null

export const describe = (failure: unknown, fallback: string) =>
  failure instanceof Error && failure.message ? failure.message : fallback

/** App controls are 32 to 40px tall; the pseudo-element restores the 44px target. */
const ring =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

const hit = 'relative after:absolute after:-inset-1 after:content-[""]'

export const controlClass =
  'h-9 rounded-md border border-input bg-card px-(--space-sm) text-(length:--text-md) text-foreground transition-colors duration-(--dur-micro) ease-(--ease-out) hover:bg-(--paper-2) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-card'

type ButtonProps = ComponentProps<typeof Button>

export function PrimaryButton({className, ...props}: ButtonProps) {
  return (
    <Button
      className={cn(hit, ring, 'active:translate-y-px', className)}
      {...props}
    />
  )
}

export function QuietButton({className, ...props}: ButtonProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        hit,
        ring,
        'border border-input bg-transparent text-foreground hover:bg-(--paper-2) active:translate-y-px disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
}

export function DangerButton({className, ...props}: ButtonProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        hit,
        ring,
        'border border-destructive bg-transparent text-destructive hover:bg-(--paper-2) active:translate-y-px disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
}

type FieldProps = {
  label: ReactNode
  value: string
  onChange(value: string): void
  hint?: string
  error?: string | null
  type?: 'text' | 'password'
  autoComplete?: string
  spellCheck?: boolean
  disabled?: boolean
  className?: string
}

export function Field({
  label,
  value,
  onChange,
  hint,
  error,
  type = 'text',
  autoComplete,
  spellCheck,
  disabled,
  className
}: FieldProps) {
  const id = useId()
  const noteId = `${id}-note`

  return (
    <div className={cn('flex min-w-0 flex-col gap-(--space-2xs)', className)}>
      <label
        htmlFor={id}
        className="text-(length:--text-base) font-medium text-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? noteId : undefined}
        className={cn('w-full', controlClass, error && 'border-destructive')}
      />
      <p
        id={noteId}
        className={cn(
          'min-h-[1lh] text-(length:--text-base) leading-[1.45]',
          error ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {error ?? hint ?? ''}
      </p>
    </div>
  )
}

type AreaProps = {
  label: string
  value: string
  onChange?(value: string): void
  hint?: string
  error?: string | null
  readOnly?: boolean
  rows?: number
  selectOnFocus?: boolean
  action?: ReactNode
  className?: string
}

export function Area({
  label,
  value,
  onChange,
  hint,
  error,
  readOnly,
  rows = 6,
  selectOnFocus,
  action,
  className
}: AreaProps) {
  const id = useId()
  const noteId = `${id}-note`

  return (
    <div className={cn('flex min-w-0 flex-col gap-(--space-2xs)', className)}>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-(--space-xs)">
        <label
          htmlFor={id}
          className="text-(length:--text-base) font-medium text-foreground"
        >
          {label}
        </label>
        {action}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={readOnly}
        rows={rows}
        spellCheck={false}
        onFocus={
          selectOnFocus ? (event) => event.currentTarget.select() : undefined
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? noteId : undefined}
        className={cn(
          'min-h-[6rem] w-full resize-y rounded-md border border-input bg-card p-(--space-sm) font-mono text-(length:--text-base) leading-[1.5] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55',
          error && 'border-destructive'
        )}
      />
      <p
        id={noteId}
        className={cn(
          'min-h-[1lh] text-(length:--text-base) leading-[1.45]',
          error ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {error ?? hint ?? ''}
      </p>
    </div>
  )
}

export function Well({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg bg-(--paper-2) p-(--space-sm) sm:p-(--space-md)',
        className
      )}
    >
      {children}
    </div>
  )
}

type ChipTone = 'quiet' | 'on' | 'alert'

const chipTone: Record<ChipTone, string> = {
  quiet: 'border-border text-muted-foreground',
  on: 'border-input text-foreground',
  alert: 'border-border text-destructive'
}

export function Section({
  title,
  chip,
  tone = 'quiet',
  description,
  children
}: {
  title: string
  chip: string
  tone?: ChipTone
  description: string
  children: ReactNode
}) {
  const id = useId()

  return (
    <section aria-labelledby={id} className="py-(--space-xl)">
      <div className="flex items-baseline justify-between gap-(--space-md)">
        <h2
          id={id}
          className="text-(length:--text-lg) font-semibold tracking-[-0.01em] text-foreground"
        >
          {title}
        </h2>
        <span
          className={cn(
            'shrink-0 rounded-full border px-(--space-xs) py-(--space-3xs) text-(length:--text-xs) tabular-nums',
            chipTone[tone]
          )}
        >
          {chip}
        </span>
      </div>
      <p className="mt-(--space-xs) max-w-[60ch] text-(length:--text-md) leading-[1.55] text-muted-foreground">
        {description}
      </p>
      <div className="mt-(--space-lg)">{children}</div>
    </section>
  )
}

export function FeedbackLine({
  feedback,
  className
}: {
  feedback: Feedback
  className?: string
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'min-h-[1lh] text-(length:--text-base) leading-[1.45]',
        feedback?.tone === 'error'
          ? 'text-destructive'
          : feedback?.tone === 'busy'
            ? 'text-muted-foreground'
            : 'text-foreground',
        className
      )}
    >
      {feedback?.text ?? ''}
    </p>
  )
}
