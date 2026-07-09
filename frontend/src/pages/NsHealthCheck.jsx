import { useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import NsNav from '../components/ns/NsNav'
import NsFooter from '../components/ns/NsFooter'
import FreeCheckUploader from '../components/ns/FreeCheckUploader'
import PaidCheckoutForm from '../components/ns/PaidCheckoutForm'
import PaidReportUploader from '../components/ns/PaidReportUploader'
import api from '../lib/api'

const PRODUCT_META = {
  'health-check': { name: 'AWS bill health check', price: '$49' },
  'ai-audit': { name: 'AI / GPU cost audit', price: '$79' },
  networking: { name: 'Networking cost teardown', price: '$39' },
  msp: { name: 'MSP white-label report', price: '$149' },
}

const BUY_STEPS = [
  { num: '01', title: 'Pay with PayPal', desc: 'Enter your email and continue to PayPal. Secure checkout, no password, no account created.', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
  { num: '02', title: 'Upload your CSV', desc: 'Back here right after payment, drop in your AWS billing export and we scan it immediately.', icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3' },
  { num: '03', title: 'Get your full report', desc: 'Findings with dollar amounts and resource IDs, shown on this page and emailed to you. No account required.', icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
]

export default function NsHealthCheck() {
  const [searchParams, setSearchParams] = useSearchParams()
  const productParam = searchParams.get('product') || 'health-check'
  const product = PRODUCT_META[productParam] ? productParam : 'health-check'
  const meta = PRODUCT_META[product]

  // capture flow state: idle (show checkout) | capturing | paid (show uploader) | error (cancelled/failed)
  const [captureState, setCaptureState] = useState('idle')
  const [captureError, setCaptureError] = useState('')
  const [paidToken, setPaidToken] = useState(null)
  const [paidEmail, setPaidEmail] = useState('')

  useEffect(() => {
    document.title = `${meta.name} - ${meta.price} · CloudBudgetMaster`
  }, [meta])

  // On return from PayPal: /health-check?product=X&paid=1&token=<order_id>&PayerID=...
  useEffect(() => {
    const paid = searchParams.get('paid')
    const orderId = searchParams.get('token')
    const cancelled = searchParams.get('cancelled')

    if (cancelled) {
      setCaptureState('error')
      setCaptureError('Payment was cancelled. You have not been charged.')
      setSearchParams({ product }, { replace: true })
      return
    }

    if (paid === '1' && orderId) {
      setCaptureState('capturing')
      api.post('/bill-audit/capture', { order_id: orderId })
        .then((res) => {
          setPaidToken(res.data.token)
          setPaidEmail(res.data.email || '')
          setCaptureState('paid')
        })
        .catch((err) => {
          const detail = err.response?.data?.detail
          setCaptureError(typeof detail === 'string' ? detail : 'We could not confirm this payment. If you were charged, contact support and we will sort it out.')
          setCaptureState('error')
        })
        .finally(() => {
          setSearchParams({ product }, { replace: true })
        })
    }
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--cbm-canvas)', color: 'var(--cbm-fg)', fontFamily: 'var(--cbm-font-sans)' }}>
      <NsNav active="health" ctaLabel="Run a free check" ctaHref="/#free" />

      {/* HERO */}
      <section className="px-6 pb-2 pt-14">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="mb-3.5 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cbm-accent-text)' }}>
            {meta.name} &middot; {meta.price} one-time
          </p>
          <h1 className="m-0 text-[38px] font-extrabold leading-[1.18] tracking-[-0.01em]" style={{ color: 'var(--cbm-fg)' }}>
            The alarm never fired.<br />This is what it missed.
          </h1>
          <p className="mx-auto mt-[18px] max-w-[560px] text-[15.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
            AWS Budgets tells you the total went up. It does not tell you a NAT Gateway is billing $400/mo to route almost nothing, or that a Bedrock model call volume tripled last week. We read your billing CSV and show you exactly which line items are the problem.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5">
            <a
              href="#checkout"
              className="rounded-[10px] px-[26px] py-[13px] text-[14px] font-bold"
              style={{ background: 'var(--cbm-primary)', color: 'var(--cbm-primary-text)', boxShadow: 'var(--cbm-glow)' }}
            >
              Buy for {meta.price}
            </a>
            <a
              href="#sample"
              className="rounded-[10px] border px-[26px] py-[13px] text-[14px] font-semibold"
              style={{ borderColor: 'var(--cbm-border-strong)', color: 'var(--cbm-fg-2)' }}
            >
              See a sample finding
            </a>
          </div>
          <p className="mt-4 text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>
            No signup &middot; No cloud access &middot; Read-only &middot; File deleted after processing
          </p>
        </div>
      </section>

      {/* SAMPLE (blurred) */}
      <section id="sample" className="px-6 py-14">
        <div className="mx-auto max-w-[760px]">
          <p className="mb-6 text-center text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>
            One real finding from an example report. The rest unlocks after purchase.
          </p>
          <div className="relative overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)', boxShadow: 'var(--cbm-shadow-lg)' }}>
            <div className="flex items-center gap-2.5 border-b px-5 py-3.5" style={{ borderColor: 'var(--cbm-border-soft)' }}>
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full opacity-60" style={{ background: 'var(--cbm-waste)' }} />
                <div className="h-2.5 w-2.5 rounded-full opacity-60" style={{ background: 'var(--cbm-primary)' }} />
                <div className="h-2.5 w-2.5 rounded-full opacity-60" style={{ background: 'var(--cbm-positive)' }} />
              </div>
              <span className="ml-1.5 font-mono text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>aws-bill-health-check.pdf</span>
              <span className="ml-auto rounded-[6px] px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--cbm-accent-text)', background: 'var(--cbm-primary-tint)' }}>Example</span>
            </div>
            <div style={{ padding: 26 }}>
              <div
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-xl border px-4 py-3.5"
                style={{ background: 'var(--cbm-waste-tint)', borderColor: 'var(--cbm-waste)' }}
              >
                <span className="rounded-[6px] px-2 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--cbm-waste)', background: 'var(--cbm-surface)' }}>EC2</span>
                <div className="min-w-0">
                  <p className="m-0 font-mono text-[13px]" style={{ color: 'var(--cbm-fg-1)' }}>i-0a3f9c72e91b45e2c &middot; us-east-1</p>
                  <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--cbm-fg-3)' }}>Stopped since Mar 2, still incurring EBS charges</p>
                </div>
                <span className="font-mono text-[15px] font-bold" style={{ color: 'var(--cbm-waste)' }}>$184/mo</span>
              </div>

              <div className="relative mt-3.5">
                <div className="flex select-none flex-col gap-2.5 blur-[6px]" aria-hidden="true">
                  <div className="h-[52px] rounded-xl" style={{ background: 'var(--cbm-glass-2)' }} />
                  <div className="h-[52px] rounded-xl" style={{ background: 'var(--cbm-glass-2)' }} />
                  <div className="h-[52px] rounded-xl" style={{ background: 'var(--cbm-glass-2)' }} />
                  <div className="h-[52px] rounded-xl" style={{ background: 'var(--cbm-glass-2)' }} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <a
                    href="#checkout"
                    className="rounded-[10px] border px-[18px] py-2.5 text-[13px] font-bold"
                    style={{ background: 'var(--cbm-surface)', borderColor: 'var(--cbm-border-strong)', color: 'var(--cbm-fg)', boxShadow: 'var(--cbm-shadow-md)' }}
                  >
                    Unlock the full report for {meta.price}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BLOCK */}
      <section className="px-6 pb-16 pt-4">
        <div className="mx-auto grid max-w-[900px] gap-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--cbm-positive-border)', background: 'var(--cbm-surface)' }}>
            <div className="mb-3.5 flex items-center gap-2.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cbm-positive)" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="m-0 text-[15px] font-bold" style={{ color: 'var(--cbm-fg)' }}>What we read</h3>
            </div>
            <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
              The CSV you upload, your AWS Cost and Usage Report or billing export. That is resource types, resource IDs, regions, usage amounts, and line-item costs. Nothing else.
            </p>
          </div>
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--cbm-waste)', background: 'var(--cbm-surface)' }}>
            <div className="mb-3.5 flex items-center gap-2.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cbm-waste)" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <h3 className="m-0 text-[15px] font-bold" style={{ color: 'var(--cbm-fg)' }}>What we never touch</h3>
            </div>
            <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
              Your AWS credentials, IAM roles, API keys, or console access. We never ask for them and the scanner has no way to call your account. Your infrastructure stays exactly as it is.
            </p>
          </div>
        </div>
        <p className="mx-auto mt-5 max-w-[900px] text-center text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>
          Not the report you expected? Full refund within 14 days, no questions asked.
        </p>
      </section>

      {/* 3-STEP FLOW */}
      <section className="border-t px-6 pb-16 pt-2" style={{ borderColor: 'var(--cbm-border-soft)', background: 'var(--cbm-surface-raised)' }}>
        <div className="mx-auto max-w-[1000px] pt-14">
          <div className="mx-auto mb-11 max-w-[560px] text-center">
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cbm-accent-text)' }}>How buying works</p>
            <h2 className="mt-2.5 text-[28px] font-bold tracking-[-0.01em]" style={{ color: 'var(--cbm-fg)' }}>No password. No dashboard. No account.</h2>
          </div>
          <div className="grid gap-7" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {BUY_STEPS.map((s) => (
              <div key={s.num} className="text-center">
                <div className="mx-auto mb-4 flex h-[60px] w-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl border" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-glass-2)' }}>
                  <span className="text-[10px] font-bold tracking-[0.1em]" style={{ color: 'var(--cbm-accent-text)' }}>{s.num}</span>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cbm-fg-2)" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                  </svg>
                </div>
                <h3 className="mb-2 text-[14.5px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{s.title}</h3>
                <p className="mx-auto max-w-[240px] text-[13px] leading-snug" style={{ color: 'var(--cbm-fg-3)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CHECKOUT / CAPTURE / UPLOAD (real PayPal purchase flow) */}
      <section id="checkout" className="px-6 py-16">
        <div className="mx-auto max-w-[440px]">
          {captureState === 'idle' && (
            <>
              <div className="rounded-2xl border p-7" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)', boxShadow: 'var(--cbm-shadow-lg)' }}>
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{meta.name}</h3>
                  <span className="font-mono text-[20px] font-extrabold" style={{ color: 'var(--cbm-fg)' }}>{meta.price}</span>
                </div>

                <p className="mb-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
                  Enter your email and continue to PayPal to pay {meta.price} one-time. After payment you come straight back here to upload your CSV and get your report, no password, no dashboard, no account created.
                </p>
                <PaidCheckoutForm
                  product={product}
                  price={meta.price}
                  buttonClassName="flex w-full items-center justify-center gap-2 rounded-[10px] px-3 py-[13px] text-[14px] font-bold cursor-pointer"
                  buttonStyle={{ background: 'var(--cbm-primary)', color: 'var(--cbm-primary-text)', boxShadow: 'var(--cbm-glow)' }}
                />
              </div>

              <div className="mt-8 text-center">
                <p className="text-[13px]" style={{ color: 'var(--cbm-fg-3)' }}>
                  Not ready to pay? Run the free check below and get real findings right now.
                </p>
              </div>
            </>
          )}

          {captureState === 'capturing' && (
            <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)', boxShadow: 'var(--cbm-shadow-lg)' }}>
              <div
                className="mx-auto mb-3.5 h-8 w-8 rounded-full border-[3px]"
                style={{ borderColor: 'var(--cbm-border)', borderTopColor: 'var(--cbm-primary)', animation: 'cbm-spin 0.8s linear infinite' }}
              />
              <p className="text-[13.5px]" style={{ color: 'var(--cbm-fg-2)' }}>Confirming your payment with PayPal&hellip;</p>
            </div>
          )}

          {captureState === 'error' && (
            <div className="rounded-2xl border p-7 text-center" style={{ borderColor: 'var(--cbm-waste-border, var(--cbm-waste))', background: 'var(--cbm-waste-tint)' }}>
              <p className="text-[13.5px] font-semibold" style={{ color: 'var(--cbm-waste)' }}>{captureError}</p>
              <button
                onClick={() => { setCaptureState('idle'); setCaptureError('') }}
                className="mt-4 rounded-[10px] border px-4 py-2 text-[13px] font-semibold"
                style={{ borderColor: 'var(--cbm-border-strong)', color: 'var(--cbm-fg)' }}
              >
                Back to checkout
              </button>
            </div>
          )}

          {captureState === 'paid' && (
            <div className="rounded-2xl border p-7" style={{ borderColor: 'var(--cbm-positive-border)', background: 'var(--cbm-surface)', boxShadow: 'var(--cbm-shadow-lg)' }}>
              <div className="mb-5 flex items-center gap-2.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cbm-positive)" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cbm-fg)' }}>Payment confirmed. Upload your CSV.</h3>
              </div>
              <PaidReportUploader token={paidToken} email={paidEmail} />
            </div>
          )}
        </div>
      </section>

      {/* FREE CHECK NOW */}
      <section id="free" className="px-6 pb-20">
        <div className="mx-auto max-w-[720px]">
          <FreeCheckUploader />
        </div>
      </section>

      <NsFooter compact />
    </div>
  )
}
