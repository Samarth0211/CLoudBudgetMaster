import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'

export default function Compare() {
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
  }, [])

  useEffect(() => {
    if (selectedIds.size > 0 && allResources.length > 0) {
      setResources(allResources.filter(r => selectedIds.has(r.id)))
    }
  }, [selectedIds, allResources])

  const fetchAll = async () => {
    try {
      const { data } = await api.get('/resources?page_size=100')
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
        <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-12 text-center">
          <p className="text-sm text-slate-400">Select at least 2 resources to compare</p>
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
