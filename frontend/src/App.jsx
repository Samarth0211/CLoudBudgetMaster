import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Sidebar from './components/layout/Sidebar'
import Navbar from './components/layout/Navbar'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Connections from './pages/Connections'
import Resources from './pages/Resources'
import Alerts from './pages/Alerts'
import SavingsReport from './pages/SavingsReport'
import Compare from './pages/Compare'
import ChatWidget from './components/ChatWidget'
import OnboardingTour from './components/OnboardingTour'
import LoadingSpinner from './components/shared/LoadingSpinner'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner size="lg" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#0B0F1A]">
      <Sidebar />
      <Navbar />
      <main className="ml-64 pt-16 p-6">
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
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
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
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout><div className="text-slate-500">Settings — coming soon</div></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
