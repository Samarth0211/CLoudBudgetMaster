import MarketingShell from '../components/shared/MarketingShell'
import { Link } from 'react-router-dom'

export default function About() {
  return (
    <MarketingShell
      eyebrow="About"
      title="Built by engineers tired of surprise cloud bills"
      subtitle="CloudBudgetMaster started with a familiar, expensive lesson: a forgotten test environment and a couple of idle databases quietly added thousands to a monthly cloud invoice — and nobody noticed until the bill arrived."
    >
      <div className="space-y-6 text-[15px] leading-relaxed text-[var(--fg-2)]">
        <p>
          The tools to catch that already exist inside every cloud console — they're just scattered across
          Cost Explorer, CloudWatch, a dozen service pages, and four separate provider dashboards. Finding the
          waste means knowing exactly where to look, on a schedule no one keeps.
        </p>
        <p>
          So we built the thing we wished we'd had: connect your accounts with read-only access, and let it do
          the boring part — scan every region, flag the idle and orphaned resources, put a dollar figure on each
          one, and warn you the moment spend starts to climb. One dashboard for AWS, GCP, Azure, and Snowflake.
        </p>
        <p>
          We're a small, independent team and we're honest about where we are: this is early. There's no
          venture-scale sales pitch here and no invented customer logos. If CloudBudgetMaster saves you money,
          that's the whole point.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          ['Read-only, always', 'We never touch your infrastructure.'],
          ['Multi-cloud', 'AWS, GCP, Azure & Snowflake in one place.'],
          ['Honest pricing', 'A real free plan. Upgrade only if it pays off.'],
        ].map(([t, s]) => (
          <div key={t} className="rounded-xl border border-[var(--border)] bg-[var(--ink)] p-5">
            <p className="text-[14px] font-semibold text-white">{t}</p>
            <p className="mt-1 text-[13px] text-[var(--fg-3)]">{s}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link to="/register" className="btn btn-primary px-6 py-3 text-[15px]">Start free</Link>
        <Link to="/contact" className="btn btn-ghost px-6 py-3 text-[15px]">Talk to us</Link>
      </div>
    </MarketingShell>
  )
}
