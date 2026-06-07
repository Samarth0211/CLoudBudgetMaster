import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/shared/BrandLogo'

/* ─── Cloud icon (reused from Sidebar) ─── */
const CloudIcon = ({ className = 'h-6 w-6' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
  </svg>
)

/* ─── Navbar ─── */
function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0B0F1A]/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20' : 'bg-transparent'}`}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <BrandLogo className="h-8 w-8" />
            <span className="text-lg font-bold text-white">CloudBudgetMaster</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a>
            <Link to="/blog" className="text-sm text-slate-400 hover:text-white transition-colors">Blog</Link>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-4 py-2">
              Sign in
            </Link>
            <Link to="/register" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors">
              Get Started Free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-slate-400 hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden animate-slide-down border-t border-white/5 pb-4 pt-2">
            <a href="#features" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-slate-400 hover:text-white">Features</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-slate-400 hover:text-white">How it Works</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-slate-400 hover:text-white">Pricing</a>
            <div className="mt-3 flex flex-col gap-2">
              <Link to="/login" className="text-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white">Sign in</Link>
              <Link to="/register" className="text-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Get Started Free</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

/* ─── Feature card ─── */
const FEATURES = [
  {
    title: 'Multi-Cloud Support',
    desc: 'Connect AWS, GCP, Azure, and Snowflake in one unified dashboard. No more switching between consoles.',
    icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
    color: 'from-indigo-500 to-violet-500',
  },
  {
    title: 'Waste Detection',
    desc: 'Automatically find unused EC2 instances, orphaned EBS volumes, idle RDS databases, and unattached Elastic IPs.',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    color: 'from-rose-500 to-orange-500',
  },
  {
    title: 'Cost Spike Alerts',
    desc: 'Get notified via email the moment your spending deviates from normal. Catch surprises before they hit the invoice.',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    color: 'from-amber-500 to-yellow-500',
  },
  {
    title: 'AI Cost Assistant',
    desc: 'Ask questions in plain English — "Why did my bill jump?" — and get instant, context-aware answers.',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    title: 'Savings Reports',
    desc: 'One-click PDF reports showing exactly how much you can save, broken down by service and resource.',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    title: 'Read-Only & Secure',
    desc: 'We never modify your infrastructure. Credentials are AES-256 encrypted. Your cloud stays untouched.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    color: 'from-violet-500 to-purple-500',
  },
]

/* ─── Stats ─── */
const STATS = [
  { value: '30%', label: 'Average savings found' },
  { value: '<5 min', label: 'Setup time' },
  { value: '4', label: 'Cloud providers' },
  { value: '24/7', label: 'Automated scanning' },
]

/* ─── Pricing tiers ─── */
const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'For individual developers exploring cloud savings.',
    features: ['1 cloud connection', '3 alert rules', 'Daily automated scans', 'Waste detection (EC2, RDS, EBS, IPs)', 'AI cost assistant', 'Email alerts', 'Savings report'],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    desc: 'For teams managing multiple cloud accounts.',
    features: ['5 cloud connections', '50 alert rules', 'Hourly scans', 'Everything in Free', 'Multi-cloud support (AWS + GCP)', 'AI assistant (unlimited)', 'PDF export & reports', 'Priority email support'],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: '/month',
    desc: 'For organizations with complex multi-cloud setups.',
    features: ['Unlimited connections', 'Unlimited alert rules', 'Hourly scans', 'Everything in Pro', 'Custom alert logic', 'Dedicated account manager', 'Webhook integrations', 'SLA guarantee'],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

/* ─── Main Component ─── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <LandingNav />

      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
        {/* Background blobs */}
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px] animate-blob" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[100px] animate-blob delay-3" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-300 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </span>
            Now supporting AWS, GCP, Azure & Snowflake
          </div>

          <h1 className="animate-fade-up delay-1 text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            Stop burning money<br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              on idle cloud resources
            </span>
          </h1>

          <p className="animate-fade-up delay-2 mt-6 mx-auto max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed">
            CloudBudgetMaster scans your multi-cloud infrastructure, detects unused resources,
            and alerts you before costs spiral. Setup takes under 5 minutes.
          </p>

          <div className="animate-fade-up delay-3 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register"
              className="group relative inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 hover:shadow-indigo-500/40 transition-all duration-300">
              Get Started Free
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-300">
              See How It Works
            </a>
          </div>

          <p className="animate-fade-up delay-4 mt-5 text-xs text-slate-500">
            Free forever plan &middot; No credit card required &middot; Read-only access
          </p>

          {/* Dashboard preview mockup */}
          <div className="animate-fade-up delay-5 mt-16 mx-auto max-w-5xl">
            <div className="relative rounded-2xl border border-white/10 bg-[#0D1117] p-1 shadow-2xl shadow-indigo-500/10">
              {/* Fake browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                </div>
                <div className="mx-auto rounded-md bg-white/5 px-16 py-1 text-xs text-slate-500">cloudbudgetmaster.com</div>
              </div>
              {/* Dashboard content mockup */}
              <div className="p-6 space-y-4">
                {/* Stat cards row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Monthly Spend', value: '$4,827', change: '-12%', down: true },
                    { label: 'Savings Found', value: '$1,243', change: '26% of bill', down: false },
                    { label: 'Resources', value: '147', change: '23 unused', down: false },
                    { label: 'Accounts', value: '3', change: 'All active', down: false },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl bg-white/5 border border-white/5 p-4">
                      <p className="text-[11px] text-slate-500 uppercase tracking-wide">{s.label}</p>
                      <p className="font-mono mt-1 text-xl font-bold text-white">{s.value}</p>
                      <p className={`mt-0.5 text-xs ${s.down ? 'text-emerald-400' : 'text-slate-500'}`}>{s.change}</p>
                    </div>
                  ))}
                </div>
                {/* Chart placeholder */}
                <div className="rounded-xl bg-white/5 border border-white/5 p-4 h-48 flex items-end gap-1.5">
                  {[40, 55, 48, 62, 58, 72, 65, 50, 68, 75, 60, 45, 55, 48, 42, 38, 35, 40, 55, 48, 42, 52, 58, 55, 45, 50, 42, 38, 35, 32].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-indigo-600 to-violet-500 opacity-70" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
            {/* Glow effect under mockup */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 h-16 w-3/4 bg-indigo-500/20 blur-3xl rounded-full" />
          </div>
        </div>
      </section>

      {/* ═══════ STATS BAR ═══════ */}
      <section className="border-y border-white/5 bg-[#0D1117]/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <p className="font-mono text-3xl lg:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">{s.value}</p>
                <p className="mt-1 text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-indigo-400 uppercase tracking-wide">Features</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Everything you need to <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">cut cloud waste</span>
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              One platform to monitor, detect, and fix overprovisioned and abandoned cloud resources across all your providers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="group relative rounded-2xl border border-white/5 bg-[#0D1117] p-6 hover:border-white/10 hover:bg-[#111827] transition-all duration-300">
                <div className={`inline-flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br ${f.color} shadow-lg mb-4`}>
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how-it-works" className="py-24 lg:py-32 bg-[#0D1117]/50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-indigo-400 uppercase tracking-wide">How it Works</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              From zero to savings in <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">5 minutes</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: '01',
                title: 'Connect Your Cloud',
                desc: 'Paste your read-only IAM credentials. We support AWS, GCP, Azure, and Snowflake. Your keys are AES-256 encrypted.',
                icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101',
              },
              {
                step: '02',
                title: 'See Waste Instantly',
                desc: 'CloudBudgetMaster scans your infrastructure and surfaces every idle, unused, and oversized resource — with dollar amounts attached.',
                icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
              },
              {
                step: '03',
                title: 'Save & Stay Alert',
                desc: 'Get step-by-step fix recommendations, download savings reports, and receive email alerts when costs spike.',
                icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
              },
            ].map((s, i) => (
              <div key={i} className="relative text-center">
                {/* Connector line */}
                {i < 2 && <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-indigo-500/40 to-transparent" />}

                <div className="inline-flex items-center justify-center h-24 w-24 rounded-2xl border border-white/10 bg-white/5 mb-6 mx-auto">
                  <div className="text-center">
                    <p className="text-xs font-bold text-indigo-400 tracking-widest">{s.step}</p>
                    <svg className="h-8 w-8 text-slate-300 mx-auto mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section id="pricing" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-indigo-400 uppercase tracking-wide">Pricing</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Start free. Upgrade when you need more connections and deeper insights.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {PRICING.map((tier, i) => (
              <div key={i} className={`relative rounded-2xl p-8 transition-all duration-300 ${
                tier.highlighted
                  ? 'border-2 border-indigo-500 bg-gradient-to-b from-indigo-500/10 to-transparent shadow-xl shadow-indigo-500/10 scale-[1.02]'
                  : 'border border-white/10 bg-[#0D1117] hover:border-white/20'
              }`}>
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}

                <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-mono text-4xl font-bold text-white">{tier.price}</span>
                  {tier.period && <span className="text-sm text-slate-500">{tier.period}</span>}
                </div>
                <p className="mt-3 text-sm text-slate-400">{tier.desc}</p>

                <Link to="/register" className={`mt-6 block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${
                  tier.highlighted
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25'
                    : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                }`}>
                  {tier.cta}
                </Link>

                <ul className="mt-8 space-y-3">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <svg className="h-5 w-5 shrink-0 text-indigo-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ BOTTOM CTA ═══════ */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 px-8 py-16 sm:px-16 text-center">
            {/* Decorative */}
            <div className="absolute top-0 left-0 h-full w-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                Ready to stop overpaying<br />for cloud?
              </h2>
              <p className="mt-4 text-lg text-indigo-200 max-w-lg mx-auto">
                Start saving on your cloud bill today. Connect your first cloud account in under 5 minutes.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-indigo-700 shadow-lg hover:bg-indigo-50 transition-colors">
                  Get Started Free
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
              <p className="mt-4 text-xs text-indigo-300">No credit card required &middot; Free plan available</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/5 bg-[#0D1117]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <BrandLogo className="h-8 w-8" />
                <span className="text-lg font-bold text-white">CloudBudgetMaster</span>
              </div>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                Multi-cloud cost monitoring and waste detection. Save money, stay informed.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">How it Works</a></li>
                <li><Link to="/register" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Get Started</Link></li>
              </ul>
            </div>

            {/* Providers */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Supported</h4>
              <ul className="space-y-2">
                <li><span className="text-sm text-slate-500">Amazon Web Services</span></li>
                <li><span className="text-sm text-slate-500">Google Cloud Platform</span></li>
                <li><span className="text-sm text-slate-500">Microsoft Azure</span></li>
                <li><span className="text-sm text-slate-500">Snowflake</span></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Company</h4>
              <ul className="space-y-2">
                <li><span className="text-sm text-slate-500">Privacy Policy</span></li>
                <li><span className="text-sm text-slate-500">Terms of Service</span></li>
                <li><span className="text-sm text-slate-500">Security</span></li>
                <li><a href="mailto:support@cloudbudgetmaster.com" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} CloudBudgetMaster. All rights reserved.</p>
            <p className="text-xs text-slate-600">Read-only cloud access. We never modify your infrastructure.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
