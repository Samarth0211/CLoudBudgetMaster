import { useState, useRef, useEffect } from 'react'
import api from '../lib/api'

const QUICK_ACTIONS = [
  "What am I wasting?",
  "Show my costs",
  "How can I save money?",
  "Explain my top wasters",
]

function getStoredChat() {
  try {
    const raw = localStorage.getItem('cp_chat')
    if (!raw) return null
    const data = JSON.parse(raw)
    const currentMonth = new Date().toISOString().slice(0, 7)
    if (data.month !== currentMonth) return null // reset on new month
    return data
  } catch { return null }
}

function storeChat(messages, usage, limitReached) {
  const currentMonth = new Date().toISOString().slice(0, 7)
  localStorage.setItem('cp_chat', JSON.stringify({ messages, usage, limitReached, month: currentMonth }))
}

export default function ChatWidget() {
  const stored = getStoredChat()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState(stored?.messages || [])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState(stored?.messages?.length ? [] : QUICK_ACTIONS)
  const [limitReached, setLimitReached] = useState(stored?.limitReached || false)
  const [usage, setUsage] = useState(stored?.usage || null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Persist chat state
  useEffect(() => {
    storeChat(messages, usage, limitReached)
  }, [messages, usage, limitReached])

  // Fetch usage from backend on mount
  useEffect(() => {
    api.get('/assistant/usage').then(({ data }) => {
      setUsage(data)
      if (data.used >= data.limit) setLimitReached(true)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus()
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    if (!text.trim() || loading || limitReached) return

    const userMsg = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setSuggestions([])

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const { data } = await api.post('/assistant/chat', {
        message: text.trim(),
        history,
      })

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (data.suggestions?.length) setSuggestions(data.suggestions)
      if (data.chat_usage) setUsage(data.chat_usage)
    } catch (err) {
      if (err.response?.status === 429) {
        setLimitReached(true)
        setUsage({ used: 0, limit: 0 })
        setMessages(prev => [...prev, {
          role: 'limit',
          content: err.response?.data?.detail || 'Chat limit reached. Upgrade for more.'
        }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong. Please try again." }])
      }
      setSuggestions(["What am I wasting?", "Show my costs"])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg hover:bg-indigo-500 hover:scale-105 transition-all">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0B1220]" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[360px] max-h-[550px] flex-col rounded-lg border border-slate-800 bg-[#0B1220] shadow-2xl animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">CloudBudgetMaster AI</p>
                {usage && <p className="text-[10px] text-slate-500">{usage.used}/{usage.limit} messages this month</p>}
              </div>
            </div>
            <button onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[280px] max-h-[360px]">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 mb-3">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <p className="text-sm text-white font-medium">Cloud cost assistant</p>
                <p className="text-xs text-slate-500 mt-1">Ask about your costs, waste, or savings.</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'limit' ? (
                  /* Rate limit message */
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 mb-3">
                      <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-amber-300 mb-1">Chat limit reached</p>
                    <p className="text-xs text-slate-400 mb-3">You've used all your free messages this month.</p>
                    <a href="/pricing"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      Upgrade for more messages
                    </a>
                  </div>
                ) : (
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/20'
                        : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && !loading && !limitReached && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-slate-800 p-3">
            <div className="flex items-center gap-2">
              <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder={limitReached ? "Upgrade to continue chatting..." : "Ask about your cloud costs..."}
                disabled={loading || limitReached}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-40 transition-colors" />
              <button type="submit" disabled={loading || !input.trim() || limitReached}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white disabled:opacity-30 hover:bg-indigo-500 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
