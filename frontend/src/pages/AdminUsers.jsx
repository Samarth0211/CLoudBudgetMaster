import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

const PLAN_BADGES = {
  free: { label: 'Free', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' },
  pro: { label: 'Pro', bg: 'bg-[#FF9900]/10', text: 'text-[#FF9900]', border: 'border-[#FF9900]/20' },
  enterprise: { label: 'Enterprise', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
}

function daysLeftLabel(planExpiresAt) {
  if (!planExpiresAt) return '—'
  const ms = new Date(planExpiresAt).getTime() - Date.now()
  if (ms <= 0) return '—'
  const days = Math.ceil(ms / 86400000)
  return `${days} day${days === 1 ? '' : 's'} left`
}

function formatJoined(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminUsers() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.is_admin) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api.get('/admin/users')
      .then(({ data }) => {
        if (cancelled) return
        setUsers(data.users || [])
        setTotal(data.total || 0)
        setStats(data.stats || null)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to fetch admin users:', err)
        setError(err?.response?.data?.detail || 'Failed to load users.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.is_admin])

  if (!user?.is_admin) return <Navigate to="/dashboard" replace />

  return (
    <div className="animate-fade-up pb-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="mt-1 text-sm text-slate-400">{total} registered account{total === 1 ? '' : 's'} on CloudBudgetMaster</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total users" value={stats?.total_users ?? 0} />
        <StatCard label="Paid users" value={stats?.paid_users ?? 0} accent="text-emerald-400" />
        <StatCard label="On trial" value={stats?.on_trial ?? 0} accent="text-[#FF9900]" />
        <StatCard label="Total connections" value={stats?.total_connections ?? 0} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#FF9900]" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-16 text-center">
          <p className="text-sm text-slate-400">No users found.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#232F3E] overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Trial</th>
                <th className="px-4 py-3 font-medium text-right">Connections</th>
                <th className="px-4 py-3 font-medium text-center">Verified</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const badge = PLAN_BADGES[u.plan] || PLAN_BADGES.free
                return (
                  <tr key={u.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-white max-w-[220px]">
                      <div className="font-medium truncate">{u.full_name || '—'}</div>
                      {u.promo_code && (
                        <span className="mt-1 inline-block rounded bg-white/5 border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                          {u.promo_code}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 truncate max-w-[240px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{daysLeftLabel(u.plan_expires_at)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{u.connection_count ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      {u.email_verified ? (
                        <span className="text-emerald-400">&#10003;</span>
                      ) : (
                        <span className="text-slate-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatJoined(u.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#232F3E] p-5">
      <p className={`text-2xl font-bold font-mono ${accent || 'text-white'}`}>{(value ?? 0).toLocaleString()}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  )
}
