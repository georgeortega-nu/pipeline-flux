import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full border border-border bg-transparent px-2 font-mono text-[11px] tracking-wide text-foreground placeholder:text-muted-foreground/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
