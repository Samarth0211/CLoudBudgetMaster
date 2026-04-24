import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

function validatePassword(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters'
  if (/^\d+$/.test(pw)) return 'Password cannot be all numbers'
  if (!/[A-Za-z]/.test(pw)) return 'Must contain at least one letter'
  if (!/[0-9]/.test(pw)) return 'Must contain at least one number'
  const common = ['password','12345678','qwerty12','letmein1','welcome1','admin123','passw0rd','changeme']
  if (common.includes(pw.toLowerCase())) return 'This password is too common'
  return null
}

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('form') // 'form' | 'otp'
  const [otpCode, setOtpCode] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const passwordError = password.length > 0 ? validatePassword(password) : null

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')

    const pwErr = validatePassword(password)
    if (pwErr) { setError(pwErr); return }

    setLoading(true)
    try {
      await api.post('/auth/register', { email, password, full_name: fullName })
      setStep('otp')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/verify-otp', { email, code: otpCode, password })
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      const userObj = { id: data.id, email: data.email, full_name: data.full_name, plan: data.plan }
      localStorage.setItem('user', JSON.stringify(userObj))
      navigate('/dashboard')
      window.location.reload()
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-12 text-white relative overflow-hidden">
        <div className="absolute top-20 -right-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-20 -left-20 h-48 w-48 rounded-full bg-violet-400/10 blur-3xl" />

        <div className="relative">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="CloudBudgetMaster" className="h-10 w-10" />
            <span className="text-2xl font-bold tracking-tight">CloudBudgetMaster</span>
          </Link>
        </div>

        <div className="relative space-y-8">
          <h2 className="text-3xl font-bold leading-tight">Start saving in<br />5 minutes.</h2>
          <div className="space-y-5">
            {[
              { n: '1', t: 'Connect your cloud', d: 'Read-only access via IAM keys.' },
              { n: '2', t: 'See waste instantly', d: 'Stopped EC2s, orphaned EBS, idle RDS.' },
              { n: '3', t: 'Get alerted', d: 'Daily scans with email alerts.' },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">{s.n}</div>
                <div><p className="font-semibold">{s.t}</p><p className="text-sm text-indigo-200">{s.d}</p></div>
              </div>
            ))}
          </div>

          {/* Security badges */}
          <div className="flex items-center gap-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <span className="text-xs text-indigo-200">AES-256 encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <span className="text-xs text-indigo-200">Read-only access</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              <span className="text-xs text-indigo-200">SOC 2 practices</span>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-indigo-300">Free plan includes 1 cloud connection and 3 alert rules.</p>
      </div>

      {/* Right panel */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center bg-[#0a0a0a] px-6 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 auth-grid" />
        <div className="absolute inset-0 auth-glow" />
        <div className="auth-orb-1" />
        <div className="auth-orb-2" />

        <div className="relative w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center justify-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="CloudBudgetMaster" className="h-9 w-9" />
              <span className="text-xl font-bold text-white">CloudBudgetMaster</span>
            </Link>
          </div>

          {step === 'form' ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Create your account</h2>
                <p className="mt-1 text-sm text-slate-400">Start finding cloud waste for free</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Full name</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur-sm px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur-sm px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 chars, letters + numbers"
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur-sm px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
                  {passwordError && <p className="mt-1.5 text-xs text-amber-400">{passwordError}</p>}
                  {password.length >= 8 && !passwordError && <p className="mt-1.5 text-xs text-emerald-400">Strong password</p>}
                </div>

                <button type="submit" disabled={loading || !!passwordError}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {loading ? 'Creating account...' : 'Create free account'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Check your email</h2>
                <p className="mt-1 text-sm text-slate-400">We sent a 6-digit code to <span className="text-white">{email}</span></p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Verification code</label>
                  <input type="text" required value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456" maxLength={6} autoFocus
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-3 text-center text-2xl font-mono tracking-[0.3em] text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
                </div>

                <button type="submit" disabled={loading || otpCode.length < 6}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {loading ? 'Verifying...' : 'Verify & sign in'}
                </button>

                <button type="button" onClick={() => { setStep('form'); setError('') }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  Back to registration
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">Sign in</Link>
          </p>
          <Link to="/" className="mt-3 block text-center text-xs text-slate-600 hover:text-slate-400 transition-colors">&larr; Back to home</Link>
        </div>
      </div>
    </div>
  )
}
