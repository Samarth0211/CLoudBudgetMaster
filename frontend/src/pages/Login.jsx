import { useState } from 'react'
import BrandLogo from '../components/shared/BrandLogo'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetStep, setResetStep] = useState('none') // 'none' | 'email' | 'code' | 'done'
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.status === 429
        ? 'Too many attempts. Please wait a minute and try again.'
        : (err.response?.data?.detail || 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSendResetCode = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setResetStep('code')
    } catch (err) {
      setError(err.response?.status === 429
        ? 'Too many requests. Please wait a minute before requesting another code.'
        : (err.response?.data?.detail || 'Failed to send reset email'))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { email, code: resetCode, new_password: newPassword })
      setResetStep('done')
    } catch (err) {
      setError(err.response?.status === 429
        ? 'Too many attempts. Please wait a minute and try again.'
        : (err.response?.data?.detail || 'Failed to reset password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="surface-dark hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-[#16213a] via-[#0d1426] to-[#0B1220] p-12 text-white relative overflow-hidden">
        <div className="absolute top-20 -right-20 h-64 w-64 rounded-full bg-[#FF9900]/10 blur-3xl" />
        <div className="absolute bottom-20 -left-20 h-48 w-48 rounded-full bg-[#FF9900]/5 blur-3xl" />

        <div className="relative">
          <Link to="/" className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10" />
            <span className="text-2xl font-bold tracking-tight">CloudBudgetMaster</span>
          </Link>
          <p className="mt-2 text-sm text-indigo-200">Multi-cloud cost intelligence</p>
        </div>

        <div className="relative space-y-8">
          <h2 className="text-3xl font-bold leading-tight">Stop burning<br />cloud money.</h2>
          <p className="text-lg text-indigo-100 leading-relaxed">
            Find forgotten EC2 instances, idle RDS databases, and orphaned EBS volumes — before they become a surprise on your next bill.
          </p>
        </div>

        <div className="relative flex items-center gap-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <span className="text-xs text-indigo-200">AES-256 encrypted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            <span className="text-xs text-indigo-200">Read-only access</span>
          </div>
        </div>
      </div>

      {/* Right panel — form with animated background */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center bg-[#0B1220] px-6 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 auth-grid" />
        <div className="absolute inset-0 auth-glow" />
        <div className="auth-orb-1" />
        <div className="auth-orb-2" />

        <div className="relative w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden flex items-center justify-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo className="h-9 w-9" />
              <span className="text-xl font-bold text-white">CloudBudgetMaster</span>
            </Link>
          </div>

          {resetStep === 'none' ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Welcome back</h2>
                <p className="mt-1 text-sm text-slate-400">Sign in to your CloudBudgetMaster account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                  <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur-sm px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300">Password</label>
                    <button type="button" onClick={() => { setResetStep('email'); setError('') }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</button>
                  </div>
                  <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur-sm px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
                </div>

                <button type="submit" disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {loading && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </>
          ) : resetStep === 'email' ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Reset password</h2>
                <p className="mt-1 text-sm text-slate-400">We'll send a 6-digit code to your email</p>
              </div>
              <form onSubmit={handleSendResetCode} className="space-y-4">
                {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur-sm px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
                </div>
                <button type="submit" disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">
                  {loading ? 'Sending...' : 'Send reset code'}
                </button>
                <button type="button" onClick={() => { setResetStep('none'); setError('') }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">Back to sign in</button>
              </form>
            </>
          ) : resetStep === 'code' ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Enter reset code</h2>
                <p className="mt-1 text-sm text-slate-400">Check <span className="text-white">{email}</span> for a 6-digit code</p>
              </div>
              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Reset code</label>
                  <input type="text" required value={resetCode} onChange={(e) => setResetCode(e.target.value)} placeholder="123456" maxLength={6} autoFocus
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur-sm px-3.5 py-3 text-center text-2xl font-mono tracking-[0.3em] text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">New password</label>
                  <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 chars, letters + numbers"
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur-sm px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
                </div>
                <button type="submit" disabled={loading || resetCode.length < 6}
                  className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">
                  {loading ? 'Resetting...' : 'Reset password'}
                </button>
                <button type="button" onClick={() => { setResetStep('email'); setError('') }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">Resend code</button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10 mb-4">
                <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <h2 className="text-xl font-bold text-white">Password updated</h2>
              <p className="mt-2 text-sm text-slate-400">You can now sign in with your new password.</p>
              <button onClick={() => { setResetStep('none'); setError(''); setPassword('') }}
                className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">Sign in</button>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">Create one free</Link>
          </p>
          <Link to="/" className="mt-3 block text-center text-xs text-slate-600 hover:text-slate-400 transition-colors">&larr; Back to home</Link>
        </div>
      </div>
    </div>
  )
}
