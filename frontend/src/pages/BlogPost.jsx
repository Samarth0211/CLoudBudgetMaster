import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'
import BrandLogo from '../components/shared/BrandLogo'

export default function BlogPost() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    api.get(`/blog/posts/${slug}`).then(r => setPost(r.data)).catch(() => setPost(null)).finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return <div className="min-h-screen bg-[#0B1220] flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#FF9900]" /></div>
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">Post not found.</p>
          <Link to="/blog" className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block">Back to blog</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B1220]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Nav */}
        <div className="flex items-center justify-between mb-12">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-7 w-7" />
            <span className="text-sm font-semibold text-white">CloudBudgetMaster</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/blog" className="text-sm text-slate-400 hover:text-white transition-colors">Blog</Link>
            <Link to="/register" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">Get Started Free</Link>
          </div>
        </div>

        {/* Post header */}
        <div className="mb-8">
          <Link to="/blog" className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4 inline-block">&larr; Back to blog</Link>
          <h1 className="text-2xl font-bold text-white leading-tight">{post.title}</h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-slate-500">{post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}</span>
            <span className="text-xs text-slate-600">&middot;</span>
            <span className="text-xs text-slate-500">{post.read_time}</span>
            <span className="text-xs text-slate-600">&middot;</span>
            <span className="text-xs text-indigo-400">{post.category}</span>
          </div>
        </div>

        {/* Post content */}
        <article className="prose-custom">
          {post.content.split('\n').map((line, i) => {
            const trimmed = line.trim()
            if (!trimmed) return <div key={i} className="h-4" />
            if (trimmed.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-white mt-8 mb-3">{trimmed.slice(3)}</h2>
            if (trimmed.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-white mt-6 mb-2">{trimmed.slice(4)}</h3>
            if (trimmed.startsWith('```')) return null
            if (trimmed.startsWith('aws ') || trimmed.startsWith('az ') || trimmed.startsWith('gcloud ')) {
              return <pre key={i} className="rounded-lg bg-slate-900 border border-slate-800 p-4 text-xs text-slate-300 font-mono overflow-x-auto my-3">{trimmed}</pre>
            }
            if (trimmed.startsWith('- **') || trimmed.startsWith('- `')) {
              return <li key={i} className="text-sm text-slate-300 leading-relaxed ml-4 mb-1 list-disc">{renderInline(trimmed.slice(2))}</li>
            }
            if (/^\d+\./.test(trimmed)) {
              return <li key={i} className="text-sm text-slate-300 leading-relaxed ml-4 mb-1 list-decimal">{renderInline(trimmed.replace(/^\d+\.\s*/, ''))}</li>
            }
            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
              return <p key={i} className="text-sm font-semibold text-white mt-4 mb-1">{trimmed.slice(2, -2)}</p>
            }
            if (trimmed.startsWith('**Fix:**') || trimmed.startsWith('**Action:**') || trimmed.startsWith('**Look for:**') || trimmed.startsWith('**Options:**')) {
              return <p key={i} className="text-sm text-slate-300 leading-relaxed mb-2">{renderInline(trimmed)}</p>
            }
            return <p key={i} className="text-sm text-slate-400 leading-relaxed mb-3">{renderInline(trimmed)}</p>
          })}
        </article>

        {/* CTA */}
        <div className="mt-12 rounded-xl border border-slate-800 bg-[#232F3E] p-6 text-center">
          <h3 className="text-base font-semibold text-white">Stop guessing where your cloud money goes</h3>
          <p className="text-sm text-slate-400 mt-1.5">CloudBudgetMaster scans your cloud accounts and finds waste automatically.</p>
          <Link to="/register" className="mt-4 inline-flex rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
            Try Free — No Credit Card
          </Link>
        </div>
      </div>
    </div>
  )
}

function renderInline(text) {
  // Handle **bold**, `code`, and [links]
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-medium">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-indigo-300 font-mono">{part.slice(1, -1)}</code>
    }
    return part
  })
}
