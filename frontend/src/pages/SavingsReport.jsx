import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../lib/api'
import { generateCostReport } from '../lib/pdfReport'

const TYPE_LABEL = {
  ec2_instance: 'EC2 Instance', rds_instance: 'RDS Database', ebs_volume: 'EBS Volume',
  elastic_ip: 'Elastic IP', s3_bucket: 'S3 Bucket', compute_instance: 'Compute VM', persistent_disk: 'Persistent Disk',
}
const typeLabel = (t) => TYPE_LABEL[t] || (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

export default function SavingsReport() {
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState([])
  const [connections, setConnections] = useState([])
  const [resources, setResources] = useState([])
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary').then(r => setSummary(r.data)),
      api.get('/dashboard/trend?days=30').then(r => setTrend(r.data.data_points || [])),
      api.get('/connections').then(r => {
        const cs = r.data.connections || []
        setConnections(cs)
        setAccount(cs.length === 1 ? cs[0].display_name : cs.length ? `${cs.length} cloud accounts` : 'All accounts')
      }).catch(() => {}),
      fetchAllResources().then(setResources).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await generateCostReport({ summary, trend, connections, resources, account })
    } catch {
      alert('Could not generate the report. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#FF9900]" />
      </div>
    )
  }

  const monthlyCost = summary?.total_monthly_cost_usd || 0
  const wasteCost = summary?.total_waste_cost_usd || 0
  const savingsPercent = monthlyCost > 0 ? ((wasteCost / monthlyCost) * 100).toFixed(1) : 0
  const annualSavings = wasteCost * 12
  const unused = resources.filter(r => r.waste_status && r.waste_status !== 'active').length

  return (
    <div className="animate-fade-up pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Savings Report</h1>
          <p className="mt-1 text-sm text-slate-400">
            {account} · {resources.length} resources · {unused} idle/unused · last 30 days
          </p>
        </div>
        <button onClick={handleDownload} disabled={downloading}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-60 transition-all">
          {downloading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          {downloading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {/* Executive Summary */}
      <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
        <h2 className="text-lg font-bold text-white mb-4">Executive Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Monthly Spend" value={money(monthlyCost)} color="text-white" />
          <SummaryCard label="Monthly Waste" value={money(wasteCost)} color="text-[#FF5247]" />
          <SummaryCard label="Recoverable" value={`${savingsPercent}%`} color="text-amber-400" />
          <SummaryCard label="Annual Savings" value={`$${Math.round(annualSavings).toLocaleString()}`} color="text-emerald-400" />
        </div>
      </div>

      {/* Cost Trend */}
      {trend.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">30-Day Cost Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="rptGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF9900" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#FF9900" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#33415533" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false}
                tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} minTickGap={28} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={48} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 12 }}
                formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Cost']} />
              <Area type="monotone" dataKey="total_cost_usd" stroke="#FF9900" strokeWidth={1.6} fill="url(#rptGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-connection sections */}
      {connections.map(conn => (
        <ConnectionSection key={conn.id} conn={conn}
          resources={resources.filter(r => r.connection_id === conn.id)} />
      ))}

      {/* Recommendations */}
      <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6">
        <h2 className="text-lg font-bold text-white mb-4">Recommendations</h2>
        <ul className="space-y-2 text-sm text-slate-300">
          {wasteCost > 0 && (
            <li className="flex items-start gap-2"><span className="text-[#FF5247] mt-0.5">1.</span>
              <span>Terminate or right-size the {unused} idle/unused resources to save <strong className="text-white">{money(wasteCost)}/month</strong>.</span></li>
          )}
          <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">2.</span><span>Configure cost-spike alerts to catch unexpected increases early.</span></li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">3.</span><span>Re-scan weekly and after any infrastructure change to keep this report current.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#3FA9F5] mt-0.5">4.</span><span>Use Reserved Instances or Savings Plans for steady-state workloads.</span></li>
        </ul>
      </div>

      <p className="mt-6 text-center text-xs text-slate-600">
        Generated by CloudBudgetMaster · {new Date().toLocaleDateString()} · Download the PDF for a client-ready copy.
      </p>
    </div>
  )
}

function ConnectionSection({ conn, resources }) {
  const cost = resources.reduce((s, r) => s + (r.monthly_cost_usd || 0), 0)
  const waste = resources.reduce((s, r) => s + (r.waste_monthly_cost_usd || 0), 0)
  const wasted = resources.filter(r => r.waste_status && r.waste_status !== 'active').length
  const rows = resources.slice().sort((a, b) =>
    (b.waste_monthly_cost_usd || 0) - (a.waste_monthly_cost_usd || 0) || (b.monthly_cost_usd || 0) - (a.monthly_cost_usd || 0))

  const wasteByType = {}
  resources.forEach(r => {
    if (r.waste_monthly_cost_usd > 0) {
      const k = typeLabel(r.resource_type)
      wasteByType[k] = (wasteByType[k] || 0) + r.waste_monthly_cost_usd
    }
  })
  const bars = Object.entries(wasteByType).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  const maxBar = Math.max(...bars.map(b => b.value), 1)

  return (
    <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#FF9900] to-[#EC7211] text-xs font-bold text-[#1a1205]">
            {(conn.provider || '?').slice(0, 3).toUpperCase()}
          </span>
          <div>
            <h2 className="text-base font-bold text-white">{conn.display_name || conn.provider}</h2>
            <p className="text-xs text-slate-500">
              {(conn.provider || '').toUpperCase()}{conn.last_scanned_at ? ` · last scanned ${new Date(conn.last_scanned_at).toLocaleDateString()}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-right">
          <Stat label="Resources" value={resources.length} />
          <Stat label="Idle/unused" value={wasted} accent="text-amber-400" />
          <Stat label="Monthly" value={money(cost)} mono />
          <Stat label="Waste" value={money(waste)} accent="text-[#FF5247]" mono />
        </div>
      </div>

      {bars.length > 0 && (
        <div className="mb-5 space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-slate-400 mb-1">Waste by resource type</p>
          {bars.map(b => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-xs text-slate-300 truncate">{b.label}</span>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#FF7A6E] to-[#FF5247]" style={{ width: `${(b.value / maxBar) * 100}%` }} />
              </div>
              <span className="font-mono w-20 shrink-0 text-right text-xs font-semibold text-[#FF5247]">{money(b.value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Resource</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Region</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium text-right">Monthly</th>
              <th className="px-3 py-2 font-medium text-right">Waste</th>
            </tr>
          </thead>
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
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${isWaste ? 'bg-[#FF5247]/10 text-[#FF5247]' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {isWaste ? r.waste_status : (r.status || 'active')}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-slate-200">{money(r.monthly_cost_usd)}</td>
                  <td className={`px-3 py-2 font-mono text-right font-semibold ${isWaste ? 'text-[#FF5247]' : 'text-slate-600'}`}>
                    {isWaste ? money(r.waste_monthly_cost_usd) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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

function SummaryCard({ label, value, color }) {
  return (
    <div className="rounded-xl bg-white/5 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`font-mono text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
