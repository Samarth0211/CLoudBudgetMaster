import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import NsNav from '../components/ns/NsNav'
import NsFooter from '../components/ns/NsFooter'

const CATEGORY_STYLE = {
  AWS: { color: 'var(--cbm-primary)', background: 'var(--cbm-primary-tint)', borderColor: 'var(--cbm-border)' },
  GCP: { color: 'var(--cbm-info)', background: 'var(--cbm-info-tint)', borderColor: 'var(--cbm-border)' },
  Azure: { color: 'var(--cbm-info)', background: 'var(--cbm-info-tint)', borderColor: 'var(--cbm-border)' },
  Strategy: { color: 'var(--cbm-ai)', background: 'var(--cbm-ai-tint)', borderColor: 'var(--cbm-border)' },
  FinOps: { color: 'var(--cbm-positive)', background: 'var(--cbm-positive-tint)', borderColor: 'var(--cbm-border)' },
}

export default function Blog() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Blog · CloudBudgetMaster'
    api.get('/blog/posts').then(r => setPosts(r.data.posts || [])).catch(() => setPosts([])).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--cbm-canvas)', color: 'var(--cbm-fg)', fontFamily: 'var(--cbm-font-sans)' }}>
      <NsNav active="blog" ctaLabel="Run a free check" ctaHref="/" />

      <div className="mx-auto max-w-[820px] px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--cbm-accent-text)' }}>Blog</p>
          <h1 className="text-[32px] font-extrabold tracking-[-0.01em]" style={{ color: 'var(--cbm-fg)' }}>Practical cloud cost guides</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>
            Practical guides on cloud cost optimization, FinOps, and infrastructure management.
          </p>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {loading && <p className="text-[13.5px]" style={{ color: 'var(--cbm-fg-4)' }}>Loading&hellip;</p>}
          {!loading && posts.length === 0 && (
            <p className="text-[13.5px]" style={{ color: 'var(--cbm-fg-4)' }}>New articles are on the way. Check back soon.</p>
          )}
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="group block rounded-2xl border p-5 transition-colors"
              style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="inline-flex rounded-[6px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={CATEGORY_STYLE[post.category] || { color: 'var(--cbm-fg-3)', background: 'var(--cbm-glass-2)', borderColor: 'var(--cbm-border)' }}
                    >
                      {post.category}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--cbm-fg-4)' }}>{post.read_time}</span>
                  </div>
                  <h2 className="text-[16.5px] font-bold transition-colors" style={{ color: 'var(--cbm-fg)' }}>{post.title}</h2>
                  <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--cbm-fg-3)' }}>{post.excerpt}</p>
                  <p className="mt-2 text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>
                    {post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <NsFooter compact />
    </div>
  )
}
