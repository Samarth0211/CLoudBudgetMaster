const CONFIDENCE_LABEL = {
  confirmed: 'Confirmed in bill',
  likely: 'Likely (bill signal)',
  potential: 'Potential (needs live scan)',
}

function money(v) {
  const n = Number(v) || 0
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Renders a real FindingsReport returned by POST /bill-audit/check. */
export default function FindingsReport({ report }) {
  if (!report) return null

  return (
    <div className="flex flex-col gap-5">
      <div
        className="rounded-2xl border p-6"
        style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)', boxShadow: 'var(--cbm-shadow-lg)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--cbm-fg-4)' }}>Total flagged spend</p>
            <p className="mt-1 font-mono text-[34px] font-extrabold leading-none" style={{ color: 'var(--cbm-waste)' }}>
              {money(report.total_flagged_usd)}<span className="text-[15px] font-semibold" style={{ color: 'var(--cbm-fg-4)' }}>/mo</span>
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--cbm-fg-4)' }}>Total spend</p>
              <p className="mt-1 font-mono text-[18px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{money(report.total_spend_usd)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--cbm-fg-4)' }}>Confirmed</p>
              <p className="mt-1 font-mono text-[18px] font-bold" style={{ color: 'var(--cbm-positive)' }}>{money(report.total_flagged_confirmed_usd)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--cbm-fg-4)' }}>Potential</p>
              <p className="mt-1 font-mono text-[18px] font-bold" style={{ color: 'var(--cbm-accent-text)' }}>{money(report.total_flagged_potential_usd)}</p>
            </div>
          </div>
        </div>

        {report.warnings?.length > 0 && (
          <div className="mt-4 rounded-[10px] border p-3 text-[12.5px]" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-glass-1)', color: 'var(--cbm-fg-3)' }}>
            <strong style={{ color: 'var(--cbm-fg-2)' }}>Notes on this file:</strong>
            <ul className="mt-1 list-disc pl-4">
              {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>

      {report.categories?.map((cat) => (
        <div key={cat.key} className="rounded-2xl border" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)' }}>
          <div className="flex items-baseline justify-between border-b px-5 py-4" style={{ borderColor: 'var(--cbm-border-soft)' }}>
            <h3 className="text-[15px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{cat.label}</h3>
            <p className="font-mono text-[16px] font-bold" style={{ color: 'var(--cbm-fg)' }}>
              {money(cat.total_usd)}<span className="ml-1 text-[11px] font-normal" style={{ color: 'var(--cbm-fg-4)' }}>/month</span>
            </p>
          </div>
          {cat.extra_note && (
            <p className="px-5 pt-3 text-[12.5px] italic" style={{ color: 'var(--cbm-fg-3)' }}>{cat.extra_note}</p>
          )}
          <div className="flex flex-col">
            {cat.findings.length === 0 ? (
              <p className="px-5 py-4 text-[13px]" style={{ color: 'var(--cbm-fg-4)' }}>No line items matched this category in the uploaded CSV.</p>
            ) : (
              cat.findings.map((f, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b px-5 py-3.5 last:border-b-0"
                  style={{ borderColor: 'var(--cbm-border-soft)' }}
                >
                  <span
                    className="rounded-[6px] px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide"
                    style={{ color: 'var(--cbm-info)', background: 'var(--cbm-info-tint)' }}
                  >
                    {f.service}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12.5px]" style={{ color: 'var(--cbm-fg-1)' }}>
                      {f.usage_type || '-'} &middot; {f.region || '-'}
                    </p>
                    <p className="mt-0.5 text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>
                      {f.note} &middot; {CONFIDENCE_LABEL[f.confidence] || f.confidence}
                    </p>
                  </div>
                  <span className="whitespace-nowrap font-mono text-[13.5px] font-bold" style={{ color: 'var(--cbm-waste)' }}>
                    {money(f.monthly_usd)}/mo
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ))}

      {report.disclaimer && (
        <p className="rounded-[10px] p-4 text-[12px]" style={{ background: 'var(--cbm-glass-1)', color: 'var(--cbm-fg-3)' }}>
          {report.disclaimer}
        </p>
      )}
    </div>
  )
}
