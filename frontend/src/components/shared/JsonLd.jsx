import { useEffect } from 'react'

/**
 * Injects a <script type="application/ld+json"> into <head> while mounted.
 * The prerenderer renders the app and captures head, so this structured data
 * ends up in the static HTML for Google rich results.
 */
export default function JsonLd({ data }) {
  useEffect(() => {
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.setAttribute('data-jsonld', '1')
    el.text = JSON.stringify(data)
    document.head.appendChild(el)
    return () => { try { document.head.removeChild(el) } catch { /* gone */ } }
  }, [data])
  return null
}
