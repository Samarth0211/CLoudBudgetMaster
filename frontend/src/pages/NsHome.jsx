import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import NsNav from '../components/ns/NsNav'
import NsFooter from '../components/ns/NsFooter'
import FreeCheckUploader from '../components/ns/FreeCheckUploader'

const TRUST_ITEMS = [
  { label: 'No signup', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'No cloud access', icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: 'We delete your file after', icon: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0' },
  { label: 'Read-only', icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z' },
  { label: 'Open-source scanner', icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5' },
]

const HERO_FINDINGS = [
  { type: 'NAT GW', id: 'nat-0f2e88b1 · us-west-2', cost: '$392/mo', color: 'var(--cbm-info)', tint: 'var(--cbm-info-tint)' },
  { type: 'Bedrock', id: 'anthropic.claude-3', cost: '$1,262/mo', color: 'var(--cbm-ai)', tint: 'var(--cbm-ai-tint)' },
  { type: 'EC2', id: 'i-0a3f9c72e91b45e2c', cost: '$184/mo', color: 'var(--cbm-waste)', tint: 'var(--cbm-waste-tint)' },
]

const CATCH_CARDS = [
  {
    title: 'AI, Bedrock & GPU runaway spend',
    desc: 'Bedrock model invocations, SageMaker endpoints left running, and GPU instances that scale spend faster than any budget alert can react.',
    icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z',
    color: 'var(--cbm-ai)', tint: 'var(--cbm-ai-tint)',
  },
  {
    title: 'Hidden networking costs',
    desc: 'NAT Gateway processing fees, cross-AZ and inter-region data transfer, and IPv4 address rent that never show up as their own line item.',
    icon: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582',
    color: 'var(--cbm-info)', tint: 'var(--cbm-info-tint)',
  },
  {
    title: 'Idle, orphaned & EKS traps',
    desc: 'Stopped EC2 still billing EBS, unattached Elastic IPs, idle RDS, and EKS clusters with control planes and node groups nobody scaled down.',
    icon: 'M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3',
    color: 'var(--cbm-waste)', tint: 'var(--cbm-waste-tint)',
  },
]

const SAMPLE_FINDINGS = [
  { type: 'EC2', id: 'i-0a3f9c72e91b45e2c', region: 'us-east-1', reason: 'Stopped, still incurring EBS charges', cost: '$184/mo', color: 'var(--cbm-waste)', tint: 'var(--cbm-waste-tint)' },
  { type: 'NAT GW', id: 'nat-0f2e88b1', region: 'us-west-2', reason: 'Idle NAT Gateway, no active routes in 14 days', cost: '$392/mo', color: 'var(--cbm-info)', tint: 'var(--cbm-info-tint)' },
  { type: 'Elastic IP', id: '52.14.xxx.xxx', region: 'us-east-1', reason: 'Not attached to any instance', cost: '$3.60/mo', color: 'var(--cbm-orphaned)', tint: 'rgba(236,72,153,0.10)' },
  { type: 'Bedrock', id: 'anthropic.claude-3', region: 'us-east-1', reason: 'Invocation volume up 340% week over week', cost: '$1,262/mo', color: 'var(--cbm-ai)', tint: 'var(--cbm-ai-tint)' },
]

const PRODUCTS = [
  { name: 'Free bill check', desc: 'A quick, in-browser health summary of your CSV.', price: '$0', tag: 'Free', free: true, href: '/#free' },
  { name: 'AWS bill health check', desc: 'The full read: waste, idle spend, hidden fees.', price: '$49', tag: 'One-time', href: '/health-check' },
  { name: 'AI / GPU cost audit', desc: 'Bedrock, SageMaker & GPU spend, explained.', price: '$79', tag: 'One-time', href: '/products' },
  { name: 'MSP white-label report', desc: 'Branded client reports, delivered same day.', price: '$149', tag: 'One-time', href: '/products' },
  { name: 'RI / Savings Plan analysis', desc: 'Coverage gaps and commitment sizing.', price: '$99', tag: 'Waitlist', href: '/products' },
  { name: 'Networking cost teardown', desc: 'NAT, egress, cross-AZ and IPv4 rent detail.', price: '$39', tag: 'One-time', href: '/products' },
]

const STEPS = [
  { num: '01', title: 'Upload your CSV', desc: 'Export your AWS Cost and Usage Report or billing CSV and drop it in on the products page.', icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3' },
  { num: '02', title: 'We scan, read-only', desc: 'The scanner parses line items for known waste patterns. No API calls into your AWS account, no credentials.', icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' },
  { num: '03', title: 'Get your report', desc: 'A findings report with dollar amounts and resource IDs. No account was ever created.', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
]

export default function NsHome() {
  useEffect(() => {
    document.title = 'CloudBudgetMaster - AWS bill charges your alarms never caught'
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--cbm-canvas)', color: 'var(--cbm-fg)', fontFamily: 'var(--cbm-font-sans)' }}>
      <NsNav active="home" ctaHref="/#free" />

      {/* HERO */}
      <section className="px-6 pb-6 pt-16">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          <div>
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px]"
              style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-glass-2)', color: 'var(--cbm-fg-2)' }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--cbm-primary)' }} />
              AWS billing analysis &middot; read-only &middot; no signup
            </div>
            <h1 className="m-0 text-[46px] font-extrabold leading-[1.08] tracking-[-0.022em]" style={{ color: 'var(--cbm-fg)' }}>
              The AWS charges<br />your alarms<br />
              <span style={{ color: 'var(--cbm-accent-text)' }}>never caught.</span>
            </h1>
            <p className="mt-[22px] max-w-[480px] text-[16.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
              AWS Budgets and Cost Anomaly Detection watch the total. We read the line items and surface the surprise charges underneath: idle resources, NAT and data-transfer fees, IPv4 rent, EKS traps, and runaway AI and GPU spend.
            </p>
            <div className="mt-[30px] flex flex-wrap items-center gap-3">
              <Link
                to="/#free"
                className="inline-flex items-center gap-2 rounded-[11px] px-6 py-[13px] text-[14px] font-bold"
                style={{ background: 'var(--cbm-primary)', color: 'var(--cbm-primary-text)', boxShadow: 'var(--cbm-glow)' }}
              >
                Run a free check
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                to="/products"
                className="rounded-[11px] border px-6 py-[13px] text-[14px] font-semibold"
                style={{ borderColor: 'var(--cbm-border-strong)', color: 'var(--cbm-fg-2)' }}
              >
                See all products
              </Link>
            </div>
            <div className="mt-[26px] flex flex-wrap gap-x-[18px] gap-y-2">
              {TRUST_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cbm-positive)" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* HERO REPORT VISUAL */}
          <div className="relative">
            <div className="overflow-hidden rounded-[18px] border" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)', boxShadow: 'var(--cbm-shadow-lg)' }}>
              <div className="flex items-center gap-2.5 border-b px-[18px] py-[13px]" style={{ borderColor: 'var(--cbm-border-soft)' }}>
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full opacity-60" style={{ background: 'var(--cbm-waste)' }} />
                  <div className="h-2.5 w-2.5 rounded-full opacity-60" style={{ background: 'var(--cbm-primary)' }} />
                  <div className="h-2.5 w-2.5 rounded-full opacity-60" style={{ background: 'var(--cbm-positive)' }} />
                </div>
                <span className="ml-1 font-mono text-[11.5px]" style={{ color: 'var(--cbm-fg-4)' }}>aws-bill-health-check.pdf</span>
                <span
                  className="ml-auto rounded-[6px] px-[7px] py-[3px] text-[9.5px] font-bold uppercase tracking-wide"
                  style={{ color: 'var(--cbm-accent-text)', background: 'var(--cbm-primary-tint)' }}
                >
                  Example
                </span>
              </div>
              <div className="p-[22px]">
                <p className="m-0 text-[11px] uppercase tracking-wider" style={{ color: 'var(--cbm-fg-4)' }}>Potential monthly savings (example)</p>
                <p className="mb-[18px] mt-1 font-mono text-[38px] font-extrabold leading-none" style={{ color: 'var(--cbm-positive)' }}>
                  $1,842<span className="text-[16px] font-semibold" style={{ color: 'var(--cbm-fg-4)' }}>/mo</span>
                </p>
                <div className="flex flex-col gap-2">
                  {HERO_FINDINGS.map((f) => (
                    <div
                      key={f.id}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[11px] border px-[13px] py-[11px]"
                      style={{ borderColor: 'var(--cbm-border-soft)', background: 'var(--cbm-glass-1)' }}
                    >
                      <span className="rounded-[6px] px-[7px] py-[3px] text-[9.5px] font-bold uppercase tracking-wide" style={{ color: f.color, background: f.tint }}>
                        {f.type}
                      </span>
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px]" style={{ color: 'var(--cbm-fg-2)' }}>{f.id}</span>
                      <span className="font-mono text-[13px] font-bold" style={{ color: 'var(--cbm-waste)' }}>{f.cost}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT WE CATCH */}
      <section id="catch" className="mt-12 border-t px-6 py-20" style={{ borderColor: 'var(--cbm-border-soft)', background: 'var(--cbm-surface-raised)' }}>
        <div className="mx-auto max-w-[1120px]">
          <div className="mx-auto mb-12 max-w-[640px] text-center">
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cbm-accent-text)' }}>What we catch</p>
            <h2 className="mt-2.5 text-[32px] font-bold tracking-[-0.015em]" style={{ color: 'var(--cbm-fg)' }}>The waste your own alarms miss</h2>
            <p className="mt-3.5 text-[15.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
              Budgets and anomaly detection watch totals, not root causes. We read the line items and name the specific resources.
            </p>
          </div>
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {CATCH_CARDS.map((c) => (
              <div key={c.title} className="rounded-2xl border" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)', padding: 26 }}>
                <div className="mb-[18px] inline-flex h-[46px] w-[46px] items-center justify-center rounded-[13px]" style={{ background: c.tint, color: c.color }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
                  </svg>
                </div>
                <h3 className="mb-[9px] text-[16.5px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{c.title}</h3>
                <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FREE CHECK */}
      <section id="free" className="px-6 py-20">
        <div className="mx-auto max-w-[720px]">
          <div className="mb-10 text-center">
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cbm-accent-text)' }}>Free bill check</p>
            <h2 className="mt-2.5 text-[30px] font-bold tracking-[-0.015em]" style={{ color: 'var(--cbm-fg)' }}>Upload your CSV, see real findings</h2>
            <p className="mt-3.5 text-[15px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
              This runs against the real scanner, not a demo. No signup, no cloud access, and the file is deleted once the scan finishes.
            </p>
          </div>
          <FreeCheckUploader />
        </div>
      </section>

      {/* SAMPLE REPORT */}
      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-[900px] items-center gap-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div>
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cbm-accent-text)' }}>Sample report</p>
            <h2 className="mt-3 text-[30px] font-bold tracking-[-0.015em]" style={{ color: 'var(--cbm-fg)' }}>A plain findings list, with dollar amounts</h2>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
              Every finding names the resource type, its ID, the region, the monthly cost, and why it is flagged. No dashboards to learn, no charts to interpret. The numbers below are an illustrative example, not a real account.
            </p>
            <Link to="/#free" className="mt-[22px] inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: 'var(--cbm-accent-text)' }}>
              Run a free check on your own bill
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)', boxShadow: 'var(--cbm-shadow-md)' }}>
            <div className="flex items-center justify-between border-b px-[18px] py-3.5" style={{ borderColor: 'var(--cbm-border-soft)' }}>
              <span className="font-mono text-[11.5px]" style={{ color: 'var(--cbm-fg-4)' }}>findings.csv</span>
              <span className="rounded-[6px] px-[7px] py-[3px] text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--cbm-accent-text)', background: 'var(--cbm-primary-tint)' }}>Example</span>
            </div>
            <div className="flex flex-col">
              {SAMPLE_FINDINGS.map((f) => (
                <div key={f.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b px-4 py-3.5 last:border-b-0" style={{ borderColor: 'var(--cbm-border-soft)' }}>
                  <span className="rounded-[6px] px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: f.color, background: f.tint }}>{f.type}</span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12.5px]" style={{ color: 'var(--cbm-fg-1)' }}>{f.id} &middot; {f.region}</p>
                    <p className="mt-0.5 text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>{f.reason}</p>
                  </div>
                  <span className="whitespace-nowrap font-mono text-[13.5px] font-bold" style={{ color: 'var(--cbm-waste)' }}>{f.cost}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS TEASER */}
      <section className="border-t px-6 py-20" style={{ borderColor: 'var(--cbm-border-soft)', background: 'var(--cbm-surface-raised)' }}>
        <div className="mx-auto max-w-[1120px]">
          <div className="mx-auto mb-12 max-w-[640px] text-center">
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cbm-accent-text)' }}>Products</p>
            <h2 className="mt-2.5 text-[32px] font-bold tracking-[-0.015em]" style={{ color: 'var(--cbm-fg)' }}>Start free, or go deeper for a one-time fee</h2>
            <p className="mt-3.5 text-[15.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
              Every product reads a CSV you upload and returns a report. No account, no subscription, no cloud credentials.
            </p>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {PRODUCTS.map((p) => (
              <Link
                key={p.name}
                to={p.href}
                className="flex flex-col rounded-[14px] border p-5"
                style={{ borderColor: p.free ? 'var(--cbm-positive-border)' : 'var(--cbm-border)', background: 'var(--cbm-surface)', color: 'inherit' }}
              >
                <p
                  className="mb-2.5 w-fit rounded-[6px] px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-wide"
                  style={{ color: p.free ? 'var(--cbm-positive)' : 'var(--cbm-fg-4)', background: p.free ? 'var(--cbm-positive-tint)' : 'var(--cbm-glass-2)' }}
                >
                  {p.tag}
                </p>
                <h3 className="mb-[5px] text-[14px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{p.name}</h3>
                <p className="mb-3.5 flex-1 text-[12px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>{p.desc}</p>
                <p className="m-0 font-mono text-[19px] font-extrabold" style={{ color: 'var(--cbm-fg)' }}>{p.price}</p>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/products" className="inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: 'var(--cbm-accent-text)' }}>
              Compare all products
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-[1000px]">
          <div className="mx-auto mb-12 max-w-[640px] text-center">
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cbm-accent-text)' }}>How it works</p>
            <h2 className="mt-2.5 text-[32px] font-bold tracking-[-0.015em]" style={{ color: 'var(--cbm-fg)' }}>No account. Three steps.</h2>
          </div>
          <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {STEPS.map((s) => (
              <div key={s.num} className="text-center">
                <div
                  className="mx-auto mb-[18px] flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-2xl border"
                  style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-glass-2)' }}
                >
                  <span className="text-[10px] font-bold tracking-[0.1em]" style={{ color: 'var(--cbm-accent-text)' }}>{s.num}</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cbm-fg-2)" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                  </svg>
                </div>
                <h3 className="mb-[9px] text-[15px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{s.title}</h3>
                <p className="mx-auto max-w-[260px] text-[13.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="px-6 pb-20">
        <div className="relative mx-auto max-w-[1000px] overflow-hidden rounded-3xl border p-8 text-center sm:p-12" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)' }}>
          <div
            className="pointer-events-none absolute -top-10 left-1/2 h-40 w-[360px] -translate-x-1/2 rounded-full blur-[80px]"
            style={{ background: 'var(--cbm-primary-tint)' }}
          />
          <div className="relative">
            <h2 className="m-0 text-[28px] font-extrabold tracking-[-0.015em]" style={{ color: 'var(--cbm-fg)' }}>See what your alarms missed</h2>
            <p className="mx-auto mt-3.5 max-w-[460px] text-[15px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
              Upload your billing CSV and get a free health check. No signup, no cloud access, and we delete your file when the scan finishes.
            </p>
            <Link
              to="/#free"
              className="mt-[26px] inline-flex items-center gap-2 rounded-[11px] px-[26px] py-[13px] text-[14px] font-bold"
              style={{ background: 'var(--cbm-primary)', color: 'var(--cbm-primary-text)', boxShadow: 'var(--cbm-glow)' }}
            >
              Run a free check
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <NsFooter />
    </div>
  )
}
