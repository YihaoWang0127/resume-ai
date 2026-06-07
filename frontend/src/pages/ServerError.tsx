import { useNavigate } from 'react-router-dom'

export default function ServerError() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
      <p className="text-9xl font-bold text-red-500 leading-none">500</p>
      <h1 className="mt-4 text-2xl font-semibold text-foreground">Something Went Wrong</h1>
      <p className="mt-3 text-muted-foreground max-w-sm">
        An unexpected error occurred. Try refreshing the page or go back home.
      </p>
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-primary text-primary-foreground font-bold text-sm tracking-widest hover:bg-primary/90 transition-colors"
        >
          ← BACK TO HOME
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 border border-foreground text-foreground font-bold text-sm tracking-widest hover:bg-foreground hover:text-background transition-colors"
        >
          TRY AGAIN
        </button>
      </div>
    </div>
  )
}
