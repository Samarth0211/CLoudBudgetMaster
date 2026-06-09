import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

const PLAN_MAX_CONNECTIONS = { free: 1, pro: 5, enterprise: 999 }

const PROVIDERS = [
  { id: 'aws', name: 'Amazon Web Services', shortName: 'AWS', color: 'from-orange-500 to-amber-500', icon: AwsIcon },
  { id: 'gcp', name: 'Google Cloud Platform', shortName: 'GCP', color: 'from-blue-500 to-cyan-500', icon: GcpIcon },
  { id: 'azure', name: 'Microsoft Azure', shortName: 'Azure', color: 'from-sky-500 to-blue-600', icon: AzureIcon, comingSoon: true },
  { id: 'snowflake', name: 'Snowflake', shortName: 'Snowflake', color: 'from-cyan-400 to-blue-500', icon: SnowflakeIcon, comingSoon: true },
]

const CREDENTIAL_FIELDS = {
  aws: [
    { key: 'access_key_id', label: 'Access Key ID', placeholder: 'AKIA...' },
    { key: 'secret_access_key', label: 'Secret Access Key', placeholder: 'Your secret key', type: 'password' },
    { key: 'region', label: 'Default Region', placeholder: 'us-east-1', defaultValue: 'us-east-1' },
  ],
  gcp: [
    { key: 'project_id', label: 'Project ID', placeholder: 'my-project-123' },
    { key: 'service_account_json', label: 'Service Account JSON', placeholder: 'Paste entire JSON key file', multiline: true },
  ],
  azure: [
    { key: 'tenant_id', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { key: 'client_id', label: 'Client (App) ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { key: 'client_secret', label: 'Client Secret', placeholder: 'Your client secret', type: 'password' },
    { key: 'subscription_id', label: 'Subscription ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
  ],
  snowflake: [
    { key: 'account', label: 'Account Identifier', placeholder: 'xy12345.us-east-1' },
    { key: 'user', label: 'Username', placeholder: 'CLOUDPILOT_SVC' },
    { key: 'password', label: 'Password', placeholder: 'Your password', type: 'password' },
    { key: 'warehouse', label: 'Warehouse', placeholder: 'COMPUTE_WH', defaultValue: 'COMPUTE_WH' },
  ],
}

export default function Connections() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [scanningId, setScanningId] = useState(null)

  useEffect(() => { fetchConnections() }, [])

  // While any connection is scanning, poll so results appear without a manual refresh.
  useEffect(() => {
    if (!connections.some(c => c.status === 'scanning')) return
    const t = setInterval(fetchConnections, 4000)
    return () => clearInterval(t)
  }, [connections])

  // Track when each connection started scanning + tick a clock for the elapsed display.
  const [scanStart, setScanStart] = useState({})
  const [, setTick] = useState(0)
  useEffect(() => {
    setScanStart(prev => {
      const next = { ...prev }
      connections.forEach(c => {
        if (c.status === 'scanning' && !next[c.id]) next[c.id] = Date.now()
        if (c.status !== 'scanning' && next[c.id]) delete next[c.id]
      })
      return next
    })
  }, [connections])
  useEffect(() => {
    if (!connections.some(c => c.status === 'scanning')) return
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [connections])

  const fetchConnections = async () => {
    try {
      const { data } = await api.get('/connections')
      setConnections(data.connections || [])
    } catch (err) {
      console.error('Failed to fetch connections:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this connection? All associated data will be removed.')) return
    try {
      await api.delete(`/connections/${id}`)
      setConnections(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete connection')
    }
  }

  const handleScan = async (id) => {
    setScanningId(id)
    try {
      await api.post(`/connections/${id}/scan`)
      await fetchConnections()   // shows 'scanning'; the poll effect refreshes until done
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start scan')
    } finally {
      setScanningId(null)
    }
  }

  const providerInfo = (id) => PROVIDERS.find(p => p.id === id) || PROVIDERS[0]

  const plan = user?.plan || 'free'
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
  const maxConnections = PLAN_MAX_CONNECTIONS[plan] ?? 1
  const atLimit = connections.length >= maxConnections

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Cloud Connections</h1>
          <p className="mt-1 text-sm text-slate-400">Manage your cloud provider accounts {maxConnections < 999 && <span className="text-slate-500">· {connections.length}/{maxConnections} used</span>}</p>
        </div>
        {atLimit ? (
          <button onClick={() => navigate('/pricing')} title={`${planLabel} plan allows ${maxConnections} connection${maxConnections === 1 ? '' : 's'}. Upgrade for more.`}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--glass-2)] px-5 py-2.5 text-sm font-semibold text-[var(--fg-2)] hover:bg-[var(--glass-3)] transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Upgrade to add more
          </button>
        ) : (
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-[1.02]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Connection
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
        </div>
      ) : connections.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20">
            <svg className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">No connections yet</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Connect your first cloud account to start monitoring costs and detecting unused resources.
          </p>
          <button onClick={() => setShowModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Connection
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {connections.map((conn, idx) => {
            const info = providerInfo(conn.provider)
            const Icon = info.icon
            const isScanning = scanningId === conn.id || conn.status === 'scanning'
            return (
              <div key={conn.id}
                className="animate-fade-up rounded-2xl border border-white/10 bg-[#232F3E] overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-lg hover:shadow-black/20"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* Gradient accent */}
                <div className={`h-0.5 bg-gradient-to-r ${info.color}`} />

                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${info.color} text-white shadow-lg`}>
                        <Icon />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{conn.display_name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{info.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={conn.status} />
                      <button onClick={() => handleScan(conn.id)} disabled={isScanning}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50 transition-colors">
                        {isScanning ? (
                          <>
                            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Scanning...
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Scan Now
                          </>
                        )}
                      </button>
                      <button onClick={() => handleDelete(conn.id)}
                        className="rounded-xl border border-white/10 p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {isScanning ? (
                    <div className="mt-3 border-t border-white/5 pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--orange-bright)]">Scanning all regions…</span>
                        <span className="font-mono text-slate-400">{fmtElapsed(scanStart[conn.id])}</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                        <div className="scanbar h-full w-1/3 rounded-full bg-gradient-to-r from-[#FF9900] to-[#EC7211]" />
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Usually under a minute — checking EC2, EBS, RDS &amp; Elastic IPs across every region.
                      </p>
                    </div>
                  ) : conn.last_scanned_at && (
                    <p className="mt-3 text-xs text-slate-600 border-t border-white/5 pt-3">
                      Last scanned: {new Date(conn.last_scanned_at).toLocaleString()}
                    </p>
                  )}
                  {conn.error_message && (
                    <p className="mt-3 text-xs text-red-400 border-t border-white/5 pt-3">
                      Error: {conn.error_message}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <AddConnectionModal
          onClose={() => setShowModal(false)}
          onAdded={(conn) => {
            setConnections(prev => [conn, ...prev])
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}

function AddConnectionModal({ onClose, onAdded }) {  // rendered via portal to escape page transform-containing-block
  const [step, setStep] = useState(1)
  const [provider, setProvider] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [credentials, setCredentials] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectProvider = (p) => {
    setProvider(p)
    setDisplayName('')
    setCredentials(
      Object.fromEntries(
        CREDENTIAL_FIELDS[p.id].map(f => [f.key, f.defaultValue || ''])
      )
    )
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    let creds = { ...credentials }
    if (provider.id === 'gcp' && typeof creds.service_account_json === 'string') {
      try {
        creds.service_account_json = JSON.parse(creds.service_account_json)
      } catch {
        setError('Invalid JSON for service account key')
        setLoading(false)
        return
      }
    }

    try {
      const { data } = await api.post('/connections', {
        provider: provider.id,
        display_name: displayName,
        credentials: creds,
      })
      onAdded(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add connection')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-auto rounded-2xl bg-[#232F3E] border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh] animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="rounded-lg p-1 hover:bg-white/5 transition-colors">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-semibold text-white">
              {step === 1 ? 'Choose Cloud Provider' : `Connect ${provider?.shortName}`}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/5 transition-colors">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <div className="grid grid-cols-2 gap-3">
              {PROVIDERS.map(p => {
                const Icon = p.icon
                return (
                  <button key={p.id} onClick={() => !p.comingSoon && selectProvider(p)} disabled={p.comingSoon}
                    className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 border-white/10 p-5 text-center transition-all duration-300 group ${p.comingSoon ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-500/40 hover:bg-indigo-500/5'}`}>
                    {p.comingSoon && (
                      <span className="absolute top-2 right-2 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">Soon</span>
                    )}
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${p.color} text-white shadow-lg ${!p.comingSoon ? 'group-hover:scale-110' : ''} transition-transform`}>
                      <Icon />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{p.shortName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.name}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                  <svg className="h-5 w-5 shrink-0 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Display Name</label>
                <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder={`e.g. Production ${provider?.shortName}`}
                  className="block w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors" />
              </div>

              {CREDENTIAL_FIELDS[provider?.id]?.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{field.label}</label>
                  {field.multiline ? (
                    <textarea required value={credentials[field.key] || ''} rows={4}
                      onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="block w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-xs transition-colors" />
                  ) : (
                    <input type={field.type || 'text'} required value={credentials[field.key] || ''}
                      onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="block w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors" />
                  )}
                </div>
              ))}

              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs text-amber-300/80">Credentials are encrypted with AES-256 before storage. We use read-only access.</p>
              </div>

              <button type="submit" disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300">
                {loading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? 'Connecting...' : `Connect ${provider?.shortName}`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function fmtElapsed(startMs) {
  if (!startMs) return '0:00'
  const s = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function StatusBadge({ status }) {
  const styles = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    scanning: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.active}`}>
      {status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {status === 'scanning' && (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {status === 'error' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// --- Provider Icons ---
function AwsIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 01-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 01-.287-.374 6.18 6.18 0 01-.248-.467c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.032-.863.104-.296.072-.583.16-.863.272a2.287 2.287 0 01-.28.104.488.488 0 01-.127.024c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 01.224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 011.246-.152c.95 0 1.644.216 2.091.647.439.432.662 1.086.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 00-.735-.136 6.02 6.02 0 00-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 01-.072-.32c0-.128.064-.2.191-.2h.783c.152 0 .256.025.304.08.064.048.112.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.152-.312a.549.549 0 01.32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 01.303-.08h.743c.128 0 .2.064.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 01-.056.2l-1.923 6.17c-.048.16-.104.264-.168.312a.549.549 0 01-.32.08h-.687c-.152 0-.256-.024-.32-.08-.063-.056-.12-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.216-.151-.248-.223a.504.504 0 01-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.32.064.63.096.95.096.503 0 .894-.088 1.165-.264a.86.86 0 00.415-.758.777.777 0 00-.215-.559c-.144-.151-.415-.287-.806-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 01-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.176 0 .36.008.543.032.191.024.367.056.543.096.168.048.328.096.48.144.152.048.272.096.36.144a.75.75 0 01.24.168.37.37 0 01.072.224v.375c0 .168-.064.256-.184.256a.832.832 0 01-.303-.096 3.652 3.652 0 00-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.694 0 .224.08.416.24.567.159.152.454.303.878.44l1.134.358c.574.184.99.44 1.237.767.248.328.367.703.367 1.118 0 .344-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z" />
    </svg>
  )
}

function GcpIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3L4 7.5v9L12 21l8-4.5v-9L12 3zm0 2.25l5.5 3.094v6.312L12 17.75l-5.5-3.094V8.344L12 5.25z" />
    </svg>
  )
}

function AzureIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.05 4.24l-4.6 8.72 5.45 6.62H21L13.05 4.24zM3 17.58l2.55-6.14L3 7.76V17.58zm3.74.58h7.7l-4.35-5.27L6.74 18.16z" />
    </svg>
  )
}

function SnowflakeIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}
