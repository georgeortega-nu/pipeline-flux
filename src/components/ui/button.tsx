import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-gauge transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default: 'border border-border bg-secondary text-secondary-foreground hover:border-primary/60 hover:text-primary',
        primary: 'border border-primary/70 bg-primary/15 text-primary hover:bg-primary/25',
        ghost: 'border border-transparent text-muted-foreground hover:border-border hover:text-foreground',
        danger: 'border border-border text-muted-foreground hover:border-destructive/70 hover:text-destructive-foreground',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2',
        icon: 'h-8 w-8',
        wide: 'h-9 flex-1 px-3',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
