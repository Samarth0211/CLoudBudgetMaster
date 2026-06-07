import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, LabelList
} from 'recharts'
import api from '../lib/api'

const FRIENDLY_NAMES = {
  "Amazon Elastic Compute Cloud - Compute": "EC2",
  "Amazon Relational Database Service": "RDS",
  "Amazon Simple Storage Service": "S3",
  "AmazonCloudWatch": "CloudWatch",
  "AWS Key Management Service": "KMS",
  "Amazon Virtual Private Cloud": "VPC",
  "Amazon Route 53": "Route 53",
  "Elastic Load Balancing": "ELB",
  "Amazon ElastiCache": "ElastiCache",
  "Amazon Elastic Kubernetes Service": "EKS",
  "AWS Lambda": "Lambda",
  "Amazon DynamoDB": "DynamoDB",
  "Amazon Elastic Block Store": "EBS",
  "AWS CloudTrail": "CloudTrail",
  "Amazon Simple Notification Service": "SNS",
  "Amazon Simple Queue Service": "SQS",
  "AWS Config": "Config",
  "Tax": "Tax",
}
function friendly(name) {
  return FRIENDLY_NAMES[name] || name.replace(/^Amazon /, '').replace(/^AWS /, '')
}

const RESOURCE_LABELS = {
  ec2_instance: "EC2 Instance", rds_instance: "RDS Database", ebs_volume: "EBS Volume",
  elastic_ip: "Elastic IP", s3_bucket: "S3 Bucket",
}

function wasteReason(r) {
  const m = {
    ec2_instance: { idle: "Running but low utilization", unused: "Stopped — still incurring charges" },
    rds_instance: { unused: "No connections in 7+ days" },
    ebs_volume: { unused: "Not attached to any instance" },
    elastic_ip: { unused: "Not associated with a running instance" },
  }
  return m[r.resource_type]?.[r.waste_status] || `Status: ${r.waste_status}`
}

const CHART_COLORS = ['#FF9900', '#64748b', '#ef4444', '#f59e0b', '#10b981', '#EC7211', '#06b6d4', '#ec4899']

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [paymentMsg, setPaymentMsg] = useState(null)

  // Handle PayPal return
  useEffect(() => {
    const payment = searchParams.get('payment')
    const token = searchParams.get('token')
    if (payment === 'success' && token) {
      setPaymentMsg('Processing payment...')
      api.post('/payments/capture-order', { order_id: token })
        .then(() => {
          setPaymentMsg('Upgraded to Pro! Refreshing...')
          const userData = JSON.parse(localStorage.getItem('user') || '{}')
          userData.plan = 'pro'
          localStorage.setItem('user', JSON.stringify(userData))
          setTimeout(() => window.location.href = '/dashboard', 1500)
        })
        .catch(() => setPaymentMsg('Payment capture failed. Contact support.'))
      setSearchParams({})
    } else if (payment === 'cancelled') {
      setPaymentMsg('Payment cancelled.')
      setSearchParams({})
      setTimeout(() => setPaymentMsg(null), 3000)
    }
  }, [])

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
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
    </div>
  )

  return (
    <div className="space-y-6 pb-8">

      {/* ── Payment banner ── */}
      {paymentMsg && (
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-300">
          {paymentMsg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Welcome back, {firstName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Here's your cloud overview.</p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly spend"
          value={ok ? `$${summary.total_monthly_cost_usd.toLocaleString()}` : '--'}
          change={ok && summary.cost_change_wow_percent !== 0 ? summary.cost_change_wow_percent : null}
          sub={!ok ? (has ? 'Run a scan to see costs' : 'Connect a cloud to start') : null}
        />
        <StatCard
          label="Potential savings"
          value={ok ? `$${summary.total_waste_cost_usd.toLocaleString()}` : '--'}
          sub={ok ? `${summary.waste_percentage}% of total spend` : 'No data yet'}
          warn={ok && summary.waste_percentage > 20}
        />
        <StatCard
          label="Resources"
          value={ok ? summary.total_resources.toString() : '--'}
          sub={ok ? `${summary.unused_resources} unused` : 'No data yet'}
        />
        <StatCard
          label="Connections"
          value={connections.length.toString()}
          sub={`${connections.filter(c => c.status === 'active').length} active`}
        />
      </div>

      {!has ? (
        /* ── Empty state ── */
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-white">Connect your first cloud account</h3>
          <p className="mt-1.5 text-sm text-slate-500 max-w-sm mx-auto">
            Link your AWS, GCP, or Azure account to start finding savings.
          </p>
          <button onClick={() => navigate('/connections')}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Get Started
          </button>
        </div>
      ) : (
        <>
          {/* ── Chart + Waste ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

            {/* Spending chart */}
            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#232F3E] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-200">Daily spending</h3>
                {selectedDate && (
                  <button onClick={() => { setSelectedDate(null); setDayBreakdown(null) }}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear selection</button>
                )}
              </div>

              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trend} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF9900" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#FF9900" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-track)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false}
                      tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `$${v}`} width={48} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #1e293b', background: '#0f172a', color: '#e2e8f0', fontSize: '12px', padding: '8px 12px' }}
                      formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Cost']}
                      labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      cursor={{ stroke: '#334155', strokeWidth: 1 }}
                    />
                    <Area type="monotone" dataKey="total_cost_usd" stroke="#FF9900" strokeWidth={1.5} fill="url(#areaGrad)"
                      dot={(p) => {
                        if (p.payload.date !== selectedDate) return <circle key={p.key} cx={p.cx} cy={p.cy} r={0} />
                        return <circle key={p.key} cx={p.cx} cy={p.cy} r={4} fill="#FF9900" stroke="#0f172a" strokeWidth={2} />
                      }}
                      activeDot={({ cx, cy, key }) => <circle key={key} cx={cx} cy={cy} r={4} fill="#FF9900" stroke="#0f172a" strokeWidth={2} />}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-sm text-slate-600">
                  Run a scan to see spending data
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-3">
              {ok && (
                <div className="rounded-xl border border-slate-800 bg-[#232F3E] p-5">
                  <h3 className="text-sm font-medium text-slate-200 mb-4">Waste overview</h3>

                  <div className="flex justify-center">
                    <div className="relative">
                      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--chart-track)" strokeWidth="6" />
                        <circle cx="60" cy="60" r="50" fill="none"
                          stroke={summary.waste_percentage > 25 ? '#ef4444' : summary.waste_percentage > 10 ? '#f59e0b' : '#10b981'}
                          strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={`${(summary.waste_percentage / 100) * 314} 314`} className="donut-animate" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-mono text-2xl font-semibold text-white">{summary.waste_percentage}%</span>
                        <span className="text-[11px] text-slate-500">wasted</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-800/50 p-2.5 text-center">
                      <p className="font-mono text-sm font-semibold text-white">${summary.total_waste_cost_usd.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-500">saveable</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 p-2.5 text-center">
                      <p className="font-mono text-sm font-semibold text-white">{summary.unused_resources}</p>
                      <p className="text-[11px] text-slate-500">unused</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-800 bg-[#232F3E] p-4">
                <p className="text-xs font-medium text-slate-500 mb-2.5">Quick actions</p>
                <div className="space-y-1.5">
                  <button onClick={() => navigate('/resources')}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 transition-colors">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    Review resources
                  </button>
                  <button onClick={() => navigate('/connections')}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 transition-colors">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Add connection
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Day breakdown ── */}
          {selectedDate && (
            <div className="rounded-xl border border-slate-800 bg-[#232F3E] p-5 animate-scale-in">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-medium text-slate-200">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                  {dayBreakdown && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">Total: <span className="font-mono text-white font-medium">${dayBreakdown.total.toFixed(2)}</span></span>
                      {dayBreakdown.previous_day_total > 0 && (() => {
                        const diff = dayBreakdown.total - dayBreakdown.previous_day_total
                        const up = diff > 0
                        return (
                          <span className={`text-[11px] font-medium ${up ? 'text-red-400' : 'text-emerald-400'}`}>
                            {up ? '+' : ''}{diff.toFixed(2)} vs prev day
                          </span>
                        )
                      })()}
                    </div>
                  )}
                </div>
                <button onClick={() => { setSelectedDate(null); setDayBreakdown(null) }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Close</button>
              </div>

              {dayLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
                </div>
              ) : dayBreakdown && dayBreakdown.services.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                  <div className="lg:col-span-3">
                    <ResponsiveContainer width="100%" height={Math.max(180, dayBreakdown.services.slice(0, 8).length * 40)}>
                      <BarChart data={dayBreakdown.services.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 55, top: 0, bottom: 0 }}>
                        <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="service" width={130} tick={{ fontSize: 11, fill: '#94a3b8' }}
                          tickLine={false} axisLine={false} tickFormatter={friendly} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #1e293b', background: '#0f172a', color: '#e2e8f0', fontSize: '12px' }}
                          formatter={(v, _, p) => [`$${v.toFixed(2)} (${p.payload.percent}%)`, friendly(p.payload.service)]}
                          labelFormatter={() => ''} />
                        <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={18}>
                          {dayBreakdown.services.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                          <LabelList dataKey="cost" position="right" formatter={(v) => `$${v.toFixed(2)}`}
                            style={{ fontSize: 11, fill: '#64748b' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="lg:col-span-2">
                    {dayBreakdown.previous_day_total > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2.5">Changes vs yesterday</p>
                        <div className="space-y-1">
                          {dayBreakdown.services
                            .filter(s => Math.abs(s.change) > 0.01)
                            .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
                            .slice(0, 6)
                            .map((svc, i) => {
                              const up = svc.change > 0
                              return (
                                <div key={i} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-2.5 py-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${up ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                    <span className="text-xs text-slate-300 truncate">{friendly(svc.service)}</span>
                                  </div>
                                  <span className={`text-xs font-medium shrink-0 ml-2 ${up ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {up ? '+' : ''}{svc.change.toFixed(2)}
                                  </span>
                                </div>
                              )
                            })
                          }
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-slate-600">No previous day data</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-600">No breakdown data for this day</div>
              )}
            </div>
          )}

          {/* ── Top wasters ── */}
          {topWaste.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-200">Biggest savings opportunities</h3>
                <button onClick={() => navigate('/resources')}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">View all</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {topWaste.map((r, i) => (
                  <div key={r.id || i} onClick={() => navigate('/resources')}
                    className="group rounded-xl border border-slate-800 bg-[#232F3E] p-4 cursor-pointer hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold text-slate-400 bg-slate-800">
                        {i + 1}
                      </span>
                      <span className="font-mono text-xs font-medium text-red-400">${(r.waste_monthly_cost_usd || 0).toFixed(0)}/mo</span>
                    </div>

                    <p className="text-sm font-medium text-white truncate">{r.resource_name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {RESOURCE_LABELS[r.resource_type] || r.resource_type} &middot; {r.region}
                    </p>

                    <div className="mt-3 h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-red-500/70 transition-all duration-500"
                        style={{ width: `${Math.min(100, ((r.waste_monthly_cost_usd || 0) / (topWaste[0]?.waste_monthly_cost_usd || 1)) * 100)}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">{wasteReason(r)}</p>
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

/* ── Stat card ── */
function StatCard({ label, value, change, sub, warn }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#232F3E] p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="font-mono text-2xl font-semibold tracking-tight text-white">{value}</p>
      <div className="mt-1">
        {change != null ? (
          <span className={`text-xs font-medium ${change > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {change > 0 ? '+' : ''}{change}% vs last week
          </span>
        ) : sub ? (
          <span className={`text-xs ${warn ? 'text-amber-400' : 'text-slate-500'}`}>{sub}</span>
        ) : null}
      </div>
    </div>
  )
}

function Arrow({ up, className = '' }) {
  return up
    ? <svg className={`h-3 w-3 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
    : <svg className={`h-3 w-3 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
}
