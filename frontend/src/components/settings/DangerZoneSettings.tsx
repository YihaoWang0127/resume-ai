import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Modal from '@/components/Modal'

export default function DangerZoneSettings() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.rpc('delete_user_account')
      if (error) throw error
      await signOut()
      closeDeleteModal()
      toast.success('Your account has been deleted.')
      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setConfirmText('')
  }

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Permanently delete your account and all associated data.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This will permanently delete your resumes, cover letters, and preferences. This action cannot be undone.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="destructive" onClick={() => setDeleteModalOpen(true)} className="min-h-[44px]">
            Delete Account
          </Button>
        </CardFooter>
      </Card>

      <Modal open={deleteModalOpen} overlayClassName="bg-black/60 px-4" className="max-w-md rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Delete Account</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          This will permanently delete your account and all data. This cannot be undone. Type{' '}
          <span className="font-bold text-foreground">DELETE</span> to confirm.
        </p>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="mb-4" autoFocus />
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 min-h-[44px]" onClick={closeDeleteModal} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" className="flex-1 min-h-[44px]" onClick={handleDeleteAccount} disabled={confirmText !== 'DELETE' || deleting}>
            {deleting && <Loader2 className="size-3.5 animate-spin" />}
            Delete Account
          </Button>
        </div>
      </Modal>
    </>
  )
}
