import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
      <p className="text-9xl font-bold text-primary leading-none">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-foreground">Page Not Found</h1>
      <p className="mt-3 text-muted-foreground max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button
        onClick={() => navigate('/')}
        className="mt-8 px-6 py-3 bg-primary text-primary-foreground font-bold text-sm tracking-widest hover:bg-primary/90 transition-colors"
      >
        ← BACK TO HOME
      </button>
    </div>
  )
}
