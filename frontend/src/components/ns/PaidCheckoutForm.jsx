import { useState } from 'react'
import api from '../../lib/api'

/**
 * Real PayPal checkout starter for the purchasable no-signup products
 * (health-check $49, ai-audit $79, networking $39, msp $149). Posts
 * POST /bill-audit/order { email, product } -> { order_id, approval_url }
 * and redirects the browser to PayPal. Mirrors the SaaS Pro checkout
 * pattern in Pricing.jsx (POST /payments/create-order -> approval_url).
 *
 * RI/SP stays on NotifyMeForm (waitlist only, not purchasable yet).
 */
export default function PaidCheckoutForm({ product, price, buttonClassName, buttonStyle }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!email || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const { data } = await api.post('/bill-audit/order', { email, product })
      window.location.href = data.approval_url
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Could not start checkout. Please try again in a moment.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        disabled={submitting}
        className="rounded-[10px] border px-3 py-2.5 text-[13px]"
        style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-glass-1)', color: 'var(--cbm-fg)', fontFamily: 'var(--cbm-font-sans)' }}
      />
      <button type="submit" className={buttonClassName} style={buttonStyle} disabled={submitting}>
        {submitting ? 'Redirecting to PayPal...' : `Continue to payment${price ? ` · ${price}` : ''}`}
      </button>
      <p className="text-center text-[11.5px]" style={{ color: 'var(--cbm-fg-4)' }}>
        You will be redirected to PayPal to complete payment securely.
      </p>
      {error && (
        <p className="text-center text-[12px] font-medium" style={{ color: 'var(--cbm-waste)' }}>
          {error}
        </p>
      )}
    </form>
  )
}
