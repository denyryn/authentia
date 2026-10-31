import {cva, type VariantProps} from 'class-variance-authority'
import * as React from 'react'

import {cn} from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-(--space-2xs) whitespace-nowrap rounded-md font-medium transition-colors duration-(--dur-micro) ease-(--ease-out) active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'text-foreground hover:bg-secondary',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      },
      size: {
        default:
          'h-9 min-w-28 px-(--space-sm) text-(length:--text-base)',
        sm: 'h-8 px-(--space-xs) text-(length:--text-sm)',
        icon: 'relative size-8 after:absolute after:-inset-1.5 after:content-[""]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

type ButtonProps = Omit<React.ComponentProps<'button'>, 'ref'> &
  VariantProps<typeof buttonVariants>

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({className, variant, size, ...props}, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({variant, size}), className)}
      {...props}
    />
  )
)

Button.displayName = 'Button'

export {Button, buttonVariants}
