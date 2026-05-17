import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', loading, disabled, children, ...props }, ref) => {
    const variants = {
      default: 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]',
      outline: 'border border-[#1A1A24] bg-transparent hover:bg-[#1A1A24] text-[#F4F4F5]',
      ghost: 'bg-transparent hover:bg-[#1A1A24] text-[#F4F4F5]',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
    }
    const sizes = {
      sm: 'h-8 px-3 text-xs rounded-md',
      md: 'h-9 px-4 text-sm rounded-lg',
      lg: 'h-11 px-6 text-base rounded-lg',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
          variants[variant], sizes[size], className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
