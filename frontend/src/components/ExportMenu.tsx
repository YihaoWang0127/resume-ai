import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ExportMenuProps {
  children: ReactNode
  align?: 'left' | 'right' | 'center'
  side?: 'top' | 'bottom'
  rounded?: 'none' | 'sm' | 'lg'
  className?: string
}

export default function ExportMenu({ children, align = 'right', side = 'bottom', rounded = 'lg', className }: ExportMenuProps) {
  return (
    <div
      className={cn(
        'absolute z-50 bg-card border border-border py-1 shadow-dropdown',
        side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-2',
        align === 'right' && 'right-0',
        align === 'left' && 'left-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        rounded === 'lg' && 'rounded-lg',
        rounded === 'sm' && 'rounded',
        className,
      )}
    >
      {children}
    </div>
  )
}
