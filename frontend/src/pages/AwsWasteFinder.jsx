import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/shared/BrandLogo'
import JsonLd from '../components/shared/JsonLd'

const SCRIPT = `#!/usr/bin/env bash
# CloudBudgetMaster — free AWS waste finder (read-only; nothing leaves your machine)
# Requires the AWS CLI, configured with read access. Run:  bash waste-finder.sh
set -uo pipefail
REGION="\${AWS_REGION:-us-east-1}"
echo "Scanning AWS ($REGION) — read-only..."

echo -e "\\n== Unattached EBS volumes (billed while 'available') =="
aws ec2 describe-volumes --filters Name=status,Values=available --region "$REGION" \\
  --query 'Volumes[].{Volume:VolumeId,GiB:Size,Type:VolumeType}' --output table

echo -e "\\n== Unassociated Elastic IPs (~\\$3.65/mo each) =="
aws ec2 describe-addresses --region "$REGION" \\
  --query 'Addresses[?AssociationId==\`null\`].{IP:PublicIp,Alloc:AllocationId}' --output table

echo -e "\\n== Stopped EC2 (you still pay for attached EBS) =="
aws ec2 describe-instances --filters Name=instance-state-name,Values=stopped --region "$REGION" \\
  --query 'Reservations[].Instances[].{Instance:InstanceId,Type:InstanceType}' --output table

echo -e "\\n== RDS with 0 connections in the last 24h (likely idle) =="
for db in $(aws rds describe-db-instances --region "$REGION" --query 'DBInstances[].DBInstanceIdentifier' --output text); do
  sum=$(aws cloudwatch get-metric-statistics --region "$REGION" --namespace AWS/RDS \\
    --metric-name DatabaseConnections --dimensions Name=DBInstanceIdentifier,Value="$db" \\
    --start-time "$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -v-1d +%Y-%m-%dT%H:%M:%S)" \\
    --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" --period 86400 --statistics Sum \\
    --query 'Datapoints[0].Sum' --output text 2>/dev/null)
  [ "$sum" = "0.0" ] || [ "$sum" = "None" ] && echo "  IDLE: $db"
done

echo -e "\\nDone. Want this automatically + the exact \\$/month, tracked over time?"
echo "→ https://cloudbudgetmaster.com (free, read-only)"
`

export default function AwsWasteFinder() {
  const [copied, setCopied] = useState(false)
  useEffect(() => { document.title = 'Free AWS Waste Finder — read-only script | CloudBudgetMaster' }, [])

  const copy = async () => {
    try { await navigator.clipboard.writeText(SCRIPT); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--fg-1)]">
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'HowTo',
        name: 'Find wasted AWS spend with a free read-only script',
        description: 'A free, read-only AWS CLI script that finds unattached EBS volumes, unassociated Elastic IPs, stopped EC2 instances, and idle RDS databases.',
        step: [
          { '@type': 'HowToStep', name: 'Copy the script' },
          { '@type': 'HowToStep', name: 'Run it with the AWS CLI' },
          { '@type': 'HowToStep', name: 'Review the idle/unused resources it lists' },
        ],
      }} />
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-[var(--fg)]"><BrandLogo className="h-7 w-7" />CloudBudgetMaster</Link>
          <Link to="/register" className="rounded-lg bg-[#FF9900] px-4 py-2 text-sm font-semibold text-[#1a1205]">Start free</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FF9900]">Free tool · no signup</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-[var(--fg)] tracking-tight">Find your wasted AWS spend in 2 minutes</h1>
        <p className="mt-3 text-[var(--fg-3)] text-lg leading-relaxed">
          A read-only script you run in your own terminal — <strong className="text-[var(--fg-1)]">nothing leaves your machine</strong>, no credentials shared, no signup. It lists the four most common AWS money leaks:
        </p>
        <ul className="mt-4 space-y-1.5 text-[var(--fg-2)]">
          <li>• Unattached <strong>EBS volumes</strong> (billed while idle)</li>
          <li>• Unassociated <strong>Elastic IPs</strong> (~$3.65/mo each)</li>
          <li>• <strong>Stopped EC2</strong> instances (you still pay for their storage)</li>
          <li>• <strong>Idle RDS</strong> databases (zero connections)</li>
        </ul>

        <div className="mt-7 rounded-xl border border-[var(--border)] bg-[#0f172a] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
            <span className="text-xs font-mono text-slate-400">waste-finder.sh</span>
            <button onClick={copy} className="rounded-md bg-[#FF9900] px-3 py-1 text-xs font-semibold text-[#1a1205]">{copied ? 'Copied ✓' : 'Copy script'}</button>
          </div>
          <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-slate-200 font-mono">{SCRIPT}</pre>
        </div>
        <p className="mt-3 text-sm text-[var(--fg-4)]">Requires the AWS CLI configured with read access (e.g. <code className="font-mono text-[var(--fg-2)]">ReadOnlyAccess</code>). Scans one region — set <code className="font-mono text-[var(--fg-2)]">AWS_REGION</code> to change it.</p>

        <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--ink)] p-7 text-center">
          <h2 className="text-xl font-bold text-[var(--fg)]">Want this automatically — with the exact $/month?</h2>
          <p className="mt-2 text-[var(--fg-3)]">CloudBudgetMaster connects read-only to AWS &amp; GCP and tracks waste across <em>all</em> regions, with real prices and monthly trends.</p>
          <Link to="/register" className="mt-5 inline-flex rounded-xl bg-[#FF9900] px-6 py-3 font-semibold text-[#1a1205]">Try it free — no card</Link>
        </div>

        <p className="mt-8 text-center text-sm text-[var(--fg-4)]"><Link to="/" className="hover:text-[var(--fg-2)]">← CloudBudgetMaster</Link></p>
      </main>
    </div>
  )
}
