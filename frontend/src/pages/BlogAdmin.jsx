import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

const CATEGORIES = ['AWS', 'GCP', 'Azure', 'FinOps', 'Strategy']
const SITE = 'https://cloudbudgetmaster.com'
const slugify = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const EMPTY = {
  title: '', slug: '', category: 'FinOps', excerpt: '', meta_description: '',
  keywords: '', cover_image: '', content: '', status: 'draft',
}

export default function BlogAdmin() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [editing, setEditing] = useState(null) // null = list view, else post object/EMPTY

  const load = () => {
    setLoading(true)
    api.get('/blog/admin/posts')
      .then(r => { setPosts(r.data.posts || []); setForbidden(false) })
      .catch(e => { if (e?.response?.status === 403) setForbidden(true) })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#FF9900]" /></div>
  if (forbidden || (user && user.is_admin === false)) {
    return (
      <div className="max-w-md mx-auto mt-20 rounded-2xl border border-white/10 bg-[#232F3E] p-8 text-center">
        <h1 className="text-lg font-bold text-white">Admin only</h1>
        <p className="mt-2 text-sm text-slate-400">Your account isn't authorized to manage the blog. Ask an administrator to add your email to <code className="text-slate-300">ADMIN_EMAILS</code>.</p>
      </div>
    )
  }

  if (editing) return <Editor post={editing} onDone={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} />

  const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0)

  return (
    <div className="animate-fade-up pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Blog</h1>
          <p className="mt-1 text-sm text-slate-400">Write SEO-optimized posts. Publishing instantly generates a static page + updates the sitemap.</p>
          {posts.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">Total views: <span className="text-slate-300 font-medium">{totalViews.toLocaleString()}</span></p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <GenerateButton onDone={load} />
          <button onClick={() => setEditing({ ...EMPTY })}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF9900] px-5 py-2.5 text-sm font-semibold text-[#1a1205] hover:brightness-105 transition-all">
            + New Post
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-[#232F3E]/60 px-4 py-3 text-xs text-slate-400">
        <span className="font-medium text-slate-300">Automated daily posts</span> — every day at 8:00 AM IST an open-source AI writes &amp; publishes a new post and emails your subscribers. Use <span className="text-slate-300">Generate with AI</span> to run it now.
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#232F3E] overflow-hidden">
        {posts.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">No posts yet. Click <span className="text-slate-300">New Post</span> to write your first article.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Title</th><th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Views</th>
              <th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Updated</th><th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr></thead>
            <tbody>
              {posts.map(p => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white max-w-[320px]">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="text-xs text-slate-500 truncate">/blog/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{p.category}</td>
                  <td className="px-4 py-3 text-slate-300">{(p.views || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${p.status === 'published' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {p.status === 'published' && <a href={`${SITE}/blog/${p.slug}`} target="_blank" rel="noreferrer" className="text-xs text-[#3FA9F5] hover:underline mr-3">View ↗</a>}
                    <button onClick={() => openEdit(p.id, setEditing)} className="text-xs text-slate-300 hover:text-white mr-3">Edit</button>
                    <DeleteButton id={p.id} onDeleted={load} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function GenerateButton({ onDone }) {
  const [busy, setBusy] = useState(false)
  const run = () => {
    if (!confirm('Generate and publish a new AI post now, and email subscribers?')) return
    setBusy(true)
    api.post('/blog/admin/generate')
      .then(r => { const d = r.data || {}; alert(d.status === 'published' ? `Published: ${d.title}\nEmailed ${d.emailed} subscriber(s).` : `Skipped: ${d.reason || 'already posted recently'}`) })
      .catch(e => alert(e?.response?.data?.detail || 'Generation failed'))
      .finally(() => { setBusy(false); onDone() })
  }
  return (
    <button onClick={run} disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-[#FF9900]/40 px-4 py-2.5 text-sm font-semibold text-[#FF9900] hover:bg-[#FF9900]/10 disabled:opacity-60 transition-all">
      {busy ? 'Generating…' : '✨ Generate with AI'}
    </button>
  )
}

function openEdit(id, setEditing) {
  api.get(`/blog/admin/posts/${id}`).then(r => setEditing(r.data)).catch(() => alert('Could not load post'))
}

function DeleteButton({ id, onDeleted }) {
  const [busy, setBusy] = useState(false)
  return (
    <button disabled={busy}
      onClick={() => { if (!confirm('Delete this post permanently?')) return; setBusy(true); api.delete(`/blog/admin/posts/${id}`).then(onDeleted).catch(() => alert('Delete failed')).finally(() => setBusy(false)) }}
      className="text-xs text-[#FF5247] hover:underline disabled:opacity-50">Delete</button>
  )
}

function Editor({ post, onDone, onCancel }) {
  const [f, setF] = useState({ ...EMPTY, ...post })
  const [slugTouched, setSlugTouched] = useState(!!post.slug)
  const [saving, setSaving] = useState(false)
  const isNew = !post.id
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  const onTitle = (v) => { set('title', v); if (!slugTouched) set('slug', slugify(v)) }

  const save = (status) => {
    if (!f.title.trim()) return alert('Title is required')
    setSaving(true)
    const body = { ...f, status: status ?? f.status, slug: f.slug || slugify(f.title) }
    const req = isNew ? api.post('/blog/admin/posts', body) : api.put(`/blog/admin/posts/${post.id}`, body)
    req.then(() => onDone()).catch(e => alert(e?.response?.data?.detail || 'Save failed')).finally(() => setSaving(false))
  }

  const field = 'w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-[#FF9900]/50 focus:outline-none'

  return (
    <div className="animate-fade-up pb-10 max-w-3xl">
      <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-300 mb-4">← Back to posts</button>
      <h1 className="text-2xl font-bold text-white mb-6">{isNew ? 'New Post' : 'Edit Post'}</h1>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-[#232F3E] p-6">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
          <input className={field} value={f.title} onChange={e => onTitle(e.target.value)} placeholder="7 Ways to Cut Your AWS Bill by 30%" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">URL slug</label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-slate-600 text-xs">/blog/</span>
              <input className={field} value={f.slug} onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)) }} placeholder="cut-aws-bill-30-percent" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
            <select className={field} value={f.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Excerpt <span className="text-slate-600">(shown on the blog index)</span></label>
          <textarea className={field} rows={2} value={f.excerpt} onChange={e => set('excerpt', e.target.value)} placeholder="Practical, no-nonsense steps to find and kill cloud waste this week." />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Meta description <span className="text-slate-600">(SEO — ~155 chars; falls back to excerpt)</span></label>
          <textarea className={field} rows={2} maxLength={180} value={f.meta_description} onChange={e => set('meta_description', e.target.value)} placeholder="Cut your AWS bill by 30% with these 7 FinOps steps: idle EC2, unattached EBS, old snapshots, rightsizing, and more." />
          <p className="mt-1 text-[11px] text-slate-600">{(f.meta_description || '').length}/180</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Keywords <span className="text-slate-600">(comma-separated)</span></label>
            <input className={field} value={f.keywords} onChange={e => set('keywords', e.target.value)} placeholder="aws cost optimization, finops, ec2 waste" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Cover image URL <span className="text-slate-600">(for social previews)</span></label>
            <input className={field} value={f.cover_image} onChange={e => set('cover_image', e.target.value)} placeholder="https://…/cover.png" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Content <span className="text-slate-600">(Markdown — ## headings, **bold**, lists, `code`, tables, links)</span></label>
          <textarea className={`${field} font-mono text-[13px] leading-relaxed`} rows={18} value={f.content} onChange={e => set('content', e.target.value)}
            placeholder={'## Start with idle EC2\n\nIdle instances are the **#1** source of cloud waste...\n\n- Stop dev boxes overnight\n- Rightsize oversized instance types\n\n## Delete unattached EBS volumes\n\nThey cost money for nothing.'} />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-xs text-slate-500">{f.status === 'published' ? 'This post is live.' : 'Draft — not visible publicly until published.'}</span>
          <div className="flex items-center gap-2">
            <button disabled={saving} onClick={() => save('draft')} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50">Save Draft</button>
            <button disabled={saving} onClick={() => save('published')} className="rounded-lg bg-[#FF9900] px-5 py-2 text-sm font-semibold text-[#1a1205] hover:brightness-105 disabled:opacity-50">{saving ? 'Saving…' : 'Publish'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
