import { Link } from 'react-router-dom'

/** Shared footer for the no-signup marketing pages. `compact` is used on
 * NsProducts / NsHealthCheck which use the shorter single-row footer from
 * the design; NsHome uses the full multi-column footer. */
export default function NsFooter({ compact = false }) {
  if (compact) {
    return (
      <footer className="border-t px-6 py-8" style={{ borderColor: 'var(--cbm-border-soft)', background: 'var(--cbm-surface-raised)' }}>
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4">
          <p className="text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>
            &copy; 2026 CloudBudgetMaster. AWS today; GCP, Azure &amp; Snowflake coming soon.
          </p>
          <div className="flex gap-5">
            <Link to="/" className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>Home</Link>
            <Link to="/products" className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>All products</Link>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="border-t px-6 pb-8 pt-12" style={{ borderColor: 'var(--cbm-border-soft)', background: 'var(--cbm-surface-raised)' }}>
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-wrap justify-between gap-8">
          <div className="max-w-[320px]">
            <div className="flex items-center gap-2.5">
              <img src="/logo-mark.png" alt="" style={{ height: 26, width: 26 }} />
              <span className="text-[15px] font-bold" style={{ color: 'var(--cbm-fg)' }}>CloudBudgetMaster</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'var(--cbm-fg-4)' }}>
              A no-signup AWS bill diagnosis tool. Upload a CSV, get a report, delete your data. AWS today; GCP, Azure &amp; Snowflake coming soon.
            </p>
          </div>
          <div className="flex flex-wrap gap-14">
            <div>
              <h4 className="mb-3 text-[13px] font-bold" style={{ color: 'var(--cbm-fg)' }}>Products</h4>
              <div className="flex flex-col gap-2">
                <Link to="/#free" className="text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>Free AWS bill check</Link>
                <Link to="/products" className="text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>All products</Link>
                <Link to="/health-check" className="text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>Bill health check</Link>
              </div>
            </div>
            <div>
              <h4 className="mb-3 text-[13px] font-bold" style={{ color: 'var(--cbm-fg)' }}>Read</h4>
              <div className="flex flex-col gap-2">
                <Link to="/blog" className="text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>Blog (no signup)</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t pt-6" style={{ borderColor: 'var(--cbm-border-soft)' }}>
          <p className="text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>&copy; 2026 CloudBudgetMaster. Read-only. We never touch your infrastructure.</p>
          <p className="text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>No signup &middot; No cloud access &middot; Files deleted after processing</p>
        </div>
      </div>
    </footer>
  )
}
