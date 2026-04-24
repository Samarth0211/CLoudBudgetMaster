import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'For individual developers exploring cloud savings.',
    features: [
      { text: '1 cloud connection', included: true },
      { text: '3 alert rules', included: true },
      { text: '3 AI chats / month', included: true },
      { text: 'Daily scans', included: true },
      { text: 'Waste detection', included: true },
      { text: 'Email alerts', included: true },
      { text: 'Savings report', included: true },
      { text: 'Multi-cloud support', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/mo',
    desc: 'For teams managing multiple cloud accounts.',
    highlighted: true,
    badge: 'Most popular',
    features: [
      { text: '5 cloud connections', included: true },
      { text: '50 alert rules', included: true },
      { text: '15 AI chats / month', included: true },
      { text: 'Hourly scans', included: true },
      { text: 'Everything in Free', included: true },
      { text: 'AWS + GCP support', included: true },
      { text: 'PDF export & reports', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Webhook integrations', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$99',
    period: '/mo',
    desc: 'For organizations with complex multi-cloud setups.',
    features: [
      { text: 'Unlimited connections', included: true },
      { text: 'Unlimited alert rules', included: true },
      { text: '50 AI chats / month', included: true },
      { text: 'Hourly scans', included: true },
      { text: 'Everything in Pro', included: true },
      { text: 'Custom alert logic', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'Webhook integrations', included: true },
      { text: 'SLA guarantee', included: true },
    ],
  },
]

export default function Pricing() {
  const { user } = useAuth()
  const isLoggedIn = !!user
  const currentPlan = user?.plan || null
  const [loading, setLoading] = useState(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState(null)

  const planIndex = (id) => PLANS.findIndex(p => p.id === id)

  const handleUpgrade = async (planId) => {
    if (!isLoggedIn) {
      window.location.href = '/register'
      return
    }
    if (planId === 'enterprise') {
      window.location.href = 'mailto:support@cloudbudgetmaster.com?subject=Enterprise Plan Inquiry'
      return
    }
    setLoading(planId)
    try {
      const { data } = await api.post('/payments/create-order')
      window.location.href = data.approval_url
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start checkout')
    } finally {
      setLoading(null)
    }
  }

  const handlePromo = async (e) => {
    e.preventDefault()
    if (!isLoggedIn) { window.location.href = '/register'; return }
    setPromoLoading(true)
    setPromoMsg(null)
    try {
      const { data } = await api.post('/payments/redeem-promo', { code: promoCode })
      setPromoMsg({ type: 'success', text: data.message })
      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      userData.plan = 'pro'
      localStorage.setItem('user', JSON.stringify(userData))
      setTimeout(() => window.location.reload(), 2000)
    } catch (err) {
      setPromoMsg({ type: 'error', text: err.response?.data?.detail || 'Invalid code' })
    } finally {
      setPromoLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
    <div className="max-w-5xl mx-auto px-6 py-16">
      {/* Nav for public visitors */}
      {!isLoggedIn && (
        <div className="flex items-center justify-between mb-12">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="CloudBudgetMaster" className="h-7 w-7" />
            <span className="text-sm font-semibold text-white">CloudBudgetMaster</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Sign in</Link>
            <Link to="/register" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">Get Started Free</Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-white">Simple, transparent pricing</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
          Start free. Upgrade when you need more connections and deeper insights.
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const isUpgrade = planIndex(plan.id) > planIndex(currentPlan)

          return (
            <div key={plan.id} className={`relative rounded-lg border p-6 flex flex-col transition-all ${
              plan.highlighted
                ? 'border-indigo-500/50 bg-indigo-500/[0.03] ring-1 ring-indigo-500/20'
                : 'border-slate-800 bg-slate-900'
            }`}>
              {plan.badge && (
                <span className="absolute -top-2.5 left-4 rounded-md bg-indigo-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  {plan.badge}
                </span>
              )}

              <div className="mb-5">
                <h3 className="text-sm font-semibold text-white">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">{plan.desc}</p>
              </div>

              {/* CTA */}
              <div className="mb-5">
                {!isLoggedIn ? (
                  <Link to={plan.id === 'enterprise' ? '#' : '/register'}
                    onClick={plan.id === 'enterprise' ? () => { window.location.href = 'mailto:support@cloudbudgetmaster.com?subject=Enterprise Plan Inquiry' } : undefined}
                    className={`block w-full rounded-lg py-2.5 text-center text-xs font-medium transition-colors ${
                      plan.highlighted
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                        : 'bg-white/5 text-white border border-slate-700 hover:bg-white/10'
                    }`}>
                    {plan.id === 'free' ? 'Get Started Free' : plan.id === 'enterprise' ? 'Contact sales' : `Start with ${plan.name}`}
                  </Link>
                ) : isCurrent ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 py-2.5 text-xs font-medium text-slate-400">
                    <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Current plan
                  </div>
                ) : isUpgrade ? (
                  <button onClick={() => handleUpgrade(plan.id)} disabled={loading === plan.id}
                    className={`w-full rounded-lg py-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      plan.highlighted
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                        : 'bg-white/5 text-white border border-slate-700 hover:bg-white/10'
                    }`}>
                    {loading === plan.id ? 'Redirecting to PayPal...' : plan.id === 'enterprise' ? 'Contact sales' : `Upgrade to ${plan.name}`}
                  </button>
                ) : (
                  <div className="rounded-lg border border-slate-800 py-2.5 text-center text-xs text-slate-600">
                    Included
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="flex-1 border-t border-slate-800 pt-5">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-3">What's included</p>
                <ul className="space-y-2.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      {f.included ? (
                        <svg className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 shrink-0 text-slate-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className={`text-xs ${f.included ? 'text-slate-300' : 'text-slate-600'}`}>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      {/* Promo code */}
      <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm font-medium text-white mb-3">Have a promo code?</p>
        <form onSubmit={handlePromo} className="flex gap-2">
          <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Enter code"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
          <button type="submit" disabled={promoLoading || !promoCode.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors">
            {promoLoading ? 'Applying...' : 'Apply'}
          </button>
        </form>
        {promoMsg && (
          <p className={`mt-2 text-xs ${promoMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{promoMsg.text}</p>
        )}
      </div>

      {/* Trust bar */}
      <div className="mt-10 rounded-lg border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-center gap-8">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <div>
              <p className="text-xs font-medium text-white">Secure checkout</p>
              <p className="text-[10px] text-slate-500">Powered by PayPal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            <div>
              <p className="text-xs font-medium text-white">Cancel anytime</p>
              <p className="text-[10px] text-slate-500">No lock-in contracts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div>
              <p className="text-xs font-medium text-white">No hidden fees</p>
              <p className="text-[10px] text-slate-500">What you see is what you pay</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
            <div>
              <p className="text-xs font-medium text-white">AES-256 encryption</p>
              <p className="text-[10px] text-slate-500">Your data is always safe</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-10">
        <h2 className="text-sm font-semibold text-white mb-4 text-center">Frequently asked questions</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {[
            { q: 'Can I upgrade or downgrade at any time?', a: 'Yes. Upgrade instantly, downgrade at the end of your billing cycle.' },
            { q: 'Do you store my cloud credentials?', a: 'Credentials are AES-256 encrypted before storage. We only use read-only access.' },
            { q: 'What happens when I hit my chat limit?', a: 'You can still use all other features. Upgrade to unlock more AI conversations.' },
            { q: 'Can I cancel anytime?', a: 'Yes, cancel from your Settings page. Your plan stays active until the end of the billing period.' },
          ].map((faq, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-medium text-white">{faq.q}</p>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  )
}
