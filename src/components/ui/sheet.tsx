import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetTitle = DialogPrimitive.Title
const SheetDescription = DialogPrimitive.Description

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/70 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'panel fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto border-t border-border pb-[env(safe-area-inset-bottom)] data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in',
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-2 h-1 w-9 bg-border" aria-hidden="true" />
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 border border-transparent p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <X className="h-4 w-4" />
        <span className="sr-only">Close controls</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger }
