import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/contexts/AuthContext'
import Home from '@/pages/Home'
import Editor from '@/pages/Editor'
import Dashboard from '@/pages/Dashboard'
import Profile from '@/pages/Profile'
import AI from '@/pages/AI'
import CoverLetterEditor from '@/pages/CoverLetterEditor'
import Settings from '@/pages/Settings'
import NotFound from '@/pages/NotFound'
import AuthModal from '@/components/AuthModal'
import ErrorBoundary from '@/components/ErrorBoundary'
import EmailVerificationBanner from '@/components/EmailVerificationBanner'
import { Toaster } from '@/components/ui/sonner'

function AppRoutes() {
  return (
    <>
      <EmailVerificationBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/ai" element={<AI />} />
        <Route path="/cover-letter/new" element={<CoverLetterEditor />} />
        <Route path="/cover-letter/:id" element={<CoverLetterEditor />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <AuthModal />
      <Toaster position="bottom-right" />
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
