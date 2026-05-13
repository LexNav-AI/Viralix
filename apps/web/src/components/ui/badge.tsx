import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--accent-foreground))] border border-[hsl(var(--primary)/0.3)]',
        secondary:
          'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border border-[hsl(var(--border))]',
        outline:
          'border border-[hsl(var(--border))] text-[hsl(var(--foreground))] bg-transparent',
        success:
          'bg-[hsl(142,71%,45%,0.15)] text-[hsl(142,71%,55%)] border border-[hsl(142,71%,45%,0.3)]',
        warning:
          'bg-[hsl(38,92%,50%,0.15)] text-[hsl(38,92%,60%)] border border-[hsl(38,92%,50%,0.3)]',
        destructive:
          'bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))] border border-[hsl(var(--destructive)/0.3)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
