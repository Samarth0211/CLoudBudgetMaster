import MarketingShell from '../components/shared/MarketingShell'

function Check() {
  return (
    <svg className="mt-0.5 h-5 w-5 shrink-0 text-[var(--positive)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--ink)] p-6">
      <h2 className="text-[18px] font-semibold text-white">{title}</h2>
      <div className="mt-3 text-[14px] leading-relaxed text-[var(--fg-3)]">{children}</div>
    </div>
  )
}

export default function Security() {
  return (
    <MarketingShell
      eyebrow="Security"
      title="How we keep your cloud access safe"
      subtitle="CloudBudgetMaster needs read-only access to find waste — and nothing more. Here is exactly what we do, and what we will never do."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Card title="Read-only by design">
          Every cloud API call we make is read-only. We list and describe resources and read billing data —
          we never create, modify, stop, or delete anything in your account.
        </Card>
        <Card title="Encrypted credentials">
          Cloud credentials are encrypted with <span className="mono text-[var(--fg-1)]">AES-256</span> (Fernet)
          before they are written to the database, and decrypted only in memory at scan time. They are never
          stored in plaintext and never written to logs.
        </Card>
        <Card title="Per-account data isolation">
          The database enforces Row-Level Security, and every query is additionally scoped to your user ID.
          Your resources, costs, and alerts are only ever visible to you.
        </Card>
        <Card title="Authenticated access">
          Accounts are protected by Supabase Auth with JWT sessions on every request, plus email verification
          and a strong-password policy at signup.
        </Card>
      </div>

      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--ink-2)] p-6">
        <h2 className="text-[18px] font-semibold text-white">The permissions we ask for</h2>
        <p className="mt-2 text-[14px] text-[var(--fg-3)]">
          For AWS you attach a read-only IAM user. Representative permissions:
        </p>
        <pre className="mono mt-4 overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--ink-3)] p-4 text-[12px] leading-relaxed text-[var(--fg-2)]">{`ce:GetCostAndUsage
ec2:DescribeInstances        ec2:DescribeVolumes
rds:DescribeDBInstances      cloudwatch:GetMetricStatistics
ec2:DescribeAddresses        ec2:DescribeRegions`}</pre>
        <p className="mt-3 text-[13px] text-[var(--fg-4)]">No write, delete, or modify permissions are ever requested.</p>
      </div>

      <div className="mt-8 rounded-2xl border border-[var(--waste-tint)] bg-[var(--waste-tint)] p-6">
        <h2 className="text-[18px] font-semibold text-white">What we never do</h2>
        <ul className="mt-3 space-y-2.5">
          {[
            'Modify, stop, or delete any of your cloud resources',
            'Store cloud credentials in plaintext or log them anywhere',
            'Request write access to your infrastructure',
            'Sell, share, or use your usage data for anything other than your dashboard',
          ].map(t => (
            <li key={t} className="flex items-start gap-3 text-[14px] text-[var(--fg-2)]"><Check />{t}</li>
          ))}
        </ul>
      </div>

      <p className="mt-8 text-[14px] text-[var(--fg-4)]">
        Found a security issue? Please reach out via our <a href="/contact" className="text-[var(--orange-bright)] hover:underline">contact page</a> — we take reports seriously.
      </p>
    </MarketingShell>
  )
}
