import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'

function fmtUsd(n) {
  const v = Number(n) || 0
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Card({ children, style }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)', boxShadow: 'var(--cbm-shadow-md)', ...style }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cbm-accent-text)' }}>
      {children}
    </h2>
  )
}

export default function Ops() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [data, setData] = useState(null)
  const [status, setStatus] = useState(token ? 'loading' : 'denied')

  useEffect(() => {
    document.title = 'Ops · CloudBudgetMaster'
    if (!token) {
      setStatus('denied')
      return
    }
    setStatus('loading')
    api.get('/ops/overview', { params: { token } })
      .then((r) => {
        setData(r.data)
        setStatus('ok')
      })
      .catch(() => setStatus('denied'))
  }, [token])

  const wrapStyle = { background: 'var(--cbm-canvas)', color: 'var(--cbm-fg)', fontFamily: 'var(--cbm-font-sans)' }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={wrapStyle}>
        <div
          className="h-8 w-8 rounded-full border-[3px]"
          style={{ borderColor: 'var(--cbm-border)', borderTopColor: 'var(--cbm-primary)', animation: 'cbm-spin 0.8s linear infinite' }}
        />
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center" style={wrapStyle}>
        <p className="text-[16px] font-bold" style={{ color: 'var(--cbm-fg)' }}>Access denied</p>
        <p className="mt-2 max-w-[380px] text-[13.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
          Append <code className="rounded-[4px] px-1.5 py-0.5 font-mono text-[12.5px]" style={{ background: 'var(--cbm-glass-2)', color: 'var(--cbm-accent-text)' }}>?token=&hellip;</code> to the URL.
        </p>
      </div>
    )
  }

  const { revenue, blog, users, waitlist } = data

  return (
    <div className="min-h-screen" style={wrapStyle}>
      <div className="mx-auto max-w-[1100px] px-6 py-12">
        <div className="mb-10">
          <h1 className="text-[24px] font-extrabold tracking-[-0.01em]" style={{ color: 'var(--cbm-fg)' }}>Ops overview</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>Founder-only snapshot. Not linked anywhere.</p>
        </div>

        {/* REVENUE */}
        <section className="mb-12">
          <SectionTitle>Revenue</SectionTitle>
          <Card style={{ marginBottom: 16 }}>
            <p className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>Total revenue</p>
            <p className="mt-1 font-mono text-[36px] font-extrabold leading-none" style={{ color: 'var(--cbm-positive)' }}>
              {fmtUsd(revenue?.total_usd)}
            </p>
            <p className="mt-2 text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>
              One-time products: <span className="font-mono" style={{ color: 'var(--cbm-fg-2)' }}>{fmtUsd(revenue?.one_time_total_usd)}</span>
            </p>
          </Card>

          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {(revenue?.by_product || []).map((p) => (
              <Card key={p.product}>
                <p className="text-[13.5px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{p.label || p.product}</p>
                <p className="mt-2 font-mono text-[22px] font-extrabold" style={{ color: 'var(--cbm-fg)' }}>{fmtUsd(p.revenue_usd)}</p>
                <p className="mt-1 text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>{p.orders ?? 0} order{p.orders === 1 ? '' : 's'}</p>
              </Card>
            ))}
            <Card style={{ borderColor: 'var(--cbm-primary)' }}>
              <p className="text-[13.5px] font-bold" style={{ color: 'var(--cbm-fg)' }}>Pro subscriptions</p>
              <p className="mt-2 font-mono text-[22px] font-extrabold" style={{ color: 'var(--cbm-fg)' }}>{fmtUsd(revenue?.pro?.revenue_usd)}</p>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>{revenue?.pro?.count ?? 0} subscriber{revenue?.pro?.count === 1 ? '' : 's'}</p>
            </Card>
          </div>
        </section>

        {/* BLOG */}
        <section className="mb-12">
          <SectionTitle>Blog</SectionTitle>
          <div className="mb-4 grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <Card>
              <p className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>Total views</p>
              <p className="mt-1 font-mono text-[26px] font-extrabold" style={{ color: 'var(--cbm-fg)' }}>{(blog?.total_views ?? 0).toLocaleString('en-US')}</p>
            </Card>
            <Card>
              <p className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>Avg read time</p>
              <p className="mt-1 font-mono text-[26px] font-extrabold" style={{ color: 'var(--cbm-fg)' }}>{blog?.avg_read_time ?? 0} min</p>
            </Card>
          </div>

          <Card style={{ padding: 0 }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--cbm-border-soft)' }}>
                    <th className="px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--cbm-fg-4)' }}>Post</th>
                    <th className="px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--cbm-fg-4)' }}>Views</th>
                    <th className="px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--cbm-fg-4)' }}>Read time</th>
                    <th className="px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--cbm-fg-4)' }}>Published</th>
                  </tr>
                </thead>
                <tbody>
                  {(blog?.posts || []).map((p) => (
                    <tr key={p.slug} style={{ borderBottom: '1px solid var(--cbm-border-soft)' }}>
                      <td className="px-5 py-3 text-[13.5px] font-medium" style={{ color: 'var(--cbm-fg)' }}>{p.title}</td>
                      <td className="px-5 py-3 font-mono text-[13px]" style={{ color: 'var(--cbm-fg-2)' }}>{(p.views ?? 0).toLocaleString('en-US')}</td>
                      <td className="px-5 py-3 text-[13px]" style={{ color: 'var(--cbm-fg-3)' }}>{p.read_time} min</td>
                      <td className="px-5 py-3 text-[13px]" style={{ color: 'var(--cbm-fg-3)' }}>{fmtDate(p.published_at)}</td>
                    </tr>
                  ))}
                  {(!blog?.posts || blog.posts.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>No posts yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* USERS */}
        <section className="mb-12">
          <SectionTitle>Users</SectionTitle>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <Card>
              <p className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>Total users</p>
              <p className="mt-1 font-mono text-[26px] font-extrabold" style={{ color: 'var(--cbm-fg)' }}>{(users?.total ?? 0).toLocaleString('en-US')}</p>
            </Card>
            <Card>
              <p className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>On trial</p>
              <p className="mt-1 font-mono text-[26px] font-extrabold" style={{ color: 'var(--cbm-fg)' }}>{(users?.on_trial ?? 0).toLocaleString('en-US')}</p>
            </Card>
            <Card>
              <p className="mb-2 text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>By plan</p>
              <div className="flex flex-col gap-1.5">
                {Object.entries(users?.by_plan || {}).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: 'var(--cbm-fg-2)' }}>{plan}</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--cbm-fg)' }}>{count}</span>
                  </div>
                ))}
                {(!users?.by_plan || Object.keys(users.by_plan).length === 0) && (
                  <span className="text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>No data.</span>
                )}
              </div>
            </Card>
          </div>
        </section>

        {/* WAITLIST */}
        <section>
          <SectionTitle>Waitlist</SectionTitle>
          <Card style={{ marginBottom: 16 }}>
            <p className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>Total leads</p>
            <p className="mt-1 font-mono text-[26px] font-extrabold" style={{ color: 'var(--cbm-fg)' }}>{(waitlist?.count ?? 0).toLocaleString('en-US')}</p>
          </Card>

          <Card style={{ padding: 0 }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--cbm-border-soft)' }}>
                    <th className="px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--cbm-fg-4)' }}>Email</th>
                    <th className="px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--cbm-fg-4)' }}>Product</th>
                    <th className="px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--cbm-fg-4)' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(waitlist?.recent || []).map((l, i) => (
                    <tr key={`${l.email}-${i}`} style={{ borderBottom: '1px solid var(--cbm-border-soft)' }}>
                      <td className="px-5 py-3 font-mono text-[13px]" style={{ color: 'var(--cbm-fg)' }}>{l.email}</td>
                      <td className="px-5 py-3 text-[13px]" style={{ color: 'var(--cbm-fg-3)' }}>{l.product}</td>
                      <td className="px-5 py-3 text-[13px]" style={{ color: 'var(--cbm-fg-3)' }}>{fmtDate(l.created_at)}</td>
                    </tr>
                  ))}
                  {(!waitlist?.recent || waitlist.recent.length === 0) && (
                    <tr>
                      <td colSpan={3} className="px-5 py-6 text-center text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>No leads yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}
