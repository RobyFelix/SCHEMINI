import React, { useState, useRef, useEffect } from 'react'
import { api } from './api.js'
import { Inline } from './katexUtil.jsx'
import { FigBlock } from './Scheda.jsx'

function IcoImg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5L5 20" />
    </svg>
  )
}

export default function Chat({ scheda, focus, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [imgBusy, setImgBusy] = useState(false)
  const [err, setErr] = useState('')
  const scroller = useRef(null)

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight }, [messages, busy, imgBusy])

  // Trasforma una "visual" (decisa dalla chat) in un blocco figura pronto da mostrare.
  async function risolviVisual(v) {
    try {
      if (v.tipo === 'diagramma' && v.descrizione) {
        const s = await api('/api/schema', { method: 'POST', body: { descrizione: v.descrizione } })
        if (s && s.svg) return { tipo: 'diagramma', svg: s.svg, didascalia: v.didascalia || '', key: (v.didascalia || v.descrizione || '').slice(0, 60) }
      } else if (v.tipo === 'immagine_web' && v.query) {
        const w = await api('/api/immagine-web', { method: 'POST', body: { query: v.query, categoria: v.categoria || '' } })
        if (w && w.dataUrl) return { tipo: 'immagine_web', src: w.dataUrl, attribution: w.attribution || '', didascalia: v.didascalia || '', key: v.query }
      }
    } catch { /* nessuna figura */ }
    return null
  }

  async function invia() {
    const d = input.trim()
    if (!d || busy) return
    setInput(''); setErr('')
    const storia = messages.filter(m => m.content).map(m => ({ role: m.role, content: m.content }))
    setMessages(m => [...m, { role: 'user', content: d }])
    setBusy(true)
    try {
      const r = await api('/api/chat', { method: 'POST', body: { scheda, focus, history: storia, domanda: d } })
      let aIdx = -1
      setMessages(m => { aIdx = m.length; return [...m, { role: 'assistant', content: r.risposta || '…', figLoading: !!r.visual }] })
      if (r.visual) {
        const fig = await risolviVisual(r.visual)
        setMessages(m => m.map((mm, i) => i === aIdx ? { ...mm, fig: fig || undefined, figLoading: false } : mm))
      }
    } catch {
      setErr('Risposta non riuscita. Riprova.')
    } finally { setBusy(false) }
  }

  async function chiediImmagine() {
    if (busy || imgBusy) return
    setErr(''); setImgBusy(true)
    const lastA = [...messages].reverse().find(m => m.role === 'assistant' && m.content)
    const lastU = [...messages].reverse().find(m => m.role === 'user' && m.content)
    const contesto = [
      focus ? `Punto: ${focus}` : '',
      lastU ? `Domanda: ${lastU.content}` : '',
      lastA ? `Risposta: ${lastA.content}` : ''
    ].filter(Boolean).join('\n').slice(0, 1200)
    const evita = messages.map(m => m.fig && m.fig.key).filter(Boolean)
    try {
      const r = await api('/api/illustra', { method: 'POST', body: { argomento: scheda && scheda.argomento, materia: scheda && scheda.materia, contesto, evita } })
      let fig = null
      if (r && r.kind === 'disegno' && r.svg) fig = { tipo: 'diagramma', svg: r.svg, didascalia: '', key: 'd' + Date.now() }
      else if (r && r.kind === 'web' && r.query) {
        const w = await api('/api/immagine-web', { method: 'POST', body: { query: r.query, categoria: r.categoria || '' } })
        if (w && w.dataUrl) fig = { tipo: 'immagine_web', src: w.dataUrl, attribution: w.attribution || '', didascalia: '', key: r.query }
      }
      if (fig) setMessages(m => [...m, { role: 'assistant', fig }])
      else setErr('Non ho trovato un\'immagine utile in più su questo punto.')
    } catch {
      setErr('Immagine non riuscita. Riprova.')
    } finally { setImgBusy(false) }
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

        {focus && (
          <div className="chat-focus">
            <div className="cf-lab">Su questo punto:</div>
            <div className="cf-txt"><Inline text={focus} /></div>
          </div>
        )}

        <div className="chat-body" ref={scroller}>
          {messages.length === 0 && (
            <div className="chat-empty">Scrivi la tua domanda qui sotto. Posso spiegarti meglio, farti un altro esempio o chiarire un passaggio — e se serve ti mostro un'immagine.</div>
          )}
          {messages.map((m, i) => (
            <React.Fragment key={i}>
              {m.content && (
                <div className={`chat-msg ${m.role}`}>
                  {m.role === 'assistant' ? <Inline text={m.content} /> : m.content}
                </div>
              )}
              {m.figLoading && <div className="chat-fig-loading">sto preparando un'immagine…</div>}
              {m.fig && <div className="chat-fig"><FigBlock b={m.fig} /></div>}
            </React.Fragment>
          ))}
          {busy && <div className="chat-msg assistant"><span className="typing"><i /><i /><i /></span></div>}
          {imgBusy && <div className="chat-fig-loading">cerco un'immagine…</div>}
          {err && <div className="err">{err}</div>}
        </div>

        {messages.some(m => m.role === 'assistant' && m.content) && (
          <div className="chat-actions">
            <button className="chat-imgbtn" onClick={chiediImmagine} disabled={busy || imgBusy}>
              <IcoImg /> Mostrami un'immagine
            </button>
          </div>
        )}

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
