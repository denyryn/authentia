import {useId, useRef} from 'react'

import {cn} from '@/lib/utils'

type Tab = {value: string; label: string}

/**
 * Segmented tabs, shadcn-shaped: one selected trigger, arrow keys move between
 * them, and the caller renders the matching `role="tabpanel"` region.
 */
export function Tabs({
  label,
  value,
  items,
  onChange
}: {
  label: string
  value: string
  items: Tab[]
  onChange(value: string): void
}) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const move = (direction: 1 | -1) => {
    const index = items.findIndex((item) => item.value === value)
    const next = (index + direction + items.length) % items.length
    onChange(items[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex w-full gap-(--space-3xs) rounded-md border border-input bg-(--paper-2) p-(--space-3xs)"
    >
      {items.map((item, index) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            id={`${id}-${item.value}-tab`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${id}-${item.value}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault()
                move(1)
              }
              if (event.key === 'ArrowLeft') {
                event.preventDefault()
                move(-1)
              }
            }}
            className={cn(
              'h-8 flex-1 rounded-sm px-(--space-sm) text-(length:--text-base) transition-colors duration-(--dur-micro) ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'border border-border bg-card font-medium text-foreground'
                : 'border border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
