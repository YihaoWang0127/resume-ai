import Modal from '@/components/Modal'

interface QuotaExceededModalProps {
  open: boolean
  onClose: () => void
}

export default function QuotaExceededModal({ open, onClose }: QuotaExceededModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="rounded-xl p-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Monthly Limit Reached</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You've used all 30 of your free AI calls this month. Your quota resets on the 1st of each month.
          </p>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  )
}
