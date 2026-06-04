import { useState, useEffect } from 'react'
import api from '../lib/api'

const WASTE_BADGES = {
  unused: { label: 'Unused', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', dot: 'bg-red-500' },
  idle: { label: 'Idle', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  oversized: { label: 'Oversized', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-500' },
  orphaned: { label: 'Orphaned', bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', dot: 'bg-pink-500' },
  active: { label: 'Active', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
}

const TYPE_ICONS = {
  ec2_instance: { label: 'EC2 Instance', icon: ServerIcon, color: 'text-orange-400 bg-orange-500/10' },
  rds_instance: { label: 'RDS Database', icon: DatabaseIcon, color: 'text-blue-400 bg-blue-500/10' },
  ebs_volume: { label: 'EBS Volume', icon: DiskIcon, color: 'text-purple-400 bg-purple-500/10' },
  elastic_ip: { label: 'Elastic IP', icon: GlobeIcon, color: 'text-emerald-400 bg-emerald-500/10' },
}

export default function Resources() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [search, setSearch] = useState('')
  const [wasteFilter, setWasteFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [aiRecs, setAiRecs] = useState({})
  const [selectedIds, setSelectedIds] = useState(new Set())

  useEffect(() => {
    fetchResources()
  }, [page, wasteFilter, typeFilter])

  const fetchResources = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (wasteFilter) params.set('waste_status', wasteFilter)
      if (typeFilter) params.set('resource_type', typeFilter)
      if (search) params.set('search', search)
      params.set('page', page)
      params.set('page_size', 25)
      const { data } = await api.get(`/resources?${params}`)
      setResources(data.resources || [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 0)
    } catch (err) {
      console.error('Failed to fetch resources:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchResources()
  }

  const handleExpand = (r) => {
    const newId = expandedId === r.id ? null : r.id
    setExpandedId(newId)
    const isWaste = r.waste_status && r.waste_status !== 'active'
    if (newId && isWaste && !aiRecs[r.id]) {
      setAiRecs(prev => ({ ...prev, [r.id]: { loading: true, data: null, error: null } }))
      api.post(`/resources/${r.id}/recommendation`)
        .then(({ data }) => {
          setAiRecs(prev => ({ ...prev, [r.id]: { loading: false, data, error: null } }))
        })
        .catch(() => {
          setAiRecs(prev => ({ ...prev, [r.id]: { loading: false, data: null, error: true } }))
        })
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalMonthlyCost = resources.reduce((sum, r) => sum + (r.monthly_cost_usd || 0), 0)
  const totalWaste = resources.reduce((sum, r) => sum + (r.waste_monthly_cost_usd || 0), 0)

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Resources</h1>
        <p className="mt-1 text-sm text-slate-400">
          {total} resources found
          {totalMonthlyCost > 0 && <span> &middot; <span className="font-mono text-white font-medium">${totalMonthlyCost.toFixed(0)}/mo</span> total cost</span>}
          {totalWaste > 0 && <span> &middot; <span className="font-mono text-red-400 font-medium">${totalWaste.toFixed(0)}/mo</span> potential savings</span>}
        </p>
      </div>

      {/* Compare button */}
      {selectedIds.size >= 2 && (
        <div className="mb-4 animate-slide-down">
          <a href={`/compare?ids=${[...selectedIds].join(',')}`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/30 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Compare {selectedIds.size} Resources
          </a>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID..."
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            />
          </div>
        </form>

        <select
          value={wasteFilter}
          onChange={(e) => { setWasteFilter(e.target.value); setPage(1) }}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-300 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
        >
          <option value="">All Statuses</option>
          <option value="unused">Unused</option>
          <option value="idle">Idle</option>
          <option value="oversized">Oversized</option>
          <option value="active">Active</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-300 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
        >
          <option value="">All Types</option>
          <option value="ec2_instance">EC2 Instance</option>
          <option value="rds_instance">RDS Database</option>
          <option value="ebs_volume">EBS Volume</option>
          <option value="elastic_ip">Elastic IP</option>
        </select>
      </div>

      {/* Resources List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-16 text-center">
          <p className="text-sm text-slate-400">No resources found. Run a scan from the Connections page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map((r, idx) => {
            const typeInfo = TYPE_ICONS[r.resource_type] || TYPE_ICONS.ec2_instance
            const badge = WASTE_BADGES[r.waste_status] || WASTE_BADGES.active
            const TypeIcon = typeInfo.icon
            const isExpanded = expandedId === r.id
            const isWaste = r.waste_status && r.waste_status !== 'active'
            const isSelected = selectedIds.has(r.id)

            return (
              <div key={r.id}
                className={`animate-fade-up rounded-2xl border overflow-hidden transition-all duration-300 hover:border-white/20 ${
                  isWaste ? 'border-red-500/20 bg-[#111827]' : 'border-white/10 bg-[#111827]'
                } ${isSelected ? 'ring-2 ring-indigo-500/40' : ''}`}
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                {/* Gradient accent bar */}
                {isWaste && (
                  <div className="h-0.5 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />
                )}

                {/* Main Row */}
                <div className="flex items-center">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(r.id)}
                    className="ml-4 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/20 transition-colors hover:border-indigo-400"
                  >
                    {isSelected && (
                      <svg className="h-3 w-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={() => handleExpand(r)}
                    className="flex-1 px-4 py-4 flex items-center gap-4 text-left"
                  >
                    {/* Type Icon */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeInfo.color}`}>
                      <TypeIcon />
                    </div>

                    {/* Name + Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">{r.resource_name}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text} ${badge.border}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {typeInfo.label} &middot; {r.region} &middot; <span className="font-mono">{r.resource_id}</span>
                      </p>
                    </div>

                    {/* Cost columns */}
                    <div className="text-right shrink-0 w-24">
                      <p className="font-mono text-sm font-semibold text-white">${(r.monthly_cost_usd || 0).toFixed(2)}</p>
                      <p className="text-xs text-slate-500">monthly</p>
                    </div>

                    {isWaste && (
                      <div className="text-right shrink-0 w-24">
                        <p className="font-mono text-sm font-bold text-red-400">${(r.waste_monthly_cost_usd || 0).toFixed(2)}</p>
                        <p className="text-xs text-red-500/60">wasted</p>
                      </div>
                    )}

                    {/* Expand Arrow */}
                    <svg className={`h-5 w-5 text-slate-500 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Waste Reason Banner */}
                {isWaste && !isExpanded && r.waste_reason && (
                  <div className="px-5 pb-3 -mt-1">
                    <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
                      <WarningIcon className="h-4 w-4 shrink-0 text-red-400" />
                      <p className="text-sm text-red-300">{r.waste_reason}</p>
                      <span className="ml-auto text-xs text-red-500/50 shrink-0">Click to see fix steps</span>
                    </div>
                  </div>
                )}

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="border-t border-white/5 bg-white/[0.02] px-5 py-5 animate-slide-down">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left: Resource Details */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Resource Details</h4>
                        <div className="space-y-2">
                          <DetailRow label="Resource ID" value={r.resource_id} mono />
                          <DetailRow label="Type" value={typeInfo.label} />
                          <DetailRow label="Status" value={r.status} />
                          <DetailRow label="Region" value={r.region} />
                          <DetailRow label="Monthly Cost" value={`$${(r.monthly_cost_usd || 0).toFixed(2)}`} />
                          {r.metadata?.instance_type && <DetailRow label="Instance Type" value={r.metadata.instance_type} />}
                          {r.metadata?.created_by && <DetailRow label="Created By" value={r.metadata.created_by} />}
                          {r.metadata?.key_name && <DetailRow label="Key Pair" value={r.metadata.key_name} />}
                          {r.metadata?.launch_time && <DetailRow label="Launched" value={new Date(r.metadata.launch_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />}
                          {r.metadata?.platform && <DetailRow label="Platform" value={r.metadata.platform} />}
                          {r.metadata?.private_ip && <DetailRow label="Private IP" value={r.metadata.private_ip} mono />}
                          {r.metadata?.public_ip && <DetailRow label="Public IP" value={r.metadata.public_ip} mono />}
                          {r.metadata?.vpc_id && <DetailRow label="VPC" value={r.metadata.vpc_id} mono />}
                          {r.metadata?.db_class && <DetailRow label="DB Class" value={r.metadata.db_class} />}
                          {r.metadata?.engine && <DetailRow label="Engine" value={r.metadata.engine} />}
                          {r.metadata?.storage_gb && <DetailRow label="Storage" value={`${r.metadata.storage_gb} GB`} />}
                          {r.metadata?.volume_type && <DetailRow label="Volume Type" value={r.metadata.volume_type} />}
                          {r.metadata?.size_gb && <DetailRow label="Size" value={`${r.metadata.size_gb} GB`} />}
                          {r.metadata?.avg_cpu_14d != null && <DetailRow label="Avg CPU (14d)" value={`${r.metadata.avg_cpu_14d}%`} />}
                          {r.metadata?.total_connections_7d != null && <DetailRow label="Connections (7d)" value={r.metadata.total_connections_7d} />}
                        </div>

                        {/* Waste Reason Callout */}
                        {isWaste && r.waste_reason && (
                          <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                            <div className="flex items-start gap-2">
                              <WarningIcon className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-red-300">Why this is flagged</p>
                                <p className="text-sm text-red-400/80 mt-1">{r.waste_reason}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Fix Recommendation */}
                      <div>
                        {isWaste ? (
                          <FixPanel resource={r} aiRec={aiRecs[r.id]} />
                        ) : (
                          <>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Status</h4>
                            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                              <div className="flex items-center gap-3">
                                <CheckIcon className="h-6 w-6 text-emerald-400" />
                                <div>
                                  <p className="text-sm font-semibold text-emerald-300">This resource looks healthy</p>
                                  <p className="text-sm text-emerald-400/60 mt-0.5">
                                    No waste detected. Monthly cost: ${(r.monthly_cost_usd || 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * 25 + 1}-{Math.min(page * 25, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-xl border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-xl border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FixPanel({ resource: r, aiRec }) {
  const rec = aiRec?.data || r.fix_recommendation
  const isAI = aiRec?.data?.ai_generated
  const isLoading = aiRec?.loading

  return (
    <>
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        How to Fix
        {isAI && (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-400 normal-case tracking-normal">
            <SparkleIcon className="h-3 w-3" />
            AI-powered
          </span>
        )}
      </h4>

      {isLoading ? (
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-400" />
            <p className="text-sm text-slate-400">Generating personalized recommendation...</p>
          </div>
        </div>
      ) : rec ? (
        <div className={`rounded-xl border p-4 ${isAI ? 'bg-purple-500/5 border-purple-500/20' : 'bg-white/5 border-white/10'}`}>
          <p className="text-sm font-semibold text-white mb-3">{rec.summary}</p>
          <ol className="space-y-2.5">
            {rec.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5 ${isAI ? 'bg-purple-500/20 text-purple-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                  {i + 1}
                </span>
                <p className="text-sm text-slate-300 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
          {rec.aws_console_path && (
            <a
              href={rec.aws_console_path}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 px-4 py-2 text-sm font-semibold text-indigo-400 hover:bg-indigo-500/30 transition-colors"
            >
              <ExternalLinkIcon />
              Open in AWS Console
            </a>
          )}
        </div>
      ) : null}

      {/* Potential Savings */}
      <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
        <div className="flex items-center gap-3">
          <DollarIcon className="h-6 w-6 text-emerald-400" />
          <div>
            <p className="text-base font-bold text-emerald-300">
              Save ${(r.waste_monthly_cost_usd || 0).toFixed(2)}/month
            </p>
            <p className="text-sm text-emerald-400/60">
              = ${((r.waste_monthly_cost_usd || 0) * 12).toFixed(0)}/year by fixing this
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-slate-200 text-right truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

// --- Icons ---
function SearchIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
}
function ServerIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" /></svg>
}
function DatabaseIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
}
function DiskIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
}
function GlobeIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function WarningIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
}
function ExternalLinkIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
}
function DollarIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function CheckIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function SparkleIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
}
