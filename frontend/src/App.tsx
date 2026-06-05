import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import Home from '@/pages/Home'
import Auth from '@/pages/Auth'
import Editor from '@/pages/Editor'

function RootRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Home /> : <Auth />
}

function AuthRoute() {
  const { user, isGuest, loading } = useAuth()
  if (loading) return null
  // Guests are allowed to visit /auth so they can sign up with email.
  // Only redirect away if there's a real (non-anonymous) session.
  return (user && !isGuest) ? <Navigate to="/" replace /> : <Auth />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/auth" element={<AuthRoute />} />
      <Route path="/editor" element={<Editor />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
