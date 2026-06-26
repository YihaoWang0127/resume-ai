import { Plus, type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 border-2 border-dashed border-border rounded-xl bg-card/40">
      <div className="size-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
        <Icon className="size-5 text-primary" />
      </div>
      <p className="font-bold text-foreground text-sm uppercase tracking-wide mb-1.5">{title}</p>
      <p className="text-xs text-muted-foreground max-w-sm mb-5">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Plus className="size-3.5" />
        {actionLabel}
      </button>
    </div>
  )
}
