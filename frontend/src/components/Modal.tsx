import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  children: ReactNode
  className?: string
  overlayClassName?: string
}

export default function Modal({ open, children, className, overlayClassName }: ModalProps) {
  if (!open) return null
  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm', overlayClassName)}>
      <div className={cn('bg-card border border-border w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-4', className)}>
        {children}
      </div>
    </div>
  )
}
