import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'
import NsNav from '../components/ns/NsNav'
import NsFooter from '../components/ns/NsFooter'

export default function BlogPost() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const viewedSlugRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    api.get(`/blog/posts/${slug}`).then(r => {
      setPost(r.data)
      document.title = `${r.data.title} · CloudBudgetMaster Blog`
      // Fire-and-forget view ping, once per slug (guards StrictMode double-invoke and re-renders).
      if (viewedSlugRef.current !== slug) {
        viewedSlugRef.current = slug
        api.post(`/blog/posts/${slug}/view`).catch(() => {})
      }
    }).catch(() => setPost(null)).finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--cbm-canvas)' }}>
        <div
          className="h-8 w-8 rounded-full border-[3px]"
          style={{ borderColor: 'var(--cbm-border)', borderTopColor: 'var(--cbm-primary)', animation: 'cbm-spin 0.8s linear infinite' }}
        />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--cbm-canvas)', color: 'var(--cbm-fg)', fontFamily: 'var(--cbm-font-sans)' }}>
        <NsNav active="blog" ctaLabel="Run a free check" ctaHref="/" />
        <div className="flex flex-col items-center justify-center px-6 py-32 text-center">
          <p style={{ color: 'var(--cbm-fg-3)' }}>Post not found.</p>
          <Link to="/blog" className="mt-2 text-[13.5px] font-semibold" style={{ color: 'var(--cbm-accent-text)' }}>Back to blog</Link>
        </div>
        <NsFooter compact />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--cbm-canvas)', color: 'var(--cbm-fg)', fontFamily: 'var(--cbm-font-sans)' }}>
      <NsNav active="blog" ctaLabel="Run a free check" ctaHref="/" />

      <div className="mx-auto max-w-[720px] px-6 py-16">
        {/* Post header */}
        <div className="mb-8">
          <Link to="/blog" className="mb-4 inline-block text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>&larr; Back to blog</Link>
          <h1 className="text-[30px] font-extrabold leading-[1.2] tracking-[-0.01em]" style={{ color: 'var(--cbm-fg)' }}>{post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>
              {post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
            </span>
            <span style={{ color: 'var(--cbm-fg-4)' }}>&middot;</span>
            <span className="text-[12.5px]" style={{ color: 'var(--cbm-fg-4)' }}>{post.read_time}</span>
            <span style={{ color: 'var(--cbm-fg-4)' }}>&middot;</span>
            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--cbm-accent-text)' }}>{post.category}</span>
          </div>
        </div>

        {/* Post content */}
        <article>
          {post.content.split('\n').map((line, i) => {
            const trimmed = line.trim()
            if (!trimmed) return <div key={i} className="h-4" />
            if (trimmed.startsWith('## ')) return <h2 key={i} className="mt-8 mb-3 text-[21px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{trimmed.slice(3)}</h2>
            if (trimmed.startsWith('### ')) return <h3 key={i} className="mt-6 mb-2 text-[16px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{trimmed.slice(4)}</h3>
            if (trimmed.startsWith('```')) return null
            if (trimmed.startsWith('aws ') || trimmed.startsWith('az ') || trimmed.startsWith('gcloud ')) {
              return (
                <pre
                  key={i}
                  className="my-3 overflow-x-auto rounded-[10px] border p-4 font-mono text-[12.5px]"
                  style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface-raised)', color: 'var(--cbm-fg-2)' }}
                >
                  {trimmed}
                </pre>
              )
            }
            if (trimmed.startsWith('- **') || trimmed.startsWith('- `')) {
              return <li key={i} className="mb-1 ml-4 list-disc text-[14.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-2)' }}>{renderInline(trimmed.slice(2))}</li>
            }
            if (/^\d+\./.test(trimmed)) {
              return <li key={i} className="mb-1 ml-4 list-decimal text-[14.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-2)' }}>{renderInline(trimmed.replace(/^\d+\.\s*/, ''))}</li>
            }
            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
              return <p key={i} className="mt-4 mb-1 text-[14.5px] font-bold" style={{ color: 'var(--cbm-fg)' }}>{trimmed.slice(2, -2)}</p>
            }
            if (trimmed.startsWith('**Fix:**') || trimmed.startsWith('**Action:**') || trimmed.startsWith('**Look for:**') || trimmed.startsWith('**Options:**')) {
              return <p key={i} className="mb-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-2)' }}>{renderInline(trimmed)}</p>
            }
            return <p key={i} className="mb-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>{renderInline(trimmed)}</p>
          })}
        </article>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border p-6 text-center" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)' }}>
          <h3 className="text-[16px] font-bold" style={{ color: 'var(--cbm-fg)' }}>Stop guessing where your cloud money goes</h3>
          <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--cbm-fg-3)' }}>CloudBudgetMaster scans your AWS bill and finds waste automatically.</p>
          <Link
            to="/"
            className="mt-4 inline-flex rounded-[10px] px-5 py-2.5 text-[13.5px] font-bold"
            style={{ background: 'var(--cbm-primary)', color: 'var(--cbm-primary-text)', boxShadow: 'var(--cbm-glow)' }}
          >
            Run a free check
          </Link>
        </div>
      </div>

      <NsFooter compact />
    </div>
  )
}

function renderInline(text) {
  // Handle **bold**, `code`, and [links]
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--cbm-fg)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded-[4px] px-1.5 py-0.5 font-mono text-[12.5px]" style={{ background: 'var(--cbm-glass-2)', color: 'var(--cbm-accent-text)' }}>
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}
