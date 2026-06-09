import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { useConnectionFilter } from '../hooks/useConnectionFilter'

export default function Compare() {
  const { connectionId } = useConnectionFilter()
  const [searchParams] = useSearchParams()
  const [resources, setResources] = useState([])
  const [allResources, setAllResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState(new Set())

  useEffect(() => {
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) || []
    if (ids.length > 0) {
      setSelectedIds(new Set(ids))
    }
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId])

  useEffect(() => {
    if (selectedIds.size > 0 && allResources.length > 0) {
      setResources(allResources.filter(r => selectedIds.has(r.id)))
    }
  }, [selectedIds, allResources])

  const fetchAll = async () => {
    try {
      const { data } = await api.get(`/resources?page_size=100${connectionId ? `&connection_id=${connectionId}` : ''}`)
      setAllResources(data.resources || [])
    } catch (err) {
      console.error('Failed to fetch resources:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleResource = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 4) next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Compare Resources</h1>
        <p className="mt-1 text-sm text-slate-400">Select 2-4 resources to compare side by side</p>
      </div>

      {/* Resource Selector */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {allResources.slice(0, 20).map(r => {
            const isSelected = selectedIds.has(r.id)
            return (
              <button key={r.id} onClick={() => toggleResource(r.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-400'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                }`}>
                {r.resource_name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Comparison Table */}
      {resources.length < 2 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--glass-1)] p-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#FF9900]/10 text-[#FF9900]">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-[var(--fg)]">Compare resources side by side</h3>
          <p className="mt-1.5 text-sm text-slate-500 max-w-sm mx-auto">Pick <strong className="text-[var(--fg-2)]">2–4 resources</strong> from the list above to line up their cost, region, status, and waste for an easy comparison.</p>
          <p className="mt-3 text-xs font-medium text-slate-500">{selectedIds.size} selected</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#232F3E] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 w-40">Property</th>
                  {resources.map(r => (
                    <th key={r.id} className="text-left text-xs font-semibold text-white px-4 py-3 min-w-[200px]">
                      <p className="truncate">{r.resource_name}</p>
                      <p className="text-[10px] text-slate-500 font-normal mt-0.5">{r.resource_type}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(row => (
                  <tr key={row.key} className="border-b border-white/5 last:border-0">
                    <td className="text-xs text-slate-500 px-4 py-2.5">{row.label}</td>
                    {resources.map(r => {
                      const val = row.getValue(r)
                      const isDiff = resources.some(other => other.id !== r.id && row.getValue(other) !== val)
                      return (
                        <td key={r.id} className={`px-4 py-2.5 text-xs ${isDiff ? 'text-amber-400' : 'text-slate-300'}`}>
                          {val || '-'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const COMPARE_ROWS = [
  { key: 'type', label: 'Type', getValue: r => r.resource_type },
  { key: 'status', label: 'Status', getValue: r => r.status },
  { key: 'waste', label: 'Waste Status', getValue: r => r.waste_status || 'active' },
  { key: 'region', label: 'Region', getValue: r => r.region },
  { key: 'cost', label: 'Monthly Cost', getValue: r => `$${(r.monthly_cost_usd || 0).toFixed(2)}` },
  { key: 'waste_cost', label: 'Wasted Cost', getValue: r => `$${(r.waste_monthly_cost_usd || 0).toFixed(2)}` },
  { key: 'instance_type', label: 'Instance Type', getValue: r => r.metadata?.instance_type || '-' },
  { key: 'engine', label: 'Engine', getValue: r => r.metadata?.engine || '-' },
  { key: 'storage', label: 'Storage (GB)', getValue: r => r.metadata?.storage_gb || r.metadata?.size_gb || '-' },
  { key: 'cpu', label: 'Avg CPU (14d)', getValue: r => r.metadata?.avg_cpu_14d != null ? `${r.metadata.avg_cpu_14d}%` : '-' },
  { key: 'connections', label: 'Connections (7d)', getValue: r => r.metadata?.total_connections_7d ?? '-' },
  { key: 'provider', label: 'Provider', getValue: r => r.provider },
  { key: 'reason', label: 'Waste Reason', getValue: r => r.waste_reason || 'No waste detected' },
]
