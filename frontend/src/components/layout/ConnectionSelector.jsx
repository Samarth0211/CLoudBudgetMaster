import { useConnectionFilter } from '../../hooks/useConnectionFilter'

/** Global account scope picker — sits in the navbar, filters every data tab. */
export default function ConnectionSelector() {
  const { connections, connectionId, setConnectionId } = useConnectionFilter()
  if (connections.length < 2) return null
  return (
    <div className="relative">
      <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)}
        title="Filter by cloud account"
        className="appearance-none rounded-lg border border-slate-700 bg-slate-800/60 pl-7 pr-7 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600 focus:outline-none focus:border-[#FF9900]/50 cursor-pointer max-w-[180px]">
        <option value="">All accounts</option>
        {connections.map(c => (
          <option key={c.id} value={c.id}>{c.display_name || (c.provider || '').toUpperCase()}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}
