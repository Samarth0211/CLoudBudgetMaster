import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'

/**
 * Shared shell for public marketing/legal pages (Security, About, Contact,
 * Privacy, Terms). Header + footer match the landing theme.
 */
export default function MarketingShell({ eyebrow, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--fg-2)]">
      <header className="border-b border-[var(--border-soft)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandLogo className="h-8 w-8" />
            <span className="text-[16px] font-bold tracking-tight text-white">
              Cloud<span className="font-semibold text-[var(--fg-3)]">Budget</span>Master
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-[14px]">
            <Link to="/security" className="hidden text-[var(--fg-3)] hover:text-white sm:inline">Security</Link>
            <Link to="/about" className="hidden text-[var(--fg-3)] hover:text-white sm:inline">About</Link>
            <Link to="/login" className="text-[var(--fg-3)] hover:text-white">Sign in</Link>
            <Link to="/register" className="btn btn-primary px-4 py-2 text-[13px]">Start free</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        {eyebrow && <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--orange-bright)]">{eyebrow}</p>}
        {title && <h1 className="mt-3 text-[34px] font-bold tracking-[-0.02em] text-white sm:text-[40px]">{title}</h1>}
        {subtitle && <p className="mt-4 text-[17px] leading-relaxed text-[var(--fg-3)]">{subtitle}</p>}
        <div className="mt-10">{children}</div>
      </main>

      <footer className="border-t border-[var(--border-soft)] bg-[var(--canvas-2)]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 text-[13px] text-[var(--fg-4)] sm:flex-row">
          <p>© 2026 CloudBudgetMaster, Inc.</p>
          <div className="flex items-center gap-5">
            <Link to="/security" className="hover:text-[var(--fg-2)]">Security</Link>
            <Link to="/privacy" className="hover:text-[var(--fg-2)]">Privacy</Link>
            <Link to="/terms" className="hover:text-[var(--fg-2)]">Terms</Link>
            <Link to="/contact" className="hover:text-[var(--fg-2)]">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
