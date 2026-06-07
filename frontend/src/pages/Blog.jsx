import { Link } from 'react-router-dom'
import { BLOGS } from '../data/blogs'
import BrandLogo from '../components/shared/BrandLogo'

const CATEGORY_COLORS = {
  AWS: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  GCP: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Azure: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Strategy: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  FinOps: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

export default function Blog() {
  return (
    <div className="min-h-screen bg-[#0B1220]">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Nav */}
        <div className="flex items-center justify-between mb-12">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-7 w-7" />
            <span className="text-sm font-semibold text-white">CloudBudgetMaster</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">Home</Link>
            <Link to="/register" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">Get Started Free</Link>
          </div>
        </div>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white">Blog</h1>
          <p className="text-sm text-slate-400 mt-1">Practical guides on cloud cost optimization, FinOps, and infrastructure management.</p>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {BLOGS.map((post) => (
            <Link key={post.slug} to={`/blog/${post.slug}`}
              className="block rounded-xl border border-slate-800 bg-[#232F3E] p-5 hover:border-slate-700 transition-colors group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[post.category] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {post.category}
                    </span>
                    <span className="text-[11px] text-slate-600">{post.readTime}</span>
                  </div>
                  <h2 className="text-base font-semibold text-white group-hover:text-indigo-400 transition-colors">{post.title}</h2>
                  <p className="text-sm text-slate-400 mt-1.5 line-clamp-2">{post.excerpt}</p>
                  <p className="text-xs text-slate-600 mt-2">{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
