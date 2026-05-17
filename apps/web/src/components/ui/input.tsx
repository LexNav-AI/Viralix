import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full h-9 px-3 text-sm rounded-lg bg-[#09090B] border border-[#1A1A24] text-[#F4F4F5]',
        'placeholder:text-[#8B8BA0] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] transition',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
