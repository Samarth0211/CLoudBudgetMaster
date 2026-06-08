import { useEffect } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import BrandLogo from '../components/shared/BrandLogo'
import JsonLd from '../components/shared/JsonLd'

// Honest, fair positioning — we don't claim competitor specifics that could be wrong;
// we describe who each is best for and where CloudBudgetMaster fits.
const COMPETITORS = {
  vantage: {
    name: 'Vantage',
    bestFor: 'Mid-size to enterprise teams wanting a deep multi-cloud cost platform (AWS, GCP, Azure, Datadog, Snowflake, and more).',
    strength: 'Broad provider coverage, cost reports, and an active community. A strong, mature product.',
    fit: "if you're a small team or solo founder who wants idle-resource savings and a clean report in 5 minutes, without onboarding a full platform.",
  },
  spot: {
    name: 'Spot.io (NetApp)',
    bestFor: 'Teams that want automated infrastructure optimization — Spot instance automation, autoscaling, and Kubernetes cost control.',
    strength: 'Deep automation that actively manages compute (it changes your infra to cut cost).',
    fit: 'if you want read-only visibility into waste first — what you’re wasting and how much — before handing automation control of your infrastructure.',
  },
  finout: {
    name: 'Finout',
    bestFor: 'Enterprise FinOps teams needing cost allocation, shared-cost splitting, and chargeback across complex orgs.',
    strength: 'Powerful enterprise cost allocation and unit-economics tooling.',
    fit: 'if you mainly need to find and kill idle/unused resources with exact dollar figures, on a free plan, without an enterprise rollout.',
  },
}

const ROWS = [
  ['Best for', 'Indie founders & small teams', (c) => c.bestFor.split(' ').slice(0, 6).join(' ') + '…'],
  ['Free plan', 'Yes — free forever, no card', 'Typically paid / sales-led'],
  ['Setup', 'Read-only keys, ~5 minutes', 'Varies'],
  ['Access model', 'Read-only — never changes your infra', 'Varies'],
  ['Per-resource cost', 'Exact, from the AWS Pricing API', 'Varies'],
  ['Clouds', 'AWS & GCP (Azure coming)', 'Often broader'],
]

export default function VsPage() {
  const { slug } = useParams()
  const c = COMPETITORS[slug]
  useEffect(() => { if (c) document.title = `CloudBudgetMaster vs ${c.name} — honest comparison` }, [c])
  if (!c) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--fg-1)]">
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'WebPage',
        name: `CloudBudgetMaster vs ${c.name}`,
        description: `An honest comparison of CloudBudgetMaster and ${c.name} for cloud cost optimization.`,
      }} />
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-[var(--fg)]"><BrandLogo className="h-7 w-7" />CloudBudgetMaster</Link>
          <Link to="/register" className="rounded-lg bg-[#FF9900] px-4 py-2 text-sm font-semibold text-[#1a1205]">Start free</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FF9900]">Comparison</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-[var(--fg)] tracking-tight">CloudBudgetMaster vs {c.name}</h1>
        <p className="mt-3 text-[var(--fg-3)] text-lg leading-relaxed">
          Both help you cut cloud costs — they’re built for different teams. Here’s an honest take.
        </p>

        <div className="mt-7 grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#FF9900]/30 bg-[#FF9900]/[0.06] p-5">
            <h2 className="font-bold text-[var(--fg)]">CloudBudgetMaster</h2>
            <p className="mt-2 text-sm text-[var(--fg-2)]">Read-only waste finder for AWS &amp; GCP. Find idle/unused resources with exact $/month, a client-ready report, and spike alerts — free, in ~5 minutes. Built for indie founders &amp; small teams.</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--ink)] p-5">
            <h2 className="font-bold text-[var(--fg)]">{c.name}</h2>
            <p className="mt-2 text-sm text-[var(--fg-2)]">{c.bestFor} {c.strength}</p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead><tr className="bg-[var(--glass-2)] text-left text-[var(--fg-3)]">
              <th className="px-4 py-2.5 font-medium"></th><th className="px-4 py-2.5 font-medium text-[#FF9900]">CloudBudgetMaster</th><th className="px-4 py-2.5 font-medium">{c.name}</th>
            </tr></thead>
            <tbody>
              {ROWS.map(([label, ours, theirs], i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2.5 text-[var(--fg-3)]">{label}</td>
                  <td className="px-4 py-2.5 text-[var(--fg-1)] font-medium">{ours}</td>
                  <td className="px-4 py-2.5 text-[var(--fg-2)]">{typeof theirs === 'function' ? theirs(c) : theirs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-[var(--fg-3)] leading-relaxed">
          <strong className="text-[var(--fg-1)]">Bottom line:</strong> {c.name} is a great choice {c.bestFor.toLowerCase().startsWith('mid') || c.bestFor.toLowerCase().startsWith('enterprise') || c.bestFor.toLowerCase().startsWith('teams') ? 'for' : 'if you’re'} {c.bestFor.replace(/\.$/, '')}. Choose CloudBudgetMaster {c.fit}
        </p>

        <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--ink)] p-7 text-center">
          <h2 className="text-xl font-bold text-[var(--fg)]">See your waste in 5 minutes — free</h2>
          <p className="mt-2 text-[var(--fg-3)]">Read-only, no credit card. Find what you’re wasting before you commit to anything bigger.</p>
          <Link to="/register" className="mt-5 inline-flex rounded-xl bg-[#FF9900] px-6 py-3 font-semibold text-[#1a1205]">Try CloudBudgetMaster free</Link>
        </div>
      </main>
    </div>
  )
}
