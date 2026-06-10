import { NavLink, useNavigate } from 'react-router-dom'
import BrandLogo from '../shared/BrandLogo'
import { useAuth } from '../../hooks/useAuth'

const ADMIN_ITEMS = [
  { path: '/admin/blog', label: 'Blog', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m-6 8h2m-2-4h2m4-3h2a2 2 0 012 2v7a2 2 0 01-2 2h-2v-9z' },
]

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/resources', label: 'Resources', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2' },
  { path: '/connections', label: 'Connections', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
  { path: '/alerts', label: 'Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { path: '/savings-report', label: 'Savings Report', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { path: '/compare', label: 'Compare', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { path: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
]

function NavSection({ title, items, onItemClick }) {
  return (
    <>
      <div className="mb-2 mt-7 first:mt-0 px-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {title}
      </div>
      {items.map(({ path, label, icon }) => (
        <NavLink key={path} to={path} onClick={onItemClick}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium mb-0.5 transition-colors ${
              isActive
                ? 'bg-white/5 text-white'
                : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-300'
            }`
          }>
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
          {label}
        </NavLink>
      ))}
    </>
  )
}

export default function Sidebar({ open = false, onClose }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const plan = user?.plan || 'free'
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
  const isPaid = plan !== 'free'
  // Days left on a promo/paid trial, if one is active.
  const trialDaysLeft = (() => {
    if (!user?.plan_expires_at) return null
    const ms = new Date(user.plan_expires_at).getTime() - Date.now()
    return ms > 0 ? Math.ceil(ms / 86400000) : 0
  })()

  return (
    <aside className={`fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-slate-800 bg-[#0B1220] transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-slate-800 px-4">
        <BrandLogo className="h-7 w-7" />
        <span className="text-sm font-semibold text-white">CloudBudgetMaster</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <NavSection title="Overview" items={NAV_ITEMS.slice(0, 2)} onItemClick={onClose} />
        <NavSection title="Manage" items={NAV_ITEMS.slice(2, 6)} onItemClick={onClose} />
        {user?.is_admin && <NavSection title="Content" items={ADMIN_ITEMS} onItemClick={onClose} />}
        <NavSection title="Account" items={NAV_ITEMS.slice(6)} onItemClick={onClose} />
      </nav>

      {/* Plan */}
      <div className="border-t border-slate-800 p-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-300">{planLabel} plan</span>
            {isPaid && (
              trialDaysLeft !== null
                ? <span className="rounded bg-[#FF9900]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#FFB84D]">Trial</span>
                : <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">Active</span>
            )}
          </div>
          {trialDaysLeft !== null && (
            <p className="mb-2 text-[10px] text-slate-400">{trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left, then Free` : 'Trial ended'}</p>
          )}
          <button onClick={() => { navigate('/pricing'); onClose?.() }}
            className="w-full rounded-lg border border-slate-700 py-1.5 text-[11px] font-medium text-slate-300 hover:border-slate-600 hover:text-white transition-colors">
            {isPaid ? (trialDaysLeft !== null ? 'Upgrade to keep Pro' : 'Manage plan') : 'View Plans'}
          </button>
        </div>
      </div>
    </aside>
  )
}
