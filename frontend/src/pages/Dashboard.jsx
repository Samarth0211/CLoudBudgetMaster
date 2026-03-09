import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LabelList
} from 'recharts'
import api from '../lib/api'

// ── Friendly name mappings ──
const FRIENDLY_NAMES = {
  "Amazon Elastic Compute Cloud - Compute": "Virtual Servers (EC2)",
  "Amazon Relational Database Service": "Databases (RDS)",
  "Amazon Simple Storage Service": "File Storage (S3)",
  "AmazonCloudWatch": "Monitoring",
  "AWS Key Management Service": "Encryption (KMS)",
  "Amazon Virtual Private Cloud": "Networking (VPC)",
  "Amazon Route 53": "DNS (Route 53)",
  "Elastic Load Balancing": "Load Balancers",
  "Amazon ElastiCache": "Caching",
  "Amazon Elastic Kubernetes Service": "Containers (EKS)",
  "AWS Lambda": "Serverless",
  "Amazon DynamoDB": "NoSQL DB",
  "Amazon Elastic Block Store": "Disk (EBS)",
  "AWS CloudTrail": "Audit Logs",
  "Amazon Simple Notification Service": "Notifications",
  "Amazon Simple Queue Service": "Queues",
  "AWS Config": "Config Tracking",
  "Tax": "Tax",
}
function friendly(name) {
  return FRIENDLY_NAMES[name] || name.replace(/^Amazon /, '').replace(/^AWS /, '')
}

const RESOURCE_LABELS = {
  ec2_instance: "Virtual Server", rds_instance: "Database", ebs_volume: "Disk",
  elastic_ip: "IP Address", s3_bucket: "Storage",
}

function wasteReason(r) {
  const m = {
    ec2_instance: { idle: "Running but barely doing any work", unused: "Stopped but still costing you" },
    rds_instance: { unused: "Nobody has connected in 7+ days" },
    ebs_volume: { unused: "Not attached to any server" },
    elastic_ip: { unused: "Not linked to any running server" },
  }
  return m[r.resource_type]?.[r.waste_status] || `Currently ${r.waste_status}`
}

const CHART_COLORS = ['#818cf8', '#a78bfa', '#f472b6', '#fb7185', '#fb923c', '#fbbf24', '#34d399', '#22d3ee']

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState([])
  const [topWaste, setTopWaste] = useState([])
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [dayBreakdown, setDayBreakdown] = useState(null)
  const [dayLoading, setDayLoading] = useState(false)

  const firstName = user?.full_name?.split(' ')[0] || 'there'

  useEffect(() => {
    (async () => {
      try {
        const [s, t, w, c] = await Promise.all([
          api.get('/dashboard/summary'), api.get('/dashboard/trend?days=30'),
          api.get('/dashboard/top-waste?limit=5'), api.get('/connections'),
        ])
        setSummary(s.data); setTrend(t.data.data_points || [])
        setTopWaste(w.data.resources || []); setConnections(c.data.connections || [])
      } catch (e) { console.error('Dashboard:', e) }
      finally { setLoading(false) }
    })()
  }, [])

  const handleChartClick = async (data) => {
    if (!data?.activePayload?.[0]) return
    const date = data.activePayload[0].payload.date
    if (selectedDate === date) { setSelectedDate(null); setDayBreakdown(null); return }
    setSelectedDate(date); setDayLoading(true)
    try { setDayBreakdown((await api.get(`/dashboard/day/${date}`)).data) }
    catch { setDayBreakdown(null) }
    finally { setDayLoading(false) }
  }

  const has = connections.length > 0
  const ok = summary && summary.total_monthly_cost_usd > 0

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-[#0B0F1A]" />
        <div className="absolute inset-0 h-14 w-14 animate-spin rounded-full border-[3px] border-transparent border-t-indigo-500 border-r-violet-500" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6 pb-8">

      {/* ═══════════ HERO BANNER ═══════════ */}
      <div className="noise relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-7 text-white shadow-2xl shadow-indigo-500/10 animate-fade-up">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-pink-500/15 blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
        <div className="pointer-events-none absolute right-1/3 top-0 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl animate-blob" style={{ animationDelay: '4s' }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200/70 mb-1">Dashboard</p>
            <h1 className="text-2xl font-bold">Welcome back, {firstName}</h1>
            <p className="mt-1 text-sm text-white/50">Your cloud spending at a glance</p>
          </div>
          {ok && (
            <div className="glass-dark rounded-2xl px-5 py-3 flex items-center gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Monthly Spend</p>
                <p className="text-2xl font-bold tracking-tight">${summary.total_monthly_cost_usd.toLocaleString()}</p>
              </div>
              {summary.cost_change_wow_percent !== 0 && (
                <div className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold ${
                  summary.cost_change_wow_percent > 0
                    ? 'bg-red-500/25 text-red-300'
                    : 'bg-emerald-500/25 text-emerald-300'
                }`}>
                  <Arrow up={summary.cost_change_wow_percent > 0} />
                  {Math.abs(summary.cost_change_wow_percent)}%
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ STAT CARDS ═══════════ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard className="animate-fade-up delay-1" accent="indigo" icon={<IconDollar />}
          label="What you're spending" tip="Total monthly bill across all cloud accounts"
          value={ok ? `$${summary.total_monthly_cost_usd.toLocaleString()}` : '--'}
          sub={ok && summary.cost_change_wow_percent !== 0
            ? `${summary.cost_change_wow_percent > 0 ? '+' : ''}${summary.cost_change_wow_percent}% vs last week`
            : has ? 'Run a scan to see costs' : 'Connect a cloud to start'}
          trend={ok ? (summary.cost_change_wow_percent > 0 ? 'up' : summary.cost_change_wow_percent < 0 ? 'down' : null) : null}
        />
        <MetricCard className="animate-fade-up delay-2" accent="rose" icon={<IconSavings />}
          label="Money you could save" tip="Resources that are idle or unused"
          value={ok ? `$${summary.total_waste_cost_usd.toLocaleString()}` : '--'}
          sub={ok ? `${summary.waste_percentage}% of your bill` : 'No data yet'}
          trend={ok && summary.waste_percentage > 15 ? 'up' : null}
          glow={ok && summary.waste_percentage > 20}
          badge={ok && summary.waste_percentage > 25 ? 'Action needed' : null}
        />
        <MetricCard className="animate-fade-up delay-3" accent="violet" icon={<IconServer />}
          label="Cloud services" tip="Servers, databases, storage we found"
          value={ok ? summary.total_resources.toString() : '--'}
          sub={ok ? `${summary.unused_resources} not being used` : 'No data yet'}
        />
        <MetricCard className="animate-fade-up delay-4" accent="emerald" icon={<IconLink />}
          label="Accounts connected" tip="Cloud accounts linked to CloudPilot"
          value={connections.length.toString()}
          sub={`${connections.filter(c => c.status === 'active').length} active`}
        />
      </div>

      {!has ? (
        /* ═══════════ EMPTY STATE ═══════════ */
        <div className="noise relative overflow-hidden rounded-2xl border border-white/10 bg-[#111827] p-14 text-center animate-scale-in">
          <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="pointer-events-none absolute left-10 bottom-0 h-48 w-48 rounded-full bg-violet-500/8 blur-3xl" />
          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-xl shadow-indigo-500/30 animate-float">
              <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
              </svg>
            </div>
            <h3 className="mt-7 text-xl font-bold text-white">Connect your first cloud account</h3>
            <p className="mt-2.5 text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
              Link your AWS, GCP, or Azure account and we'll find savings opportunities for you automatically.
            </p>
            <button onClick={() => navigate('/connections')}
              className="shimmer-hover mt-7 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/40 transition-all hover:-translate-y-1 active:translate-y-0">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Get Started
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ═══════════ CHART + WASTE RING ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Spending Chart ── */}
            <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-[#111827] p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-fade-up">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Daily Spending</h3>
                    <p className="text-[11px] text-slate-500">Click any point to drill into that day</p>
                  </div>
                </div>
                {selectedDate && (
                  <button onClick={() => { setSelectedDate(null); setDayBreakdown(null) }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/5 transition-colors">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    Clear
                  </button>
                )}
              </div>

              {trend.length > 0 ? (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={trend} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                          <stop offset="50%" stopColor="#6366f1" stopOpacity={0.1} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="50%" stopColor="#a78bfa" />
                          <stop offset="100%" stopColor="#c4b5fd" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false}
                        tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                      <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `$${v}`} width={50} />
                      <Tooltip
                        contentStyle={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: '12px', padding: '12px 16px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
                        formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Daily Cost']}
                        labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Area type="monotone" dataKey="total_cost_usd" stroke="url(#lineGrad)" strokeWidth={2.5} fill="url(#areaGrad)"
                        dot={(p) => {
                          const sel = p.payload.date === selectedDate
                          if (!sel) return <circle key={p.key} cx={p.cx} cy={p.cy} r={0} />
                          return (
                            <g key={p.key}>
                              <circle cx={p.cx} cy={p.cy} r={14} fill="#818cf8" opacity={0.1} />
                              <circle cx={p.cx} cy={p.cy} r={7} fill="#818cf8" opacity={0.2} />
                              <circle cx={p.cx} cy={p.cy} r={5} fill="#818cf8" stroke="#0B0F1A" strokeWidth={3} />
                            </g>
                          )
                        }}
                        activeDot={({ cx, cy, key }) => (
                          <g key={key}>
                            <circle cx={cx} cy={cy} r={10} fill="#818cf8" opacity={0.15} />
                            <circle cx={cx} cy={cy} r={5} fill="#818cf8" stroke="#0B0F1A" strokeWidth={2} />
                          </g>
                        )}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[280px] gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center">
                    <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                  </div>
                  <p className="text-sm text-slate-500">Run a scan to see your spending trend</p>
                </div>
              )}
            </div>

            {/* ── Right Column ── */}
            <div className="space-y-6">
              {ok && (
                <div className="rounded-2xl border border-white/5 bg-[#111827] p-6 shadow-lg animate-fade-up delay-2">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-md shadow-rose-500/20">
                      <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-white">Waste Overview</h3>
                  </div>

                  <div className="flex justify-center">
                    <div className="relative">
                      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="8" />
                        <circle cx="60" cy="60" r="50" fill="none" stroke="url(#ringGrad)" strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={`${(summary.waste_percentage / 100) * 314} 314`} className="donut-animate" />
                        <defs>
                          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#fb7185" />
                            <stop offset="100%" stopColor="#fb923c" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-white">{summary.waste_percentage}%</span>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">wasted</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-rose-500/10 border border-rose-500/10 p-3 text-center">
                      <p className="text-lg font-bold text-white">${summary.total_waste_cost_usd.toLocaleString()}</p>
                      <p className="text-[10px] font-medium text-rose-400/70 uppercase tracking-wider">Saveable</p>
                    </div>
                    <div className="rounded-xl bg-violet-500/10 border border-violet-500/10 p-3 text-center">
                      <p className="text-lg font-bold text-white">{summary.unused_resources}</p>
                      <p className="text-[10px] font-medium text-violet-400/70 uppercase tracking-wider">Unused</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/5 bg-[#111827] p-5 shadow-lg animate-fade-up delay-3">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Quick Actions</p>
                <div className="space-y-2">
                  <QuickAction icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>}
                    label="Review Resources" desc="Find and fix wasteful resources"
                    color="indigo" onClick={() => navigate('/resources')} />
                  <QuickAction icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>}
                    label="Add Connection" desc="Link another cloud account"
                    color="emerald" onClick={() => navigate('/connections')} />
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════ DAY BREAKDOWN ═══════════ */}
          {selectedDate && (
            <div className="noise relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-[#111827] p-6 shadow-xl shadow-indigo-500/5 animate-scale-in">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl" />

              <div className="relative z-10 flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    {dayBreakdown && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">Total: <strong className="text-white">${dayBreakdown.total.toFixed(2)}</strong></span>
                        {dayBreakdown.previous_day_total > 0 && (() => {
                          const diff = dayBreakdown.total - dayBreakdown.previous_day_total
                          const up = diff > 0
                          return (
                            <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${up ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                              <Arrow up={up} /> ${Math.abs(diff).toFixed(2)}
                            </span>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => { setSelectedDate(null); setDayBreakdown(null) }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              {dayLoading ? (
                <div className="flex items-center justify-center py-14">
                  <div className="relative h-10 w-10">
                    <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" />
                    <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-indigo-500" />
                  </div>
                </div>
              ) : dayBreakdown && dayBreakdown.services.length > 0 ? (
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="lg:col-span-3">
                    <ResponsiveContainer width="100%" height={Math.max(200, dayBreakdown.services.slice(0, 8).length * 44)}>
                      <BarChart data={dayBreakdown.services.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 65, top: 0, bottom: 0 }}>
                        <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="service" width={150} tick={{ fontSize: 11, fill: '#cbd5e1', fontWeight: 500 }}
                          tickLine={false} axisLine={false} tickFormatter={friendly} />
                        <Tooltip contentStyle={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
                          formatter={(v, _, p) => [`$${v.toFixed(2)} (${p.payload.percent}%)`, friendly(p.payload.service)]}
                          labelFormatter={() => ''} />
                        <Bar dataKey="cost" radius={[0, 8, 8, 0]} barSize={20}>
                          {dayBreakdown.services.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                          <LabelList dataKey="cost" position="right" formatter={(v) => `$${v.toFixed(2)}`}
                            style={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="lg:col-span-2">
                    {dayBreakdown.previous_day_total > 0 ? (
                      <div>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Changes vs Yesterday</p>
                        <div className="space-y-1.5">
                          {dayBreakdown.services
                            .filter(s => Math.abs(s.change) > 0.01)
                            .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
                            .slice(0, 6)
                            .map((svc, i) => {
                              const up = svc.change > 0
                              return (
                                <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/5 px-3 py-2 animate-slide-in" style={{ animationDelay: `${i * 0.06}s` }}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`h-2 w-2 rounded-full shrink-0 ${up ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                    <span className="text-xs font-medium text-slate-300 truncate">{friendly(svc.service)}</span>
                                  </div>
                                  <span className={`text-xs font-bold shrink-0 ml-2 ${up ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {up ? '+' : ''}{svc.change.toFixed(2)}
                                  </span>
                                </div>
                              )
                            })
                          }
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-xs text-slate-600">No previous day data</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-10 text-sm text-slate-600">
                  No breakdown data for this day
                </div>
              )}
            </div>
          )}

          {/* ═══════════ TOP WASTERS ═══════════ */}
          {topWaste.length > 0 && (
            <div className="animate-fade-up">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-orange-500/20">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Biggest Savings Opportunities</h3>
                    <p className="text-[11px] text-slate-500">Click to see how to fix</p>
                  </div>
                </div>
                <button onClick={() => navigate('/resources')}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 rounded-lg px-2.5 py-1 hover:bg-white/5 transition-colors">
                  View all <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {topWaste.map((r, i) => (
                  <div key={r.id || i} onClick={() => navigate('/resources')}
                    className="shimmer-hover group relative rounded-2xl border border-white/5 bg-[#111827] p-4 cursor-pointer hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 hover:-translate-y-1 animate-fade-up"
                    style={{ animationDelay: `${i * 0.06}s` }}>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white shadow-md ${
                      i === 0 ? 'bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-500/20' :
                      i === 1 ? 'bg-gradient-to-br from-orange-400 to-red-500 shadow-orange-500/20' :
                      'bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/10'
                    }`}>
                      {i + 1}
                    </div>

                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center rounded-lg bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-400 ring-1 ring-inset ring-red-500/20">
                        ${(r.waste_monthly_cost_usd || 0).toFixed(0)}/mo
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-bold text-white truncate pr-16">{r.resource_name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {RESOURCE_LABELS[r.resource_type] || r.resource_type} &middot; {r.region}
                    </p>

                    <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-1000"
                        style={{ width: `${Math.min(100, ((r.waste_monthly_cost_usd || 0) / (topWaste[0]?.waste_monthly_cost_usd || 1)) * 100)}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-amber-400/60 mt-2 leading-relaxed line-clamp-2">
                      {wasteReason(r)}
                    </p>

                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 translate-x-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/15">
                        <svg className="h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════ COMPONENTS ═══════════

function MetricCard({ label, value, sub, tip, icon, accent, trend, glow, badge, className = '' }) {
  const [hover, setHover] = useState(false)
  const gradients = {
    indigo: 'from-indigo-500 to-violet-600',
    rose: 'from-rose-500 to-pink-600',
    violet: 'from-violet-500 to-purple-600',
    emerald: 'from-emerald-500 to-teal-600',
  }

  return (
    <div
      className={`shimmer-hover group relative overflow-hidden rounded-2xl border border-white/5 bg-[#111827] p-5 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 ${glow ? 'animate-pulse-glow' : ''} ${className}`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    >
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${gradients[accent]} opacity-60`} />

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradients[accent]} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          {icon}
        </div>
      </div>

      <p className="mt-3 text-3xl font-black text-white tracking-tight animate-number">{value}</p>

      <div className="mt-1 flex items-center gap-1.5">
        {trend === 'up' && <Arrow up className="text-red-400" />}
        {trend === 'down' && <Arrow up={false} className="text-emerald-400" />}
        <p className={`text-xs font-medium ${trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-emerald-400' : 'text-slate-500'}`}>{sub}</p>
      </div>

      {badge && (
        <span className="absolute top-2.5 right-14 inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-bold text-red-400 ring-1 ring-inset ring-red-500/20 animate-slide-down">
          {badge}
        </span>
      )}

      {hover && tip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 rounded-2xl bg-slate-800 border border-white/10 text-slate-200 text-xs p-3 leading-relaxed shadow-2xl z-20 pointer-events-none animate-slide-down">
          {tip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  )
}

function QuickAction({ icon, label, desc, color, onClick }) {
  const styles = {
    indigo: 'bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25',
    emerald: 'bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25',
  }
  return (
    <button onClick={onClick}
      className="group w-full flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left transition-all hover:bg-white/5 hover:border-white/10">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${styles[color]}`}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        <p className="text-[10px] text-slate-500">{desc}</p>
      </div>
    </button>
  )
}

function Arrow({ up, className = '' }) {
  return up
    ? <svg className={`h-3 w-3 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
    : <svg className={`h-3 w-3 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
}

function IconDollar() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> }
function IconSavings() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg> }
function IconServer() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/></svg> }
function IconLink() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg> }
