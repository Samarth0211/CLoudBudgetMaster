import { useEffect } from 'react'

/**
 * Adds <meta name="robots" content="noindex, nofollow"> while mounted, and
 * removes it on unmount. Use on gated/app pages (dashboard, login, register…)
 * so Google stops flagging them as "not indexed" — public marketing/blog pages
 * stay indexable. Googlebot renders JS and honors the injected tag.
 */
export default function NoIndex() {
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex, nofollow'
    m.setAttribute('data-noindex', '1')
    document.head.appendChild(m)
    return () => { try { document.head.removeChild(m) } catch { /* already gone */ } }
  }, [])
  return null
}
