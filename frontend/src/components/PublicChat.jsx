import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

const GREETING = "Hi! I'm the CloudBudgetMaster assistant. Ask me anything about cutting your AWS, GCP, or Azure bill — idle resources, rightsizing, Reserved Instances, tagging, and more."
const START_CHIPS = ['How do I cut my AWS bill?', 'What is an idle resource?', 'Reserved Instances vs Savings Plans?']

function Spark({ className = 'h-4 w-4' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
}

export default function PublicChat() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }])
  const [chips, setChips] = useState(START_CHIPS)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' }) }, [messages, loading, open])

  const send = async (text) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput(''); setChips([])
    const history = messages.filter(m => m.role !== 'system')
    setMessages(m => [...m, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const { data } = await api.post('/assistant/public-chat', { message: msg, history })
      setMessages(m => [...m, { role: 'assistant', content: data.reply }])
      setChips(data.suggestions || [])
    } catch (e) {
      const tooMany = e?.response?.status === 429
      setMessages(m => [...m, { role: 'assistant', content: tooMany ? "You've asked a lot in a short time — give it a minute and try again 🙂" : "I'm having trouble right now. Please try again in a moment." }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Ask the cost AI"
        className="group fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--ink)] py-2 pl-2 pr-2 sm:pr-4 text-[13px] font-medium text-[var(--fg-1)] shadow-lg transition-colors hover:bg-[var(--ink-2)]">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#FF9900]/15 text-[#FF9900]"><Spark /></span>
        <span className="hidden sm:inline">Ask the cost AI</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 left-5 sm:left-auto z-[60] flex w-auto sm:w-[380px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--ink)] shadow-2xl overflow-hidden" style={{ maxHeight: 'min(70vh, 600px)' }}>
      {/* header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FF9900]/15 text-[#FF9900]"><Spark /></span>
          <div>
            <p className="text-sm font-semibold text-[var(--fg)]">Cost AI</p>
            <p className="text-[11px] text-[var(--fg-4)]">Cloud cost questions, answered</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-lg text-[var(--fg-4)] hover:bg-[var(--glass-2)] hover:text-[var(--fg)]">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-[#FF9900] text-[#1a1205] rounded-br-sm' : 'bg-[var(--glass-2)] text-[var(--fg-1)] rounded-bl-sm'}`}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start"><div className="rounded-2xl rounded-bl-sm bg-[var(--glass-2)] px-3.5 py-2.5">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--fg-4)] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--fg-4)] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--fg-4)] animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div></div>
        )}
        {!loading && chips.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {chips.slice(0, 3).map((c, i) => (
              <button key={i} onClick={() => send(c)} className="rounded-full border border-[var(--border)] bg-[var(--glass-1)] px-3 py-1.5 text-[12px] text-[var(--fg-2)] hover:border-[#FF9900]/40 hover:text-[var(--fg)] transition-colors">{c}</button>
            ))}
          </div>
        )}
      </div>

      {/* input */}
      <div className="border-t border-[var(--border)] p-3">
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about cloud costs…" maxLength={1000}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--glass-1)] px-3 py-2 text-[13px] text-[var(--fg)] placeholder:text-[var(--fg-4)] focus:border-[#FF9900]/50 focus:outline-none" />
          <button type="submit" disabled={loading || !input.trim()} aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FF9900] text-[#1a1205] disabled:opacity-40 transition-opacity">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
        <button onClick={() => navigate('/register')} className="mt-2 w-full text-center text-[11px] text-[var(--fg-4)] hover:text-[#FF9900] transition-colors">
          Want this on your own bill? Connect a cloud free →
        </button>
      </div>
    </div>
  )
}
