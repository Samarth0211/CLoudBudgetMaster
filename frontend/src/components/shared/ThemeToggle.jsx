import { useTheme } from '../../hooks/useTheme'

/** Light/dark toggle button. `variant="ghost"` for the landing header. */
export default function ThemeToggle({ className = '', variant = 'default' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  const base = variant === 'ghost'
    ? 'text-[var(--fg-3)] hover:text-[var(--fg)] hover:bg-white/5'
    : 'text-slate-400 hover:text-[var(--fg)] hover:bg-[var(--glass-2)] border border-[var(--border)]'
  return (
    <button onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${base} ${className}`}>
      {dark ? (
        // sun
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <circle cx="12" cy="12" r="4" /><path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // moon
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  )
}
