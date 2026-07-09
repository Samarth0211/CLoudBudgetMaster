import { useState } from 'react'
import api from '../../lib/api'

/**
 * Honest "Notify me when this opens" email capture. Used in place of a fake
 * checkout for products that aren't wired to real Stripe billing yet ($79
 * AI/GPU audit, $149 MSP report, $39 networking teardown, $99 RI/SP
 * waitlist). Posts the lead to POST /v1/waitlist ({ email, product }) so
 * nothing is lost -- no fake charge. Real Stripe checkout comes later per
 * Andrei/Dieter.
 */
export default function NotifyMeForm({ productName, buttonStyle, buttonClassName }) {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!email || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await api.post('/waitlist', { email, product: productName })
      setDone(true)
    } catch {
      setError('Something went wrong, please try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <p className="text-center text-[13px] font-semibold" style={{ color: 'var(--cbm-positive)' }}>
        You're on the list, we'll email you when {productName} opens.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="rounded-[10px] border px-3 py-2.5 text-[13px]"
        style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-glass-1)', color: 'var(--cbm-fg)', fontFamily: 'var(--cbm-font-sans)' }}
      />
      <button type="submit" className={buttonClassName} style={buttonStyle} disabled={submitting}>
        {submitting ? 'Submitting...' : 'Notify me when this opens'}
      </button>
      {error && (
        <p className="text-center text-[12px] font-medium" style={{ color: 'var(--cbm-waste)' }}>
          {error}
        </p>
      )}
    </form>
  )
}
