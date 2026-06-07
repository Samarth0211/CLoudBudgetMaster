import { useState, useEffect } from 'react'
import api from '../lib/api'

const RULE_TYPES = [
  { id: 'daily_cost_above', label: 'Daily cost exceeds', unit: '$', placeholder: '100' },
  { id: 'daily_spike_percent', label: 'Cost spikes by', unit: '%', placeholder: '25' },
  { id: 'new_unused_resource', label: 'New unused resources detected', unit: '', placeholder: '' },
]

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
}

export default function Alerts() {
  const [rules, setRules] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState('events') // events | rules

  useEffect(() => {
    Promise.all([fetchRules(), fetchEvents()]).finally(() => setLoading(false))
  }, [])

  const fetchRules = async () => {
    try {
      const { data } = await api.get('/alerts/rules')
      setRules(data.rules || [])
    } catch (err) {
      console.error('Failed to fetch rules:', err)
    }
  }

  const fetchEvents = async () => {
    try {
      const { data } = await api.get('/alerts/events')
      setEvents(data.events || [])
    } catch (err) {
      console.error('Failed to fetch events:', err)
    }
  }

  const dismissEvent = async (id) => {
    try {
      await api.post(`/alerts/events/${id}/dismiss`)
      setEvents(prev => prev.map(e => e.id === id ? { ...e, dismissed: true } : e))
    } catch (err) {
      console.error('Failed to dismiss:', err)
    }
  }

  const dismissAll = async () => {
    try {
      await api.post('/alerts/events/dismiss-all')
      setEvents(prev => prev.map(e => ({ ...e, dismissed: true })))
    } catch (err) {
      console.error('Failed to dismiss all:', err)
    }
  }

  const deleteRule = async (id) => {
    if (!confirm('Delete this alert rule?')) return
    try {
      await api.delete(`/alerts/rules/${id}`)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete rule')
    }
  }

  const toggleRule = async (rule) => {
    try {
      await api.put(`/alerts/rules/${rule.id}`, { enabled: !rule.enabled })
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
    } catch (err) {
      console.error('Failed to toggle rule:', err)
    }
  }

  const undismissedCount = events.filter(e => !e.dismissed).length

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="mt-1 text-sm text-slate-400">
            {undismissedCount > 0
              ? <span><span className="text-red-400 font-medium">{undismissedCount}</span> active alerts</span>
              : 'No active alerts'}
            {' '}&middot; {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Rule
        </button>
      </div>

      {/* Tabs */}
      <div className="inline-flex gap-1 mb-6 bg-[var(--glass-2)] border border-[var(--border)] rounded-xl p-1 w-fit">
        {['events', 'rules'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-[var(--ink)] text-[var(--fg)] shadow-sm' : 'text-slate-400 hover:text-[var(--fg)]'
            }`}>
            {t === 'events' ? `Alert History${undismissedCount > 0 ? ` (${undismissedCount})` : ''}` : 'Rules'}
          </button>
        ))}
      </div>

      {/* Events Tab */}
      {tab === 'events' && (
        <div>
          {undismissedCount > 0 && (
            <button onClick={dismissAll}
              className="mb-4 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Dismiss all
            </button>
          )}

          {events.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 mb-3">
                <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-white font-medium">All clear!</p>
              <p className="text-xs text-slate-500 mt-1">No alerts have been triggered yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev, idx) => {
                const sev = SEVERITY_STYLES[ev.severity] || SEVERITY_STYLES.warning
                return (
                  <div key={ev.id}
                    className={`animate-fade-up rounded-xl border ${ev.dismissed ? 'border-white/5 opacity-50' : sev.border} bg-[#232F3E] p-4 transition-all`}
                    style={{ animationDelay: `${idx * 0.03}s` }}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${sev.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${ev.dismissed ? 'text-slate-500' : 'text-white'}`}>
                          {ev.message}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {new Date(ev.created_at).toLocaleString()}
                          {ev.current_value ? ` · Value: ${ev.rule_type?.includes('percent') ? `${ev.current_value}%` : `$${ev.current_value}`}` : ''}
                        </p>
                      </div>
                      {!ev.dismissed && (
                        <button onClick={() => dismissEvent(ev.id)}
                          className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:bg-white/5 hover:text-white transition-colors">
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Rules Tab */}
      {tab === 'rules' && (
        <div>
          {rules.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-12 text-center">
              <p className="text-sm text-white font-medium">No alert rules configured</p>
              <p className="text-xs text-slate-500 mt-1">Create a rule to get notified about cost changes.</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/30 transition-colors">
                Create First Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, idx) => (
                <div key={rule.id}
                  className="animate-fade-up rounded-xl border border-white/10 bg-[#232F3E] p-4"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleRule(rule)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${rule.enabled ? 'bg-indigo-500' : 'bg-white/10'}`}>
                        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${rule.enabled ? 'translate-x-5' : ''}`} />
                      </button>
                      <div>
                        <p className={`text-sm font-medium ${rule.enabled ? 'text-white' : 'text-slate-500'}`}>
                          {rule.label || _friendlyRule(rule)}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {rule.email_enabled ? 'Email notifications on' : 'No email'} &middot; Created {new Date(rule.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => deleteRule(rule.id)}
                      className="rounded-lg p-1.5 text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Rule Modal */}
      {showCreate && (
        <CreateRuleModal
          onClose={() => setShowCreate(false)}
          onCreated={(rule) => { setRules(prev => [rule, ...prev]); setShowCreate(false) }}
        />
      )}
    </div>
  )
}

function CreateRuleModal({ onClose, onCreated }) {
  const [ruleType, setRuleType] = useState('daily_cost_above')
  const [threshold, setThreshold] = useState('')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const typeInfo = RULE_TYPES.find(r => r.id === ruleType)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post('/alerts/rules', {
        rule_type: ruleType,
        threshold: parseFloat(threshold) || 0,
        email_enabled: emailEnabled,
      })
      onCreated(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create rule')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#232F3E] border border-white/10 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Create Alert Rule</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/5 transition-colors">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Alert Type</label>
            <div className="space-y-2">
              {RULE_TYPES.map(rt => (
                <button key={rt.id} type="button" onClick={() => setRuleType(rt.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    ruleType === rt.id
                      ? 'border-indigo-500/40 bg-indigo-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  }`}>
                  <p className="text-sm font-medium">{rt.label}</p>
                </button>
              ))}
            </div>
          </div>

          {typeInfo?.unit && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Threshold ({typeInfo.unit})
              </label>
              <div className="relative">
                {typeInfo.unit === '$' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                )}
                <input
                  type="number" required value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder={typeInfo.placeholder}
                  className={`block w-full rounded-xl border border-white/10 bg-white/5 ${typeInfo.unit === '$' ? 'pl-7' : 'pl-3.5'} pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                />
                {typeInfo.unit === '%' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
            <div>
              <p className="text-sm font-medium text-white">Email Notifications</p>
              <p className="text-xs text-slate-500">Get alerted via email</p>
            </div>
            <button type="button" onClick={() => setEmailEnabled(!emailEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${emailEnabled ? 'bg-indigo-500' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${emailEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <button type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-50 transition-all">
            {loading ? 'Creating...' : 'Create Rule'}
          </button>
        </form>
      </div>
    </div>
  )
}

function _friendlyRule(rule) {
  const type = RULE_TYPES.find(r => r.id === rule.rule_type)
  if (!type) return rule.rule_type
  if (type.unit === '$') return `${type.label} $${rule.threshold}`
  if (type.unit === '%') return `${type.label} ${rule.threshold}%`
  return type.label
}
