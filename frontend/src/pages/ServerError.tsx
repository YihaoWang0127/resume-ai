import { useNavigate } from 'react-router-dom'

export default function ServerError() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-center px-4">
      <p className="text-9xl font-bold text-red-500 leading-none">500</p>
      <h1 className="mt-4 text-2xl font-semibold text-white">Something Went Wrong</h1>
      <p className="mt-3 text-gray-400 max-w-sm">
        An unexpected error occurred. Try refreshing the page or go back home.
      </p>
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-[#00FF87] text-black font-bold text-sm tracking-widest hover:bg-[#00e07a] transition-colors"
        >
          ← BACK TO HOME
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 border border-white text-white font-bold text-sm tracking-widest hover:bg-white hover:text-black transition-colors"
        >
          TRY AGAIN
        </button>
      </div>
    </div>
  )
}
