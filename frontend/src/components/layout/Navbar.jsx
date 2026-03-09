import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../lib/api'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [showNotif, setShowNotif] = useState(false)
  const notifRef = useRef(null)

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?'

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000) // poll every minute
    return () => clearInterval(interval)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/alerts/events?dismissed=false&limit=10')
      setNotifications(data.events || [])
    } catch {
      // silently fail
    }
  }

  const dismissAll = async () => {
    try {
      await api.post('/alerts/events/dismiss-all')
      setNotifications([])
    } catch { /* ignore */ }
  }

  const unreadCount = notifications.length

  return (
    <header className="fixed top-0 left-64 right-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-[#0D1117]/80 backdrop-blur-xl px-6">
      <div />
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/10 bg-[#111827]/95 backdrop-blur-xl shadow-2xl shadow-black/40 animate-slide-down overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <p className="text-sm font-semibold text-white">Notifications</p>
                {unreadCount > 0 && (
                  <button onClick={dismissAll} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    Clear all
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-slate-500">No new notifications</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <a key={n.id} href="/alerts"
                      className="flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        n.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{_timeAgo(n.created_at)}</p>
                      </div>
                    </a>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="border-t border-white/5 px-4 py-2">
                  <a href="/alerts" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                    View all alerts
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-400">
          {initials}
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-slate-200 leading-none">{user?.full_name || 'User'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
        </div>
        <button onClick={logout}
          className="ml-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors">
          Sign out
        </button>
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
