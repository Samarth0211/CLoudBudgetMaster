import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { ConnectionFilterProvider } from './hooks/useConnectionFilter'
import Sidebar from './components/layout/Sidebar'
import Navbar from './components/layout/Navbar'
import LandingPage from './pages/LandingPage'
import NsHome from './pages/NsHome'
import NsProducts from './pages/NsProducts'
import NsHealthCheck from './pages/NsHealthCheck'
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
import BlogAdmin from './pages/BlogAdmin'
import AdminUsers from './pages/AdminUsers'
import Security from './pages/Security'
import About from './pages/About'
import Contact from './pages/Contact'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import AwsWasteFinder from './pages/AwsWasteFinder'
import VsPage from './pages/VsPage'
import Ops from './pages/Ops'
import ChatWidget from './components/ChatWidget'
import OnboardingTour from './components/OnboardingTour'
import LoadingSpinner from './components/shared/LoadingSpinner'
import NoIndex from './components/shared/NoIndex'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0B1220]"><LoadingSpinner size="lg" /></div>
  if (!user) return <Navigate to="/login" replace />
  return <><NoIndex />{children}</>
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0B1220]"><LoadingSpinner size="lg" /></div>
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function AppLayout({ children }) {
  const [navOpen, setNavOpen] = useState(false)
  return (
    <ConnectionFilterProvider>
      <div className="min-h-screen bg-[#0B1220]">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        {navOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setNavOpen(false)} aria-hidden />}
        <Navbar onMenu={() => setNavOpen(true)} />
        <main className="md:ml-60 px-4 sm:px-6 pt-20 pb-10">
          {children}
        </main>
        <ChatWidget />
        <OnboardingTour />
      </div>
    </ConnectionFilterProvider>
  )
}

export default function App() {
  return (
    <Routes>
      {/* No-signup AWS bill-audit pivot: new public homepage + product pages
          (Fable design handoff). Not gated by PublicRoute -- these are
          marketing pages, not the auth landing, so a logged-in user browsing
          / or /products should still see them, not get bounced to /dashboard. */}
      <Route path="/" element={<NsHome />} />
      <Route path="/products" element={<NsProducts />} />
      <Route path="/health-check" element={<NsHealthCheck />} />
      <Route path="/landing-legacy" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><NoIndex /><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><NoIndex /><Register /></PublicRoute>} />
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
      <Route path="/tools/aws-waste-finder" element={<AwsWasteFinder />} />
      <Route path="/vs/:slug" element={<VsPage />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/ops" element={<><NoIndex /><Ops /></>} />
      <Route path="/security" element={<Security />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout><Settings /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute>
          <AppLayout><AdminUsers /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/blog" element={
        <ProtectedRoute>
          <AppLayout><BlogAdmin /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
