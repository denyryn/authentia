import type {CSSProperties} from 'react'

type CountdownRuleProps = {
  remainingMs: number
  periodMs: number
}

/**
 * The countdown is the code's underline: a 2px rule draining right to left.
 * The animation is restarted per time step by the caller's `key`; the negative
 * delay lands it at the right fraction when a row mounts mid-period.
 */
export function CountdownRule({remainingMs, periodMs}: CountdownRuleProps) {
  const fraction = Math.min(1, Math.max(0, remainingMs / periodMs))
  const urgent = remainingMs < 5000

  return (
    <span
      className="countdown-rule"
      data-urgent={urgent || undefined}
      aria-hidden="true"
    >
      <span
        className="countdown-rule-fill"
        style={
          {
            '--drain-fraction': fraction,
            '--drain-elapsed': `${periodMs - remainingMs}ms`,
            '--drain-duration': `${periodMs}ms`
          } as CSSProperties
        }
      />
    </span>
  )
}
