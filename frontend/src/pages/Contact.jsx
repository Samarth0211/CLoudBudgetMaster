import { useState } from 'react'
import MarketingShell from '../components/shared/MarketingShell'
import api from '../lib/api'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' })
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.message.trim().length < 5) { setError('Please add a little more detail.'); return }
    setStatus('sending'); setError('')
    try {
      await api.post('/contact', form)
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    }
  }

  const field = 'w-full rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder:text-[var(--fg-4)] outline-none focus:border-[var(--orange-ring)] focus:ring-1 focus:ring-[var(--orange-ring)] transition-colors'

  return (
    <MarketingShell
      eyebrow="Contact"
      title="Talk to us or book a demo"
      subtitle="Questions about multi-cloud setups, enterprise plans, or security? Send a note and we'll get back to you."
    >
      {status === 'sent' ? (
        <div className="rounded-2xl border border-[var(--positive-tint)] bg-[var(--positive-tint)] p-8 text-center">
          <p className="text-[18px] font-semibold text-white">Thanks — we got your message.</p>
          <p className="mt-2 text-[14px] text-[var(--fg-3)]">We'll reply to <span className="mono text-[var(--fg-1)]">{form.email}</span> shortly.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-2xl border border-[var(--border)] bg-[var(--ink)] p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[13px] font-medium text-[var(--fg-2)]">Name</label>
              <input className={`${field} mt-1.5`} value={form.name} onChange={set('name')} placeholder="Jane Doe" required maxLength={120} />
            </div>
            <div>
              <label className="text-[13px] font-medium text-[var(--fg-2)]">Work email</label>
              <input type="email" className={`${field} mt-1.5`} value={form.email} onChange={set('email')} placeholder="jane@company.com" required />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-[13px] font-medium text-[var(--fg-2)]">Company <span className="text-[var(--fg-4)]">(optional)</span></label>
            <input className={`${field} mt-1.5`} value={form.company} onChange={set('company')} placeholder="Acme Inc." maxLength={160} />
          </div>
          <div className="mt-4">
            <label className="text-[13px] font-medium text-[var(--fg-2)]">How can we help?</label>
            <textarea className={`${field} mt-1.5 min-h-[130px] resize-y`} value={form.message} onChange={set('message')} placeholder="Tell us about your cloud setup or what you'd like to see in a demo…" required maxLength={4000} />
          </div>
          {error && <p className="mt-3 text-[13px] text-[var(--waste)]">{error}</p>}
          <button type="submit" disabled={status === 'sending'} className="btn btn-primary mt-6 w-full py-3.5 text-[15px] disabled:opacity-60">
            {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>
        </form>
      )}
    </MarketingShell>
  )
}
