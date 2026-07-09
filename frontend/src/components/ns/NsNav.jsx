import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'

/**
 * Shared nav for the no-signup AWS bill-audit marketing pages
 * (NsHome / NsProducts / NsHealthCheck). Mirrors the Fable design handoff
 * nav 1:1, wired onto the app's existing theme mechanism (useTheme), not a
 * separate cbm-theme key.
 */
const NAV_LINKS = [
  ['home', '/', 'Home'],
  ['products', '/products', 'Products'],
  ['catch', '/#catch', 'What we catch'],
  ['blog', '/blog', 'Blog'],
]

export default function NsNav({ active = 'home', ctaLabel = 'Run a free check', ctaHref = '/#free' }) {
  const { theme, toggle } = useTheme()
  const isLight = theme === 'light'
  const [open, setOpen] = useState(false)

  const linkStyle = (key) => ({
    fontSize: '13px',
    fontWeight: active === key ? 600 : 400,
    color: active === key ? 'var(--cbm-fg)' : 'var(--cbm-fg-3)',
  })

  return (
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{ background: 'color-mix(in srgb, var(--cbm-canvas) 85%, transparent)', borderColor: 'var(--cbm-border-soft)' }}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-6">
        <Link to="/" className="flex items-center gap-2.5" style={{ color: 'var(--cbm-fg)' }}>
          <img src="/logo-mark.png" alt="" className="h-7 w-7" />
          <span className="text-[16px] font-bold tracking-tight">CloudBudgetMaster</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map(([key, href, label]) => (
            <Link key={key} to={href} style={linkStyle(key)}>{label}</Link>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border"
            style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-glass-2)', color: 'var(--cbm-fg-2)' }}
          >
            {isLight ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-6.364-2.386l1.591-1.591M3 12h2.25m.386-6.364L7.227 7.227M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
          <Link
            to={ctaHref}
            className="hidden items-center gap-2 rounded-[11px] px-4 py-2 text-[13px] font-bold sm:inline-flex"
            style={{ background: 'var(--cbm-primary)', color: 'var(--cbm-primary-text)', boxShadow: 'var(--cbm-glow)' }}
          >
            {ctaLabel}
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border md:hidden"
            style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-glass-2)', color: 'var(--cbm-fg-2)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div
          className="border-t px-6 py-4 md:hidden"
          style={{ borderColor: 'var(--cbm-border-soft)', background: 'var(--cbm-canvas)' }}
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(([key, href, label]) => (
              <Link
                key={key}
                to={href}
                onClick={() => setOpen(false)}
                className="rounded-[8px] px-2 py-2.5"
                style={linkStyle(key)}
              >
                {label}
              </Link>
            ))}
          </div>
          <Link
            to={ctaHref}
            onClick={() => setOpen(false)}
            className="mt-3 flex items-center justify-center gap-2 rounded-[11px] px-4 py-2.5 text-[13px] font-bold"
            style={{ background: 'var(--cbm-primary)', color: 'var(--cbm-primary-text)', boxShadow: 'var(--cbm-glow)' }}
          >
            {ctaLabel}
          </Link>
        </div>
      )}
    </nav>
  )
}
