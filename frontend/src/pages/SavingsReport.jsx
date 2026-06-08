import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { generateCostReport } from '../lib/pdfReport'

const TYPE_LABEL = {
  ec2_instance: 'EC2 Instance', rds_instance: 'RDS Database', ebs_volume: 'EBS Volume',
  elastic_ip: 'Elastic IP', s3_bucket: 'S3 Bucket', compute_instance: 'Compute VM', persistent_disk: 'Persistent Disk',
}
const typeLabel = (t) => TYPE_LABEL[t] || (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const SVC = {
  'Amazon Elastic Compute Cloud - Compute': 'EC2', 'Amazon Relational Database Service': 'RDS',
  'Amazon Simple Storage Service': 'S3', 'AmazonCloudWatch': 'CloudWatch', 'AWS Key Management Service': 'KMS',
  'Amazon Virtual Private Cloud': 'VPC', 'Amazon Route 53': 'Route 53', 'Elastic Load Balancing': 'ELB',
  'Amazon ElastiCache': 'ElastiCache', 'Amazon Elastic Kubernetes Service': 'EKS', 'AWS Lambda': 'Lambda',
  'Amazon DynamoDB': 'DynamoDB', 'Amazon Elastic Block Store': 'EBS', 'AWS CloudTrail': 'CloudTrail',
  'Amazon Simple Notification Service': 'SNS', 'Amazon Simple Queue Service': 'SQS', 'AWS Config': 'Config',
}
const svcLabel = (n) => SVC[n] || (n || '').replace(/^Amazon /, '').replace(/^AWS /, '')
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const money0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString()}`
// Friendly name for whichever open-source model produced the narrative.
function modelLabel(m) {
  if (!m || m === 'rule-based') return 'Open-source AI'
  const id = m.split('/').pop()
  if (/kimi/i.test(m)) return 'Kimi K2'
  if (/gpt-oss-120b/i.test(id)) return 'GPT-OSS 120B'
  if (/gpt-oss/i.test(id)) return 'GPT-OSS'
  if (/qwen3-32b/i.test(id)) return 'Qwen3 32B'
  if (/llama-3\.3/i.test(id)) return 'Llama 3.3 70B'
  return id
}

async function fetchAllResources() {
  let page = 1, all = [], totalPages = 1
  do {
    const { data } = await api.get(`/resources?page=${page}&page_size=100`)
    all = all.concat(data.resources || [])
    totalPages = data.total_pages || 1
    page++
  } while (page <= totalPages && page < 50)
  return all
}

// Assemble the factual brief the AI model grounds its narrative in (no invented numbers).
function buildAiContext({ sum, svc, fc, conns, res, acct }) {
  const monthly = sum?.total_monthly_cost_usd || 0
  const waste = sum?.total_waste_cost_usd || 0
  const isWaste = (r) => r.waste_status && r.waste_status !== 'active'
  return {
    account_name: acct,
    connection_count: conns.length,
    resource_count: res.length,
    unused_count: res.filter(isWaste).length,
    monthly_cost: monthly,
    projected_month_end: fc?.projected_monthly ?? null,
    wow_percent: sum?.cost_change_wow_percent || 0,
    waste_cost: waste,
    waste_pct: monthly > 0 ? +((waste / monthly) * 100).toFixed(1) : 0,
    annual_savings: waste * 12,
    services: (svc || []).slice(0, 8).map(s => ({ name: svcLabel(s.service), cost: s.cost, pct: s.percent })),
    top_resources: res.slice().sort((a, b) => (b.monthly_cost_usd || 0) - (a.monthly_cost_usd || 0)).slice(0, 8)
      .map(r => ({ name: r.resource_name || r.resource_id, type: typeLabel(r.resource_type), region: r.region, monthly_cost: r.monthly_cost_usd })),
    top_waste: res.filter(isWaste).sort((a, b) => (b.waste_monthly_cost_usd || 0) - (a.waste_monthly_cost_usd || 0)).slice(0, 8)
      .map(r => ({ name: r.resource_name || r.resource_id, type: typeLabel(r.resource_type), waste_monthly: r.waste_monthly_cost_usd, reason: r.waste_reason || r.waste_status })),
  }
}

export default function SavingsReport() {
  const { theme } = useTheme()
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState([])
  const [connections, setConnections] = useState([])
  const [resources, setResources] = useState([])
  const [services, setServices] = useState([])
  const [forecast, setForecast] = useState(null)
  const [tags, setTags] = useState(null)
  const [account, setAccount] = useState('')
  const [insights, setInsights] = useState(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    (async () => {
      const [sum, tr, svc, fc, tg, conns, res] = await Promise.all([
        api.get('/dashboard/summary').then(r => r.data).catch(() => null),
        api.get('/dashboard/trend?days=30').then(r => r.data.data_points || []).catch(() => []),
        api.get('/dashboard/cost-by-service?days=30').then(r => r.data.services || []).catch(() => []),
        api.get('/dashboard/forecast').then(r => r.data).catch(() => null),
        api.get('/dashboard/cost-by-tag').then(r => r.data).catch(() => null),
        api.get('/connections').then(r => r.data.connections || []).catch(() => []),
        fetchAllResources().catch(() => []),
      ])
      const acct = conns.length === 1 ? conns[0].display_name : conns.length ? `${conns.length} cloud accounts` : 'All accounts'
      setSummary(sum); setTrend(tr); setServices(svc); setForecast(fc); setTags(tg)
      setConnections(conns); setResources(res); setAccount(acct)
      setLoading(false)

      // AI narrative (Kimi K2 via Groq) — non-blocking, the page is already usable.
      api.post('/dashboard/ai-insights', buildAiContext({ sum, svc, fc, conns, res, acct }))
        .then(r => setInsights(r.data))
        .catch(() => setInsights(null))
        .finally(() => setAiLoading(false))
    })()
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      // Make sure the AI narrative is in the PDF even if the user clicks before it loaded.
      let ins = insights
      if (!ins) {
        try {
          const r = await api.post('/dashboard/ai-insights', buildAiContext({ sum: summary, svc: services, fc: forecast, conns: connections, res: resources, acct: account }))
          ins = r.data; setInsights(r.data)
        } catch { ins = null }
      }
      await generateCostReport({ summary, trend, connections, resources, services, forecast, tags, account, insights: ins })
    } catch {
      alert('Could not generate the report. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#FF9900]" /></div>
  }

  // Headline = actual cloud bill (Cost Explorer), not the monitored-resource sum.
  const monitoredCost = summary?.total_monthly_cost_usd || 0
  const trendTotal = trend.reduce((s, p) => s + (p.total_cost_usd || 0), 0)
  const monthlyCost = trendTotal > 0 ? trendTotal : (forecast?.current_monthly ?? monitoredCost)
  const wasteCost = summary?.total_waste_cost_usd || 0
  const savingsPercent = monthlyCost > 0 ? ((wasteCost / monthlyCost) * 100).toFixed(1) : 0
  const annualSavings = wasteCost * 12
  const unused = resources.filter(r => r.waste_status && r.waste_status !== 'active').length
  const wow = summary?.cost_change_wow_percent || 0
  const topCost = resources.slice().sort((a, b) => (b.monthly_cost_usd || 0) - (a.monthly_cost_usd || 0)).slice(0, 10)
  const svcMax = Math.max(...services.map(s => s.cost), 1)
  const taggedGroups = (tags?.groups || [])
  const untagged = taggedGroups.find(g => g.tag_value === 'Untagged')
  const tagTotal = taggedGroups.reduce((s, g) => s + g.total_cost, 0)
  const taggedPct = tagTotal > 0 ? (((tagTotal - (untagged?.total_cost || 0)) / tagTotal) * 100).toFixed(0) : 0

  return (
    <div className="animate-fade-up pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Savings Report</h1>
          <p className="mt-1 text-sm text-slate-400">{account} · {resources.length} resources · {unused} idle/unused · last 30 days</p>
        </div>
        <button onClick={handleDownload} disabled={downloading}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--glass-2)] px-5 py-2.5 text-sm font-semibold text-[var(--fg-1)] hover:bg-[var(--glass-3)] disabled:opacity-60 transition-all">
          {downloading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          )}
          {downloading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {/* KPI strip */}
      <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
        <h2 className="text-lg font-bold text-white mb-4">Executive Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Kpi label="Cloud Spend (30d)" value={money(monthlyCost)}
            sub={wow !== 0 ? `${wow > 0 ? '▲' : '▼'} ${Math.abs(wow)}% WoW` : null} subColor={wow > 0 ? 'text-[#FF5247]' : 'text-emerald-400'} />
          <Kpi label="Projected Month-end" value={forecast ? money0(forecast.projected_monthly) : '—'}
            sub={forecast ? forecast.trend_direction : null} subColor={forecast?.trend_direction === 'increasing' ? 'text-[#FF5247]' : forecast?.trend_direction === 'decreasing' ? 'text-emerald-400' : 'text-slate-500'} />
          <Kpi label="Recoverable Waste" value={money(wasteCost)} color="text-[#FF5247]" />
          <Kpi label="% of Bill Recoverable" value={`${savingsPercent}%`} color="text-amber-400" />
          <Kpi label="Annual Savings" value={money0(annualSavings)} color="text-emerald-400" />
        </div>
        <p className="mt-3 text-xs text-slate-500">Cloud Spend is your actual AWS bill (Cost Explorer). Recoverable waste is from monitored compute &amp; storage — EC2, RDS, EBS, Elastic IPs; other services (Redshift, containers…) appear in Cost by Service.</p>
      </div>

      {/* AI analysis */}
      <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">AI Analysis</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9900]/10 px-2.5 py-1 text-[11px] font-medium text-[#FF9900]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF9900]" />
            {aiLoading ? 'Open-source AI' : modelLabel(insights?.model)}
          </span>
        </div>
        {aiLoading ? (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-[#FF9900]" />
            Analyzing your cloud spend…
          </div>
        ) : insights?.executive_summary ? (
          <div className="space-y-3 text-sm leading-relaxed text-slate-300">
            {insights.executive_summary.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        ) : (
          <p className="text-sm text-slate-500">AI analysis is unavailable right now. The data above and recommendations below are still accurate.</p>
        )}
      </div>

      {/* Cost by Service */}
      {services.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Cost by Service <span className="text-xs font-normal text-slate-500">(last 30 days)</span></h2>
          <div className="space-y-2.5">
            {services.slice(0, 10).map(s => (
              <div key={s.service} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm text-slate-200 truncate" title={s.service}>{svcLabel(s.service)}</span>
                <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#FF9900] to-[#EC7211]" style={{ width: `${(s.cost / svcMax) * 100}%` }} />
                </div>
                <span className="font-mono w-12 shrink-0 text-right text-xs text-slate-500">{s.percent}%</span>
                <span className="font-mono w-24 shrink-0 text-right text-sm font-semibold text-white">{money(s.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend */}
      {trend.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">30-Day Cost Trend</h2>
          <ResponsiveContainer width="100%" height={220} key={theme}>
            <AreaChart data={trend}>
              <defs><linearGradient id="rptGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF9900" stopOpacity={0.25} /><stop offset="100%" stopColor="#FF9900" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-track)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} minTickGap={28} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={48} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 12 }} formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Cost']} />
              <Area type="monotone" dataKey="total_cost_usd" stroke="#FF9900" strokeWidth={1.6} fill="url(#rptGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cost allocation by tag */}
      {taggedGroups.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Cost Allocation <span className="text-xs font-normal text-slate-500">by {tags.tag_key}</span></h2>
            <span className="text-xs text-slate-400">Tagging coverage: <span className={`font-semibold ${taggedPct >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{taggedPct}%</span></span>
          </div>
          <div className="space-y-2">
            {taggedGroups.slice(0, 8).map(g => (
              <div key={g.tag_value} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-slate-300 truncate">{g.tag_value}</span>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-[#3FA9F5]" style={{ width: `${tagTotal > 0 ? (g.total_cost / tagTotal) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-slate-500 w-10 text-right">{g.resource_count}</span>
                <span className="font-mono w-24 shrink-0 text-right font-semibold text-white">{money(g.total_cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top resources by cost */}
      {topCost.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Top Resources by Cost</h2>
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-sm">
              <thead><tr className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Resource</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Region</th><th className="px-3 py-2 font-medium text-right">Monthly</th>
              </tr></thead>
              <tbody>
                {topCost.map((r, i) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 text-white max-w-[260px] truncate" title={r.resource_name || r.resource_id}>{r.resource_name || r.resource_id}</td>
                    <td className="px-3 py-2 text-slate-300">{typeLabel(r.resource_type)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.region}</td>
                    <td className="px-3 py-2 font-mono text-right font-semibold text-white">{money(r.monthly_cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-connection sections */}
      {connections.map(conn => (
        <ConnectionSection key={conn.id} conn={conn} resources={resources.filter(r => r.connection_id === conn.id)} />
      ))}

      {/* Detailed suggestions */}
      <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
        <h2 className="text-lg font-bold text-white mb-4">Detailed Suggestions</h2>
        {insights?.suggestions?.length ? (
          <ol className="space-y-3">
            {insights.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#FF9900]/15 text-xs font-bold text-[#FF9900]">{i + 1}</span>
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-white">{s.title}</span>
                    {s.monthly_savings > 0 && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">~{money(s.monthly_savings)}/mo</span>}
                  </div>
                  <p className="mt-0.5 text-slate-300">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {wasteCost > 0 && <li className="flex items-start gap-2"><span className="text-[#FF5247] mt-0.5">1.</span><span>Terminate or right-size the {unused} idle/unused resources to save <strong className="text-white">{money(wasteCost)}/month</strong>.</span></li>}
            <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">2.</span><span>Configure cost-spike alerts to catch unexpected increases early.</span></li>
            {taggedPct < 80 && <li className="flex items-start gap-2"><span className="text-[#3FA9F5] mt-0.5">3.</span><span>Improve tagging coverage (currently {taggedPct}%) so spend can be attributed by team/app.</span></li>}
            <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">4.</span><span>Use Reserved Instances or Savings Plans for steady-state workloads.</span></li>
          </ul>
        )}
      </div>

      {/* Common questions (FAQ) */}
      {insights?.faq?.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6">
          <h2 className="text-lg font-bold text-white mb-4">Common Questions</h2>
          <div className="space-y-4">
            {insights.faq.map((f, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-white">{f.q}</p>
                <p className="mt-1 text-sm text-slate-300">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-600">Generated by CloudBudgetMaster · {new Date().toLocaleDateString()} · Download the PDF for a client-ready copy.</p>
    </div>
  )
}

function ConnectionSection({ conn, resources }) {
  const cost = resources.reduce((s, r) => s + (r.monthly_cost_usd || 0), 0)
  const waste = resources.reduce((s, r) => s + (r.waste_monthly_cost_usd || 0), 0)
  const wasted = resources.filter(r => r.waste_status && r.waste_status !== 'active').length
  const rows = resources.slice().sort((a, b) => (b.waste_monthly_cost_usd || 0) - (a.waste_monthly_cost_usd || 0) || (b.monthly_cost_usd || 0) - (a.monthly_cost_usd || 0))
  return (
    <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#FF9900] to-[#EC7211] text-xs font-bold text-[#1a1205]">{(conn.provider || '?').slice(0, 3).toUpperCase()}</span>
          <div>
            <h2 className="text-base font-bold text-white">{conn.display_name || conn.provider}</h2>
            <p className="text-xs text-slate-500">{(conn.provider || '').toUpperCase()}{conn.last_scanned_at ? ` · last scanned ${new Date(conn.last_scanned_at).toLocaleDateString()}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-right">
          <Stat label="Resources" value={resources.length} />
          <Stat label="Idle/unused" value={wasted} accent="text-amber-400" />
          <Stat label="Monthly" value={money(cost)} mono />
          <Stat label="Waste" value={money(waste)} accent="text-[#FF5247]" mono />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead><tr className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Resource</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Region</th><th className="px-3 py-2 font-medium">State</th><th className="px-3 py-2 font-medium text-right">Monthly</th><th className="px-3 py-2 font-medium text-right">Waste</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No resources for this connection.</td></tr>
            ) : rows.map((r, i) => {
              const isWaste = r.waste_status && r.waste_status !== 'active'
              return (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 text-white max-w-[220px] truncate" title={r.resource_name || r.resource_id}>{r.resource_name || r.resource_id}</td>
                  <td className="px-3 py-2 text-slate-300">{typeLabel(r.resource_type)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.region}</td>
                  <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${isWaste ? 'bg-[#FF5247]/10 text-[#FF5247]' : 'bg-emerald-500/10 text-emerald-400'}`}>{isWaste ? r.waste_status : (r.status || 'active')}</span></td>
                  <td className="px-3 py-2 font-mono text-right text-slate-200">{money(r.monthly_cost_usd)}</td>
                  <td className={`px-3 py-2 font-mono text-right font-semibold ${isWaste ? 'text-[#FF5247]' : 'text-slate-600'}`}>{isWaste ? money(r.waste_monthly_cost_usd) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ label, value, color = 'text-white', sub, subColor = 'text-slate-500' }) {
  return (
    <div className="rounded-xl bg-white/5 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`font-mono text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className={`mt-1 text-[11px] font-medium ${subColor}`}>{sub}</p>}
    </div>
  )
}

function Stat({ label, value, accent = 'text-white', mono = false }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${accent} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}
