import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/shared/BrandLogo'

/* ============================================================================
   CloudBudgetMaster — AWS-flavored landing page (Smile Orange on squid-ink navy).
   Ported from the Claude Design prototype into React + react-router.
   ============================================================================ */

/* ---- Heroicons-outline geometry ---- */
function Icon({ d, className = 'h-5 w-5', sw = 1.5, fill = false }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'} strokeWidth={sw}>
      {Array.isArray(d)
        ? d.map((p, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={p} />)
        : <path strokeLinecap="round" strokeLinejoin="round" d={d} />}
    </svg>
  )
}

const PATHS = {
  arrow: 'M13 7l5 5m0 0l-5 5m5-5H6',
  check: 'M5 13l4 4L19 7',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  chat: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  doc: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  cloud: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  spark: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.1 1.1',
  trend: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <BrandLogo className="h-8 w-8" />
      <span className="text-[18px] font-bold tracking-tight text-white">
        Cloud<span className="font-semibold text-[var(--fg-3)]">Budget</span>Master
      </span>
    </div>
  )
}

/* ---- hooks ---- */
function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const targets = []
    if (el.classList.contains('reveal')) targets.push(el)
    el.querySelectorAll('.reveal').forEach(n => targets.push(n))
    let io
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => {
      targets.forEach(t => t.classList.add('armed'))
      io = new IntersectionObserver((es) => {
        es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
      }, { threshold: 0, rootMargin: '0px 0px -6% 0px' })
      targets.forEach(t => io.observe(t))
    }))
    return () => { cancelAnimationFrame(raf); if (io) io.disconnect() }
  }, [])
  return ref
}

function useInView(threshold = 0.4) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { setSeen(true); io.disconnect() } })
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen]
}

function CountUp({ to, dur = 1400, fmt = (v) => Math.round(v).toLocaleString(), className = '', start = true }) {
  const [val, setVal] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (!start) return
    let t0
    const tick = (t) => {
      if (!t0) t0 = t
      const p = Math.min(1, (t - t0) / dur)
      setVal(to * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    const fb = setTimeout(() => setVal(to), dur + 250)
    return () => { cancelAnimationFrame(raf.current); clearTimeout(fb) }
  }, [to, dur, start])
  return <span className={className}>{fmt(val)}</span>
}

/* ---- Nav ---- */
function LandingNav({ onCta, onSignIn }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const links = [['Product', '#features'], ['How it works', '#how'], ['Savings', '#calc'], ['Pricing', '#pricing']]
  return (
    <header className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(11,18,32,0.82)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'var(--border)' : 'transparent'}`,
      }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-[64px] items-center justify-between">
          <a href="#top" className="shrink-0"><Wordmark /></a>
          <nav className="hidden md:flex items-center gap-1">
            {links.map(([label, href]) => (
              <a key={href} href={href}
                className="px-3.5 py-2 text-[14px] font-medium text-[var(--fg-3)] hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                {label}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2.5">
            <button onClick={onSignIn} className="px-3.5 py-2 text-[14px] font-medium text-[var(--fg-2)] hover:text-white transition-colors">Sign in</button>
            <button onClick={onCta} className="btn btn-primary px-5 py-2.5 text-[14px]">
              Start free <Icon d={PATHS.arrow} className="h-4 w-4" sw={2.2} />
            </button>
          </div>
          <button onClick={() => setOpen(o => !o)} className="md:hidden p-2 text-white" aria-label="Menu">
            <Icon d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 7h16M4 12h16M4 17h16'} sw={2} />
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-[var(--border)] bg-[rgba(11,18,32,0.96)] backdrop-blur-xl px-6 py-4 flex flex-col gap-1">
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="py-2.5 text-[var(--fg-2)] hover:text-white">{label}</a>
          ))}
          <button onClick={onCta} className="btn btn-primary mt-2 px-5 py-3">Start free</button>
        </div>
      )}
    </header>
  )
}

/* ---- Hero ---- */
function DashboardMock() {
  const [ref, seen] = useInView(0.3)
  const bars = [38,52,46,60,55,70,63,48,66,74,58,44,54,47,41,37,34,40,54,47,41,51,57,54,44,49,41,37,34,31,36,44]
  const stats = [
    { label: 'Monthly spend', val: '$4,827', sub: '-12% vs last week', good: true },
    { label: 'Waste found', val: '$1,243', sub: '26% of bill', waste: true },
    { label: 'Resources', val: '147', sub: '23 idle', mute: true },
    { label: 'Accounts', val: '3', sub: 'all active', mute: true },
  ]
  return (
    <div ref={ref} className="relative rounded-[18px] border border-[var(--border)] bg-[var(--ink-2)] p-1.5 shadow-[var(--shadow-xl)]">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="mx-auto flex items-center gap-2 rounded-md bg-white/5 px-4 py-1 text-[12px] text-[var(--fg-4)]">
          <Icon d={PATHS.lock} className="h-3 w-3 text-[var(--positive)]" sw={2} />
          app.cloudbudgetmaster.com/dashboard
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[12px] border border-[var(--border-soft)] bg-[var(--canvas)] p-5">
        {seen && <div className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ animation: 'scan-sweep 3.4s ease-in-out 0.6s', background: 'linear-gradient(180deg, transparent, rgba(255,153,0,0.16), transparent)' }} />}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-left">
            <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: 'var(--grad-orange)' }}><Icon d={PATHS.chart} className="h-4 w-4 text-[#1a1205]" sw={2} /></span>
            <div>
              <p className="text-[13px] font-semibold text-white">Cost overview</p>
              <p className="text-[11px] text-[var(--fg-4)]">Last 30 days · all clouds</p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-[var(--positive-tint)] bg-[var(--positive-tint)] px-2.5 py-1 text-[11px] font-medium text-[var(--positive)] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" /> Live scan
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="rounded-xl border border-[var(--border-soft)] bg-white/[0.03] p-3.5 text-left">
              <p className="text-[10px] uppercase tracking-wide text-[var(--fg-4)]">{s.label}</p>
              <p className="mono mt-1 text-[20px] font-bold text-white">{s.val}</p>
              <p className={`mt-0.5 text-[11px] ${s.good ? 'text-[var(--positive)]' : s.waste ? 'text-[var(--waste)]' : 'text-[var(--fg-4)]'}`}>{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex h-44 items-end gap-1.5 rounded-xl border border-[var(--border-soft)] bg-white/[0.02] p-4">
          {bars.map((h, i) => (
            <div key={i} className="relative flex-1 rounded-[2px]"
              style={{ height: `${h}%`, background: i > 24 ? 'linear-gradient(180deg, #FF7A6E, #FF5247)' : 'var(--grad-orange)', opacity: i > 24 ? 0.92 : 0.82 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Hero({ onCta }) {
  const ref = useReveal()
  return (
    <section id="top" ref={ref} className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-24">
      <div className="pointer-events-none absolute inset-0 opacity-[0.5]" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(255,153,0,0.10), transparent 55%)' }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)', backgroundSize: '60px 60px', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 80%)' }} />
      <div className="animate-blob pointer-events-none absolute -top-10 left-[18%] h-[460px] w-[460px] rounded-full bg-[rgba(255,153,0,0.16)] blur-[130px]" />
      <div className="animate-blob pointer-events-none absolute top-24 right-[12%] h-[400px] w-[400px] rounded-full bg-[rgba(63,169,245,0.12)] blur-[130px]" style={{ animationDelay: '4s' }} />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
        <div className="reveal inline-flex items-center gap-2 rounded-full border border-[var(--orange-tint-2)] bg-[var(--orange-tint)] px-4 py-1.5 text-[13px] font-medium text-[var(--orange-bright)]">
          <span className="relative flex h-2 w-2">
            <span className="ping-dot absolute inline-flex h-full w-full rounded-full bg-[var(--orange)]" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--orange)]" />
          </span>
          Now scanning AWS, GCP, Azure &amp; Snowflake
        </div>
        <h1 className="reveal mx-auto mt-7 max-w-4xl text-[40px] font-extrabold leading-[1.04] tracking-[-0.025em] text-white sm:text-[58px] lg:text-[72px]">
          Stop burning money on<br className="hidden sm:block" />
          <span className="grad-orange-text"> idle cloud resources</span>
        </h1>
        <p className="reveal mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-[var(--fg-3)] sm:text-[20px]">
          CloudBudgetMaster scans your multi-cloud infrastructure with read-only access, surfaces every wasted dollar, and alerts you before costs spiral. Setup takes under 5 minutes.
        </p>
        <div className="reveal mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
          <button onClick={onCta} className="btn btn-primary px-7 py-3.5 text-[15px]">
            Start free <Icon d={PATHS.arrow} className="h-4 w-4" sw={2.2} />
          </button>
          <a href="#calc" className="btn btn-ghost px-7 py-3.5 text-[15px]">
            <Icon d={PATHS.search} className="h-4 w-4" sw={2} /> Calculate my savings
          </a>
        </div>
        <p className="reveal mt-5 text-[13px] text-[var(--fg-4)]">Free forever plan · No credit card required · Read-only access</p>
        <div className="reveal relative mx-auto mt-16 max-w-5xl">
          <DashboardMock />
          <div className="pointer-events-none absolute -bottom-10 left-1/2 h-20 w-3/4 -translate-x-1/2 rounded-full bg-[rgba(255,153,0,0.22)] blur-[60px]" />
        </div>
      </div>
    </section>
  )
}

/* ---- Trust strip ---- honest security/capability signals (no fake customers) */
function TrustStrip() {
  const items = [
    { icon: PATHS.eye, t: 'Read-only access', s: 'We never modify your infrastructure' },
    { icon: PATHS.lock, t: 'AES-256 encrypted', s: 'Credentials encrypted at rest' },
    { icon: PATHS.shield, t: 'No write permissions', s: 'Scoped to read-only, always' },
    { icon: PATHS.cloud, t: 'AWS · GCP · Azure · Snowflake', s: 'One dashboard, every cloud' },
  ]
  return (
    <section className="border-y border-[var(--border-soft)] bg-[var(--canvas-2)] py-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="mb-8 text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--fg-4)]">
          Built for engineers who take cloud security seriously
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.t} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--ink)] px-4 py-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] text-[var(--orange-bright)]" style={{ background: 'var(--orange-tint)' }}>
                <Icon d={it.icon} className="h-5 w-5" sw={1.8} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-white">{it.t}</p>
                <p className="text-[12px] text-[var(--fg-4)]">{it.s}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---- Stats ---- */
function Stats() {
  const ref = useReveal()
  const [seenRef, seen] = useInView(0.5)
  const data = [
    { to: 31, fmt: v => `${Math.round(v)}%`, label: 'Average waste found in first scan' },
    { to: 5, fmt: v => `<${Math.round(v)} min`, label: 'From signup to first savings' },
    { to: 4, fmt: v => `${Math.round(v)}`, label: 'Cloud providers, one dashboard' },
    { to: 24, fmt: v => `${Math.round(v)}/7`, label: 'Automated, always-on scanning' },
  ]
  return (
    <section ref={ref} className="py-20">
      <div ref={seenRef} className="mx-auto grid max-w-7xl grid-cols-2 gap-y-10 gap-x-6 px-6 lg:grid-cols-4 lg:px-8">
        {data.map((s, i) => (
          <div key={i} className="reveal text-center" style={{ transitionDelay: `${i * 70}ms` }}>
            <p className="mono text-[40px] font-bold leading-none lg:text-[52px]">
              <span className="grad-orange-text"><CountUp to={s.to} fmt={s.fmt} start={seen} /></span>
            </p>
            <p className="mx-auto mt-3 max-w-[180px] text-[14px] leading-snug text-[var(--fg-3)]">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---- Features ---- */
const FEATURES = [
  { title: 'Multi-cloud, one pane', desc: 'Connect AWS, GCP, Azure, and Snowflake into a single unified dashboard. No more tab-juggling across four consoles.', icon: PATHS.cloud, tint: 'var(--orange)' },
  { title: 'Waste detection', desc: 'Automatically surface stopped EC2 instances, unattached EBS volumes, idle RDS databases, and orphaned Elastic IPs — each with a dollar figure.', icon: PATHS.search, tint: 'var(--waste)' },
  { title: 'Cost-spike alerts', desc: 'Get pinged by email and in-app the moment spend deviates from normal. Catch surprises before they reach the invoice.', icon: PATHS.bell, tint: 'var(--warning)' },
  { title: 'AI cost assistant', desc: 'Ask in plain English — "Why did my bill jump?" — and get an instant, context-aware answer grounded in your real usage.', icon: PATHS.chat, tint: 'var(--info)' },
  { title: 'Savings reports', desc: 'One-click PDF reports showing exactly how much you can save, broken down by service, account, and resource.', icon: PATHS.doc, tint: 'var(--positive)' },
  { title: 'Read-only & secure', desc: 'We never modify your infrastructure. Credentials are AES-256 encrypted and access is strictly read-only.', icon: PATHS.shield, tint: 'var(--orange-bright)' },
]

function Features() {
  const ref = useReveal()
  return (
    <section id="features" ref={ref} className="py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="reveal mx-auto mb-16 max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--orange-bright)]">Platform</p>
          <h2 className="mt-3 text-[32px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">
            Everything you need to <span className="grad-orange-text">cut cloud waste</span>
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[var(--fg-3)]">
            One platform to monitor, detect, and fix overprovisioned and abandoned resources across every provider you run.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={i} className="reveal group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--ink)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-strong)]"
              style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" style={{ background: f.tint }} />
              <div className="relative">
                <div className="mb-5 inline-grid h-12 w-12 place-items-center rounded-xl border border-[var(--border)]" style={{ background: `color-mix(in srgb, ${f.tint} 14%, transparent)`, color: f.tint }}>
                  <Icon d={f.icon} className="h-6 w-6" sw={1.7} />
                </div>
                <h3 className="text-[18px] font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--fg-3)]">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---- How it works ---- */
const STEPS = [
  { n: '01', title: 'Connect your cloud', desc: 'Paste read-only IAM credentials for AWS, GCP, Azure, or Snowflake. Keys are AES-256 encrypted — we never touch your infrastructure.', icon: PATHS.link },
  { n: '02', title: 'See waste instantly', desc: 'CloudBudgetMaster scans every account and surfaces idle, unused, and oversized resources — each tagged with the exact dollars it costs you.', icon: PATHS.search },
  { n: '03', title: 'Save & stay alert', desc: 'Get step-by-step fix recommendations, export savings reports, and receive alerts the moment costs spike again.', icon: PATHS.shield },
]

function HowItWorks() {
  const ref = useReveal()
  return (
    <section id="how" ref={ref} className="border-y border-[var(--border-soft)] bg-[var(--canvas-2)] py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="reveal mx-auto mb-16 max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--orange-bright)]">How it works</p>
          <h2 className="mt-3 text-[32px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">
            From zero to savings in <span className="grad-orange-text">5 minutes</span>
          </h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3 lg:gap-10">
          {STEPS.map((s, i) => (
            <div key={i} className="reveal relative" style={{ transitionDelay: `${i * 90}ms` }}>
              {i < 2 && <div className="absolute left-[58px] top-7 hidden h-px w-[calc(100%-2rem)] bg-gradient-to-r from-[var(--orange-tint-2)] to-transparent md:block" />}
              <div className="relative mb-6 inline-grid h-14 w-14 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--ink)]">
                <Icon d={s.icon} className="h-6 w-6 text-[var(--orange-bright)]" sw={1.7} />
                <span className="mono absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-[#1a1205]" style={{ background: 'var(--grad-orange)' }}>{s.n}</span>
              </div>
              <h3 className="text-[19px] font-semibold text-white">{s.title}</h3>
              <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--fg-3)]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---- Savings calculator (signature interactive) ---- */
function SavingsCalc({ onCta }) {
  const ref = useReveal()
  const [spend, setSpend] = useState(4800)
  const [clouds, setClouds] = useState({ AWS: true, GCP: true, Azure: false, Snowflake: false })
  const [maturity, setMaturity] = useState(1)

  const active = Object.keys(clouds).filter(k => clouds[k])
  const wasteRate = [0.18, 0.27, 0.36][maturity] * (1 + (active.length - 1) * 0.04)
  const monthlyWaste = Math.round(spend * Math.min(0.46, wasteRate))
  const yearly = monthlyWaste * 12
  const pct = Math.round((monthlyWaste / spend) * 100)

  const cats = useMemo(() => ([
    { k: 'Idle EC2 / VMs', w: 0.34, c: 'var(--orange)' },
    { k: 'Unattached EBS volumes', w: 0.24, c: 'var(--info)' },
    { k: 'Idle RDS databases', w: 0.22, c: 'var(--warning)' },
    { k: 'Orphaned Elastic IPs', w: 0.11, c: 'var(--orphaned)' },
    { k: 'Oversized instances', w: 0.09, c: 'var(--waste)' },
  ].map(b => ({ ...b, amt: Math.round(monthlyWaste * b.w) }))), [monthlyWaste])

  const toggle = (k) => setClouds(c => {
    const next = { ...c, [k]: !c[k] }
    if (!Object.values(next).some(Boolean)) return c
    return next
  })

  return (
    <section id="calc" ref={ref} className="py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="reveal mx-auto mb-14 max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--orange-bright)]">Savings calculator</p>
          <h2 className="mt-3 text-[32px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">
            See what you're <span className="grad-orange-text">leaving on the table</span>
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[var(--fg-3)]">
            Move the sliders to match your setup. This is a live estimate — the real scan is exact.
          </p>
        </div>
        <div className="reveal grid gap-6 lg:grid-cols-[1fr_1.05fr]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--ink)] p-7">
            <div className="flex items-center justify-between">
              <label className="text-[14px] font-medium text-[var(--fg-2)]">Monthly cloud spend</label>
              <span className="mono rounded-lg border border-[var(--border)] bg-white/[0.03] px-3 py-1 text-[16px] font-bold text-white">${spend.toLocaleString()}</span>
            </div>
            <input type="range" min="500" max="80000" step="100" value={spend} onChange={e => setSpend(+e.target.value)} className="cbm-range mt-4 w-full" />
            <div className="mt-1.5 flex justify-between text-[11px] text-[var(--fg-4)]"><span>$500</span><span>$80k+</span></div>
            <div className="mt-7">
              <label className="text-[14px] font-medium text-[var(--fg-2)]">Providers connected</label>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.keys(clouds).map(k => (
                  <button key={k} onClick={() => toggle(k)}
                    className={`rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-all ${clouds[k] ? 'border-[var(--orange-tint-2)] bg-[var(--orange-tint)] text-[var(--orange-bright)]' : 'border-[var(--border)] bg-white/[0.02] text-[var(--fg-4)] hover:text-[var(--fg-2)]'}`}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-7">
              <label className="text-[14px] font-medium text-[var(--fg-2)]">Infra hygiene</label>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {['Tidy', 'Typical', 'Sprawling'].map((m, i) => (
                  <button key={m} onClick={() => setMaturity(i)}
                    className={`rounded-lg border px-2 py-2.5 text-[13px] font-medium transition-all ${maturity === i ? 'border-[var(--orange-tint-2)] bg-[var(--orange-tint)] text-[var(--orange-bright)]' : 'border-[var(--border)] bg-white/[0.02] text-[var(--fg-4)] hover:text-[var(--fg-2)]'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={onCta} className="btn btn-primary mt-8 w-full py-3.5 text-[15px]">
              Get my exact number <Icon d={PATHS.arrow} className="h-4 w-4" sw={2.2} />
            </button>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--ink-2)] p-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[rgba(255,153,0,0.18)] blur-[80px]" />
            <div className="relative">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-4)]">Estimated wasted spend</p>
              <div className="mt-2 flex items-end gap-3">
                <p className="mono text-[52px] font-extrabold leading-none text-white sm:text-[64px]">${monthlyWaste.toLocaleString()}</p>
                <span className="mb-2 text-[15px] text-[var(--fg-4)]">/mo</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--waste-tint)] bg-[var(--waste-tint)] px-3 py-1 text-[13px] font-medium text-[var(--waste)]">
                <Icon d={PATHS.trend} className="h-3.5 w-3.5" sw={2} /> {pct}% of your bill is recoverable
              </div>
              <p className="mt-5 text-[14px] text-[var(--fg-3)]">
                That's <span className="mono font-semibold text-[var(--positive)]">${yearly.toLocaleString()}/year</span> you could stop sending to {active.join(', ')}.
              </p>
              <div className="mt-6 space-y-3.5">
                {cats.map((c) => (
                  <div key={c.k}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--fg-2)]">{c.k}</span>
                      <span className="mono text-[var(--fg-1)]">${c.amt.toLocaleString()}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${c.w * 100}%`, background: c.c }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---- AI peek ---- */
function AIPeek() {
  const ref = useReveal()
  return (
    <section ref={ref} className="border-y border-[var(--border-soft)] bg-[var(--canvas-2)] py-24 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:px-8">
        <div className="reveal">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--orange-bright)]">AI cost assistant</p>
          <h2 className="mt-3 text-[32px] font-bold tracking-[-0.02em] text-white sm:text-[40px]">
            Ask your bill <span className="grad-orange-text">anything</span>
          </h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[var(--fg-3)]">
            No more spelunking through Cost Explorer. Ask in plain English and get an answer grounded in your real, live usage — with the exact resources to fix.
          </p>
          <ul className="mt-6 space-y-3">
            {['Plain-English answers, not raw CSV exports', 'Cites the exact resources draining money', 'Suggests the CLI / Terraform fix to apply'].map(t => (
              <li key={t} className="flex items-start gap-3 text-[14px] text-[var(--fg-2)]">
                <Icon d={PATHS.check} className="mt-0.5 h-5 w-5 shrink-0 text-[var(--orange-bright)]" sw={2.2} /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="reveal rounded-2xl border border-[var(--border)] bg-[var(--ink)] p-2 shadow-[var(--shadow-lg)]">
          <div className="rounded-xl bg-[var(--canvas)] p-5">
            <div className="flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: 'var(--grad-orange)' }}><Icon d={PATHS.spark} className="h-4 w-4 text-[#1a1205]" sw={2} /></span>
              <p className="text-[13px] font-semibold text-white">Cost assistant</p>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div className="self-end max-w-[78%] rounded-2xl rounded-br-sm border border-[var(--orange-tint-2)] bg-[var(--orange-tint)] px-4 py-2.5 text-[13px] text-[var(--fg-1)]">
                Why did my AWS bill jump 18% this week?
              </div>
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-[var(--border)] bg-white/[0.03] px-4 py-3 text-[13px] leading-relaxed text-[var(--fg-2)]">
                The spike traces to <span className="mono text-white">3 RDS instances</span> in <span className="mono text-white">us-east-1</span> left running idle since Tuesday — about <span className="mono font-semibold text-[var(--waste)]">$214/mo</span>. Two have had zero connections in 9 days.
                <div className="mt-3 rounded-lg border border-[var(--border-soft)] bg-[var(--ink-3)] p-2.5">
                  <p className="mono text-[12px] text-[var(--positive)]">$ aws rds stop-db-instance \</p>
                  <p className="mono text-[12px] text-[var(--fg-3)]">&nbsp;&nbsp;--db-instance-identifier prod-analytics-2</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pl-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--fg-4)]" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--fg-4)]" style={{ animationDelay: '120ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--fg-4)]" style={{ animationDelay: '240ms' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---- Pricing ---- */
const TIERS = [
  { name: 'Free', price: '$0', period: 'forever', desc: 'For individual developers exploring cloud savings.', cta: 'Start free', hot: false,
    features: ['1 cloud connection', '3 alert rules', 'Daily automated scans', 'Waste detection (EC2, RDS, EBS, IPs)', 'AI cost assistant', 'Email alerts'] },
  { name: 'Pro', price: '$29', period: '/month', desc: 'For teams managing multiple cloud accounts.', cta: 'Upgrade to Pro', hot: true,
    features: ['5 cloud connections', '50 alert rules', 'Hourly scans', 'Multi-cloud (AWS + GCP + Azure)', 'AI assistant (unlimited)', 'PDF export & savings reports', 'Priority support'] },
  { name: 'Enterprise', price: '$99', period: '/month', desc: 'For organizations with complex multi-cloud setups.', cta: 'Contact sales', hot: false,
    features: ['Unlimited connections', 'Unlimited alert rules', 'Custom alert logic', 'Dedicated account manager', 'Webhook integrations', 'SSO / SAML', 'SLA guarantee'] },
]

function Pricing({ onCta }) {
  const ref = useReveal()
  return (
    <section id="pricing" ref={ref} className="py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="reveal mx-auto mb-16 max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--orange-bright)]">Pricing</p>
          <h2 className="mt-3 text-[32px] font-bold tracking-[-0.02em] text-white sm:text-[42px]">Simple, transparent pricing</h2>
          <p className="mt-4 text-[17px] text-[var(--fg-3)]">Start free. Upgrade when you need more connections and deeper insight. It pays for itself in week one.</p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {TIERS.map((t, i) => (
            <div key={i} className={`reveal relative flex flex-col rounded-2xl p-7 transition-all duration-300 ${t.hot ? 'border-2 border-[var(--orange)] bg-[var(--grad-orange-soft)] shadow-[var(--glow-orange)] md:-translate-y-2' : 'border border-[var(--border)] bg-[var(--ink)] hover:border-[var(--border-strong)]'}`}
              style={{ transitionDelay: `${i * 80}ms` }}>
              {t.hot && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1 text-[12px] font-semibold text-[#1a1205]" style={{ background: 'var(--grad-orange)' }}>Most popular</span>}
              <h3 className="text-[18px] font-semibold text-white">{t.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="mono text-[40px] font-extrabold text-white">{t.price}</span>
                <span className="text-[14px] text-[var(--fg-4)]">{t.period}</span>
              </div>
              <p className="mt-3 text-[14px] text-[var(--fg-3)]">{t.desc}</p>
              <button onClick={onCta} className={`mt-6 w-full justify-center rounded-xl py-3 text-[14px] font-semibold transition-all ${t.hot ? 'btn btn-primary' : 'border border-[var(--border)] bg-white/[0.03] text-white hover:bg-white/[0.07]'}`}>{t.cta}</button>
              <ul className="mt-7 space-y-3">
                {t.features.map(f => (
                  <li key={f} className="flex items-start gap-3 text-[14px] text-[var(--fg-2)]">
                    <Icon d={PATHS.check} className="mt-0.5 h-5 w-5 shrink-0 text-[var(--orange-bright)]" sw={2.2} /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---- Final CTA ---- */
function FinalCTA({ onCta }) {
  const ref = useReveal()
  return (
    <section ref={ref} className="px-6 py-24 lg:px-8 lg:py-28">
      <div className="reveal relative mx-auto max-w-5xl overflow-hidden rounded-[26px] border border-[var(--orange-tint-2)] px-8 py-16 text-center sm:px-16"
        style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(255,153,0,0.22), transparent 60%), var(--ink)' }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.25]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.18) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, #000, transparent)', WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, #000, transparent)' }} />
        <div className="relative">
          <h2 className="mx-auto max-w-xl text-[32px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[44px]">
            Ready to stop overpaying for cloud?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[17px] text-[var(--fg-3)]">
            Connect your first account in under five minutes and watch the waste light up — for free.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <button onClick={onCta} className="btn btn-primary px-8 py-4 text-[16px]">
              Start free <Icon d={PATHS.arrow} className="h-4 w-4" sw={2.2} />
            </button>
            <a href="#calc" className="btn btn-ghost px-8 py-4 text-[16px]">Calculate my savings</a>
          </div>
          <p className="mt-5 text-[13px] text-[var(--fg-4)]">No credit card required · Read-only access · Cancel anytime</p>
        </div>
      </div>
    </section>
  )
}

/* ---- Footer ---- */
function FootLink({ to, children }) {
  const cls = 'text-[14px] text-[var(--fg-3)] hover:text-white transition-colors'
  if (to && to.startsWith('/')) return <Link to={to} className={cls}>{children}</Link>
  if (to) return <a href={to} className={cls}>{children}</a>
  return <span className="text-[14px] text-[var(--fg-4)]">{children}</span>
}

function Footer() {
  const cols = [
    ['Product', [['Features', '#features'], ['How it works', '#how'], ['Pricing', '#pricing'], ['Savings calculator', '#calc']]],
    ['Supported', [['Amazon Web Services'], ['Google Cloud'], ['Microsoft Azure'], ['Snowflake']]],
    ['Company', [['About', '/about'], ['Blog', '/blog'], ['Security', '/security'], ['Contact', '/contact']]],
  ]
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--canvas-2)]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-[var(--fg-3)]">
              The FinOps command center that finds idle cloud spend across AWS, GCP, Azure &amp; Snowflake — before it hits your invoice.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.03] px-3 py-1.5 text-[12px] text-[var(--fg-3)]">
              <Icon d={PATHS.lock} className="h-3.5 w-3.5 text-[var(--positive)]" sw={1.8} />
              Read-only · AES-256 encrypted
            </div>
          </div>
          {cols.map(([title, items]) => (
            <div key={title}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-4)]">{title}</p>
              <ul className="mt-4 space-y-2.5">
                {items.map(([label, to]) => <li key={label}><FootLink to={to}>{label}</FootLink></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[var(--border-soft)] pt-8">
          <p className="text-[13px] text-[var(--fg-4)]">© 2026 CloudBudgetMaster, Inc. All rights reserved.</p>
          <div className="flex items-center gap-6 text-[13px] text-[var(--fg-4)]">
            <Link to="/privacy" className="hover:text-[var(--fg-2)]">Privacy</Link>
            <Link to="/terms" className="hover:text-[var(--fg-2)]">Terms</Link>
            <Link to="/contact" className="hover:text-[var(--fg-2)]">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

function ChatBubble({ onClick }) {
  return (
    <button onClick={onClick}
      className="group fixed bottom-6 right-6 z-[70] flex items-center gap-2.5 rounded-full py-3 pl-3.5 pr-5 text-[14px] font-semibold text-[#1a1205] shadow-[var(--glow-orange)] transition-transform hover:scale-105"
      style={{ background: 'var(--grad-orange)' }}>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1a1205]/15">
        <Icon d={PATHS.spark} className="h-4 w-4" sw={2} />
      </span>
      <span className="hidden sm:inline">Ask the cost AI</span>
    </button>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const start = () => navigate('/register')
  const signIn = () => navigate('/login')
  return (
    <div id="top" className="min-h-screen bg-[var(--canvas)]">
      <LandingNav onCta={start} onSignIn={signIn} />
      <main>
        <Hero onCta={start} />
        <TrustStrip />
        <Stats />
        <Features />
        <HowItWorks />
        <SavingsCalc onCta={start} />
        <AIPeek />
        <Pricing onCta={start} />
        <FinalCTA onCta={start} />
      </main>
      <Footer />
      <ChatBubble onClick={start} />
    </div>
  )
}
