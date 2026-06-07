import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import ThemeToggle from '../shared/ThemeToggle'
import api from '../../lib/api'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/resources': 'Resources',
  '/connections': 'Connections',
  '/alerts': 'Alerts',
  '/savings-report': 'Savings Report',
  '/compare': 'Compare',
  '/pricing': 'Plans & Pricing',
  '/settings': 'Settings',
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [notifications, setNotifications] = useState([])
  const [showNotif, setShowNotif] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const notifRef = useRef(null)
  const userRef = useRef(null)

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?'

  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard'

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
      if (userRef.current && !userRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/alerts/events?dismissed=false&limit=10')
      setNotifications(data.events || [])
    } catch { /* silently fail */ }
  }

  const dismissAll = async () => {
    try {
      await api.post('/alerts/events/dismiss-all')
      setNotifications([])
    } catch { /* ignore */ }
  }

  const unreadCount = notifications.length

  return (
    <header className="fixed top-0 left-60 right-0 z-30 flex h-14 items-center justify-between border-b border-slate-800 bg-[#0B1220] px-6">
      <h2 className="text-sm font-medium text-slate-200">{pageTitle}</h2>

      <div className="flex items-center gap-1.5">
        <ThemeToggle className="h-8 w-8 border-0 hover:bg-slate-800" />
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setShowNotif(!showNotif)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0B1220]" />
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-1 w-72 rounded-lg border border-slate-800 bg-slate-900 shadow-lg animate-slide-down overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
                <span className="text-xs font-medium text-slate-300">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={dismissAll} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">Clear all</button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-slate-500">No notifications</div>
                ) : (
                  notifications.map(n => (
                    <a key={n.id} href="/alerts" className="flex items-start gap-2.5 px-3 py-2.5 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/50 transition-colors">
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${n.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <div>
                        <p className="text-xs text-slate-300 line-clamp-2">{n.message}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{_timeAgo(n.created_at)}</p>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="relative" ref={userRef}>
          <button onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800 transition-colors">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-[10px] font-semibold text-white">
              {initials}
            </div>
            <span className="hidden sm:block text-xs text-slate-300">{user?.full_name || 'User'}</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-800 bg-slate-900 shadow-lg animate-slide-down overflow-hidden">
              <div className="px-3 py-2.5 border-b border-slate-800">
                <p className="text-xs font-medium text-slate-200 truncate">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
              <div className="py-1">
                <a href="/settings" className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Settings</a>
                <button onClick={logout} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-slate-800 transition-colors">Sign out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function _timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const secs = Math.floor((now - date) / 1000)
  if (secs < 60) return 'Just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}
