import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

export default function Settings() {
  const { user, logout } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSaveProfile = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await api.put('/auth/profile', { full_name: fullName })
      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      userData.full_name = fullName
      localStorage.setItem('user', JSON.stringify(userData))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) { setPwError('Must contain letters and numbers'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }

    setPwLoading(true)
    try {
      await api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword })
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (err) {
      setPwError(err.response?.data?.detail || 'Failed to change password')
    } finally {
      setPwLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete('/auth/account')
      logout()
    } catch {
      alert('Failed to delete account')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 mb-4">
        <h2 className="text-sm font-medium text-white mb-4">Profile</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">
              {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user?.full_name || 'User'}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
              <span className="inline-block mt-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 capitalize">{user?.plan || 'free'} plan</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Full name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input type="email" value={user?.email || ''} disabled
              className="block w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed" />
            <p className="text-[11px] text-slate-600 mt-1">Email cannot be changed.</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSaveProfile} disabled={saving || fullName === user?.full_name}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            {saved && <span className="text-xs text-emerald-400">Saved</span>}
          </div>
        </div>
      </section>

      {/* Change Password */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 mb-4">
        <h2 className="text-sm font-medium text-white mb-4">Change password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          {pwError && <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-300">{pwError}</div>}
          {pwSuccess && <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-300">Password updated successfully.</div>}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Current password</label>
            <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">New password</label>
            <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 chars, letters + numbers"
              className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Confirm new password</label>
            <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-colors" />
          </div>
          <button type="submit" disabled={pwLoading}
            className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40 transition-colors">
            {pwLoading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </section>

      {/* Plan */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 mb-4">
        <h2 className="text-sm font-medium text-white mb-2">Subscription</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-300 capitalize">{user?.plan || 'free'} plan</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {user?.plan === 'pro' ? '5 connections, 50 alerts, hourly scans' :
               user?.plan === 'enterprise' ? 'Unlimited connections & alerts' :
               '1 connection, 3 alerts, daily scans'}
            </p>
          </div>
          <a href="/pricing" className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors">
            {user?.plan === 'free' ? 'Upgrade' : 'Manage plan'}
          </a>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-lg border border-red-500/20 bg-red-500/5 p-5">
        <h2 className="text-sm font-medium text-red-400 mb-2">Danger zone</h2>
        <p className="text-xs text-slate-400 mb-3">Once you delete your account, all data will be permanently removed. This action cannot be undone.</p>

        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-500/30 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
            Delete account
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={handleDeleteAccount} disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors">
              {deleting ? 'Deleting...' : 'Yes, delete my account'}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 transition-colors">
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
