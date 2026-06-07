import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Sidebar from './components/layout/Sidebar'
import Navbar from './components/layout/Navbar'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Connections from './pages/Connections'
import Resources from './pages/Resources'
import Alerts from './pages/Alerts'
import SavingsReport from './pages/SavingsReport'
import Compare from './pages/Compare'
import Pricing from './pages/Pricing'
import Settings from './pages/Settings'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import ChatWidget from './components/ChatWidget'
import OnboardingTour from './components/OnboardingTour'
import LoadingSpinner from './components/shared/LoadingSpinner'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0B1220]"><LoadingSpinner size="lg" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0B1220]"><LoadingSpinner size="lg" /></div>
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#0B1220]">
      <Sidebar />
      <Navbar />
      <main className="ml-60 pt-14 p-6">
        {children}
      </main>
      <ChatWidget />
      <OnboardingTour />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <AppLayout><Dashboard /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/resources" element={
        <ProtectedRoute>
          <AppLayout><Resources /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/connections" element={
        <ProtectedRoute>
          <AppLayout><Connections /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/alerts" element={
        <ProtectedRoute>
          <AppLayout><Alerts /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/savings-report" element={
        <ProtectedRoute>
          <AppLayout><SavingsReport /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/compare" element={
        <ProtectedRoute>
          <AppLayout><Compare /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout><Settings /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
