import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import NsNav from '../components/ns/NsNav'
import NsFooter from '../components/ns/NsFooter'
import NotifyMeForm from '../components/ns/NotifyMeForm'

const PLANS = [
  {
    name: 'AWS bill health check',
    tagline: 'The full read: waste, idle spend, and hidden fees in one report.',
    price: '$49',
    featured: true,
    href: '/health-check',
    features: [
      'Idle & orphaned resource detection',
      'Hidden networking cost breakdown',
      'AI / Bedrock / GPU spend flags',
      'Report delivered in minutes',
    ],
  },
  {
    name: 'AI / GPU cost audit',
    tagline: 'Isolate Bedrock, SageMaker and GPU instance spend line by line.',
    price: '$79',
    notify: true,
    features: [
      'Bedrock & SageMaker invocation cost trace',
      'GPU instance utilization vs. spend',
      'Model-by-model dollar breakdown',
      'Runaway-spend early warning list',
    ],
  },
  {
    name: 'MSP white-label report',
    tagline: 'Branded reports you can send straight to clients.',
    price: '$149',
    notify: true,
    features: [
      'Your logo and colors on the report',
      'Batch process multiple client CSVs',
      'Per-client findings and summaries',
      'Delivered same day',
    ],
  },
  {
    name: 'RI / Savings Plan analysis',
    tagline: 'Coverage gaps and commitment recommendations from usage history.',
    price: '$99',
    waitlist: true,
    features: [
      'Reserved Instance coverage gaps',
      'Savings Plan sizing recommendation',
      'Break-even and payback estimate',
      'Commitment risk flags',
    ],
  },
  {
    name: 'Networking cost teardown',
    tagline: 'NAT, egress, cross-AZ and IPv4 rent, broken down by resource.',
    price: '$39',
    notify: true,
    features: [
      'NAT Gateway processing fee breakdown',
      'Cross-AZ & inter-region transfer map',
      'IPv4 address rent audit',
      'Per-resource $/month detail',
    ],
  },
]

export default function NsProducts() {
  useEffect(() => {
    document.title = 'Products - CloudBudgetMaster AWS bill audits'
  }, [])

  const buyButtonStyle = (featured) => ({
    background: featured ? 'var(--cbm-primary)' : 'transparent',
    borderColor: featured ? 'var(--cbm-primary)' : 'var(--cbm-border-strong)',
    color: featured ? 'var(--cbm-primary-text)' : 'var(--cbm-fg)',
    boxShadow: featured ? 'var(--cbm-glow)' : 'none',
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--cbm-canvas)', color: 'var(--cbm-fg)', fontFamily: 'var(--cbm-font-sans)' }}>
      <NsNav active="products" ctaLabel="Run my free check" ctaHref="/#free" />

      {/* HEADER */}
      <section className="px-6 pb-4 pt-14">
        <div className="mx-auto max-w-[820px] text-center">
          <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cbm-accent-text)' }}>Products</p>
          <h1 className="mt-3 text-[36px] font-extrabold tracking-[-0.01em]" style={{ color: 'var(--cbm-fg)' }}>One-time reports. No account, ever.</h1>
          <p className="mx-auto mt-3.5 max-w-[560px] text-[15.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
            Every product below reads a CSV you upload and returns a report. Pay once, no subscription, no login, no cloud credentials.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>
            <span>No signup</span><span>&middot;</span><span>No cloud access</span><span>&middot;</span><span>Read-only</span><span>&middot;</span><span>File deleted after processing</span>
          </div>
        </div>
      </section>

      {/* PRICING GRID */}
      <section className="px-6 py-6 pb-20">
        <div className="mx-auto grid max-w-[1160px] gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {PLANS.map((pl) => (
            <div
              key={pl.name}
              className="relative flex flex-col rounded-2xl border p-6"
              style={{ borderColor: pl.featured ? 'var(--cbm-primary)' : 'var(--cbm-border)', background: 'var(--cbm-surface)' }}
            >
              {pl.featured && (
                <div
                  className="absolute -top-3 left-5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: 'var(--cbm-primary)', color: 'var(--cbm-primary-text)' }}
                >
                  Most popular
                </div>
              )}
              <p
                className="mb-1.5 w-fit rounded-[6px] px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide"
                style={{ color: 'var(--cbm-positive)', background: 'var(--cbm-positive-tint)' }}
              >
                No signup
              </p>
              <h3 className="mb-1 mt-3 text-[17px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{pl.name}</h3>
              <p className="mb-3.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)', minHeight: 40 }}>{pl.tagline}</p>
              <div className="mb-4 flex items-baseline gap-1.5">
                <span className="font-mono text-[32px] font-extrabold" style={{ color: 'var(--cbm-fg)' }}>{pl.price}</span>
                <span className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>one-time</span>
              </div>
              <div className="mb-5 flex flex-1 flex-col gap-2.5">
                {pl.features.map((feat) => (
                  <div key={feat} className="flex items-start gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cbm-positive)" strokeWidth="2" className="mt-0.5 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-[13px] leading-snug" style={{ color: 'var(--cbm-fg-2)' }}>{feat}</span>
                  </div>
                ))}
              </div>

              {pl.waitlist ? (
                <NotifyMeForm
                  productName={pl.name}
                  buttonClassName="rounded-[10px] border px-2.5 py-2.5 text-[13px] font-bold cursor-pointer"
                  buttonStyle={{ borderColor: 'var(--cbm-border-strong)', background: 'transparent', color: 'var(--cbm-fg)' }}
                />
              ) : pl.notify ? (
                <NotifyMeForm
                  productName={pl.name}
                  buttonClassName="rounded-[10px] border px-2.5 py-2.5 text-[13px] font-bold cursor-pointer"
                  buttonStyle={buyButtonStyle(pl.featured)}
                />
              ) : (
                <Link
                  to={pl.href}
                  className="block rounded-[10px] border py-[11px] text-center text-[13.5px] font-bold"
                  style={buyButtonStyle(pl.featured)}
                >
                  Buy for {pl.price}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <NsFooter compact />
    </div>
  )
}
