import React, { useState, useRef, useEffect } from 'react'
import { api } from './api.js'
import { Inline } from './katexUtil.jsx'

export default function Chat({ scheda, focus, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const scroller = useRef(null)

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight }, [messages, busy])

  async function invia() {
    const d = input.trim()
    if (!d || busy) return
    setInput(''); setErr('')
    setMessages(m => [...m, { role: 'user', content: d }])
    setBusy(true)
    try {
      const r = await api('/api/chat', { method: 'POST', body: { scheda, focus, history: messages, domanda: d } })
      setMessages(m => [...m, { role: 'assistant', content: r.risposta || '…' }])
    } catch {
      setErr('Risposta non riuscita. Riprova.')
    } finally { setBusy(false) }
  }

  return (
    <div className="chat-overlay" onClick={onClose}>
      <div className="chat-panel" onClick={e => e.stopPropagation()}>
        <div className="chat-head">
          <div className="chat-head-txt">
            <div className="chat-title">Ho una domanda</div>
            <div className="chat-arg">{scheda?.argomento}</div>
          </div>
          <button className="chat-close" onClick={onClose} aria-label="chiudi">✕</button>
        </div>

        {focus && <div className="chat-focus">Su questo punto: <span>{focus.length > 150 ? focus.slice(0, 150) + '…' : focus}</span></div>}

        <div className="chat-body" ref={scroller}>
          {messages.length === 0 && (
            <div className="chat-empty">Scrivi la tua domanda qui sotto. Posso spiegarti meglio, farti un altro esempio o chiarire un passaggio.</div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.role === 'assistant' ? <Inline text={m.content} /> : m.content}
            </div>
          ))}
          {busy && <div className="chat-msg assistant"><span className="typing"><i /><i /><i /></span></div>}
          {err && <div className="err">{err}</div>}
        </div>

        <div className="chat-input">
          <textarea rows={2} value={input} placeholder="Scrivi qui…" disabled={busy}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); invia() } }} />
          <button onClick={invia} disabled={busy || !input.trim()}>Invia</button>
        </div>
      </div>
    </div>
  )
}
