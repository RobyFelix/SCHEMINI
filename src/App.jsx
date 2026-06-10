import React, { useEffect, useRef, useState } from 'react'
import Scheda from './Scheda.jsx'
import Chat from './Chat.jsx'
import { api, getPin, setPin, clearPin } from './api.js'

const VERSIONE = '1.1'
const MAX_PAGINE = 5

const MESSAGGI = {
  genera: ["Guardo che m'hai chiesto...", 'Scelgo la roba importante...', 'Sbrodolo gli schemi....', "C'aggiungo i disegnetti...", "...so' quasi arrivato...."],
  semplifica: ['Famo tutto più semplice...', 'Meno sbrodolate...', 'Gnente parole rognose...', '...eccome...']
}

const IcoStampa = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" rx="1" />
  </svg>
)
const IcoArchivio = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4h18v4H3z" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" />
  </svg>
)

function comprimi(file) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const max = 1500
      const sc = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(img.src)
      res(c.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => { URL.revokeObjectURL(img.src); rej(new Error('img')) }
    img.src = URL.createObjectURL(file)
  })
}

function LoadingCard({ kind }) {
  const msgs = MESSAGGI[kind] || MESSAGGI.genera
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % msgs.length), 2500); return () => clearInterval(t) }, [msgs.length])
  return (
    <div className="loading-card">
      <div className="spinner" />
      <div className="loading-msg">{msgs[i]}</div>
      <div className="progress"><div className="bar" /></div>
    </div>
  )
}

function PinGate({ onOk }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  async function entra() {
    try { setPin(val); await api('/api/elenco'); onOk() }
    catch (e) { setErr(e.code === 401 ? 'PIN errato' : 'Errore di rete'); clearPin() }
  }
  return (
    <div className="gate">
      <div className="gate-box">
        <div className="logo">SCHEMINI</div>
        <p>Inserisci il PIN per entrare</p>
        <input type="password" inputMode="numeric" value={val} autoFocus
          onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && entra()} />
        {err && <div className="err">{err}</div>}
        <button onClick={entra}>Entra</button>
      </div>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(!!getPin())
  const [ready, setReady] = useState(false)
  const [inputMode, setInputMode] = useState('testo')
  const [argomento, setArgomento] = useState('')
  const [foto, setFoto] = useState([])
  const [busy, setBusy] = useState('')
  const [errore, setErrore] = useState('')
  const [scheda, setScheda] = useState(null)
  const [tab, setTab] = useState('studio')
  const [archivio, setArchivio] = useState([])
  const [salvato, setSalvato] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatFocus, setChatFocus] = useState(null)
  const [regen, setRegen] = useState(false)
  const [holdId, setHoldId] = useState(null)
  const holdTimer = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!authed) return
    api('/api/elenco').then(d => { setArchivio(d); setReady(true) })
      .catch(e => { if (e.code === 401) { setAuthed(false); setReady(true) } else setReady(true) })
  }, [authed])

  async function onPickFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    setErrore('')
    for (const f of files) {
      try { const d = await comprimi(f); setFoto(p => p.length < MAX_PAGINE ? [...p, d] : p) }
      catch { /* salta foto non valida */ }
    }
  }
  function rimuoviFoto(i) { setFoto(p => p.filter((_, j) => j !== i)) }
  function spostaFoto(i, dir) {
    setFoto(p => { const j = i + dir; if (j < 0 || j >= p.length) return p; const a = [...p]; [a[i], a[j]] = [a[j], a[i]]; return a })
  }

  async function doGenera() {
    if (!argomento.trim()) return
    setBusy('genera'); setErrore(''); setScheda(null); setSalvato(false)
    try {
      const d = await api('/api/genera', { method: 'POST', body: { argomento } })
      setScheda(d); setTab('studio')
    } catch (e) {
      setErrore(e.code === 401 ? 'PIN scaduto, rientra.' : 'Generazione fallita. Riprova.')
      if (e.code === 401) setAuthed(false)
    } finally { setBusy('') }
  }

  async function doGeneraFoto() {
    if (foto.length === 0) return
    setBusy('genera'); setErrore(''); setScheda(null); setSalvato(false)
    try {
      const immagini = foto.map(f => ({ media_type: 'image/jpeg', data: f.split(',')[1] }))
      const d = await api('/api/genera-foto', { method: 'POST', body: { immagini } })
      setScheda(d); setTab('studio')
    } catch (e) {
      setErrore(e.code === 401 ? 'PIN scaduto, rientra.' : 'Lettura delle pagine fallita. Riprova con foto più nitide.')
      if (e.code === 401) setAuthed(false)
    } finally { setBusy('') }
  }

  function procediGenera() { if (inputMode === 'foto') doGeneraFoto(); else doGenera() }

  const puoGenerare = !busy && (inputMode === 'testo' ? !!argomento.trim() : foto.length > 0)

  function avviaGenera() {
    if (!puoGenerare) return
    if (scheda && !salvato) { setRegen(true); return }
    procediGenera()
  }

  async function semplifica() {
    if (!scheda || busy) return
    const quale = tab
    setBusy('semplifica'); setErrore('')
    try {
      const d = await api('/api/semplifica', { method: 'POST', body: { argomento: scheda.argomento, materia: scheda.materia, quale, blocchi: scheda[quale] } })
      setScheda(s => ({ ...s, [quale]: d.blocchi || s[quale] }))
      setSalvato(false)
    } catch (e) {
      setErrore(e.code === 401 ? 'PIN scaduto, rientra.' : 'Semplificazione fallita. Riprova.')
      if (e.code === 401) setAuthed(false)
    } finally { setBusy('') }
  }

  async function salva() {
    if (!scheda) return true
    try {
      const row = await api('/api/salva', { method: 'POST', body: scheda })
      setSalvato(true)
      setArchivio(a => {
        const altri = a.filter(x => x.id !== row.id)
        return [{ id: row.id, argomento: row.argomento, materia: row.materia, created_at: row.created_at }, ...altri]
      })
      return true
    } catch { setErrore('Salvataggio fallito.'); return false }
  }

  async function apri(id) {
    setErrore(''); setSalvato(true); setChatOpen(false)
    try {
      const d = await api(`/api/apri?id=${id}`)
      const c = d.contenuto || {}
      setScheda({ argomento: d.argomento, materia: d.materia, studio: c.studio, schema: c.schema })
      setTab('studio'); window.scrollTo(0, 0)
    } catch { setErrore('Apertura fallita.') }
  }

  async function eliminaDavvero(id) {
    try { await api('/api/elimina', { method: 'POST', body: { id } }); setArchivio(a => a.filter(x => x.id !== id)) }
    catch { setErrore('Eliminazione fallita.') }
  }

  function startHold(id) {
    setHoldId(id)
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => { eliminaDavvero(id); setHoldId(null) }, 1300)
  }
  function cancelHold() { clearTimeout(holdTimer.current); setHoldId(null) }

  function stampa(quale) {
    document.body.classList.add(`print-${quale}`)
    const cleanup = () => { document.body.classList.remove('print-studio', 'print-schema'); window.removeEventListener('afterprint', cleanup) }
    window.addEventListener('afterprint', cleanup)
    setTimeout(() => window.print(), 60)
  }

  function apriChat(focus = null) { setChatFocus(focus); setChatOpen(true) }

  async function regenSalvaEGenera() { const ok = await salva(); if (ok) { setRegen(false); procediGenera() } }
  function regenSenzaSalvare() { setRegen(false); procediGenera() }
  function regenEsci() { setRegen(false) }

  if (!authed) return <PinGate onOk={() => setAuthed(true)} />
  if (!ready) return <div className="loading-full">Carico…</div>

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="brand">
          <div className="logo">SCHEMINI</div>
          <div className="ver">v{VERSIONE}</div>
        </div>
        {scheda && !busy && (
          <button className="ask-btn" onClick={() => apriChat(null)}>HO UNA DOMANDA!</button>
        )}
      </header>

      <section className="ask no-print">
        <div className="in-tabs">
          <button className={inputMode === 'testo' ? 'on' : ''} onClick={() => setInputMode('testo')}>Scrivi che voj</button>
          <button className={inputMode === 'foto' ? 'on' : ''} onClick={() => setInputMode('foto')}>Scatta er libro</button>
        </div>

        {inputMode === 'testo' ? (
          <>
            <label>CHE TE SPIEGO?</label>
            <textarea rows={2} disabled={!!busy}
              placeholder="Es. Equazioni di secondo grado · Il moto uniformemente accelerato · La presa della Bastiglia"
              value={argomento} onChange={e => setArgomento(e.target.value)} />
          </>
        ) : (
          <div className="foto-pane">
            <div className="foto-hint">Scatta le pagine da studiare, in ordine, con buona luce. Massimo {MAX_PAGINE} pagine.</div>
            <div className="foto-grid">
              {foto.map((f, i) => (
                <div className="foto-cell" key={i}>
                  <img src={f} alt={`pagina ${i + 1}`} />
                  <span className="foto-num">{i + 1}</span>
                  <button className="foto-del" onClick={() => rimuoviFoto(i)} aria-label="rimuovi pagina">✕</button>
                  <div className="foto-move">
                    <button onClick={() => spostaFoto(i, -1)} disabled={i === 0} aria-label="sposta indietro">‹</button>
                    <button onClick={() => spostaFoto(i, 1)} disabled={i === foto.length - 1} aria-label="sposta avanti">›</button>
                  </div>
                </div>
              ))}
              {foto.length < MAX_PAGINE && !busy && (
                <button className="foto-add" onClick={() => fileRef.current && fileRef.current.click()}>
                  <span className="plus">＋</span><span>aggiungi</span>
                </button>
              )}
            </div>
            <div className="foto-count">{foto.length}/{MAX_PAGINE} pagine</div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={onPickFiles} />
          </div>
        )}

        <div className="ask-actions">
          <button className="primary" onClick={avviaGenera} disabled={!puoGenerare}>
            {busy === 'genera' ? 'Preparo le schede…' : 'FAMME LE SCHEDE'}
          </button>
          {scheda && (
            <button className="semplifica" onClick={semplifica} disabled={!!busy}>
              {busy === 'semplifica' ? 'Semplifico…' : 'TROPPO CASINO!'}
            </button>
          )}
        </div>
        {errore && <div className="err">{errore}</div>}
      </section>

      {busy && <section className="risultato"><LoadingCard kind={busy} /></section>}

      {scheda && !busy && (
        <section className="risultato">
          <div className="toolbar no-print">
            <div className="tabs">
              <button className={`tab tab-studio ${tab === 'studio' ? 'on' : ''}`} onClick={() => setTab('studio')}>STUDIO</button>
              <button className={`tab tab-schema ${tab === 'schema' ? 'on' : ''}`} onClick={() => setTab('schema')}>RIEPILOGO</button>
            </div>
            <div className="actions">
              <button className="print" onClick={() => stampa('studio')}><IcoStampa />Stampa STUDIO</button>
              <button className="print" onClick={() => stampa('schema')}><IcoStampa />Stampa RIEPILOGO</button>
              <span className="act-sep" />
              <button className="save" onClick={salva} disabled={salvato}><IcoArchivio />{salvato ? 'In archivio ✓' : 'Salva in archivio'}</button>
            </div>
          </div>

          <div className="print-area">
            <div className={`sheet-wrap ${tab === 'studio' ? 'show' : 'hide'} only-studio`}>
              <Scheda tipo="studio" materia={scheda.materia} argomento={scheda.argomento} blocchi={scheda.studio}
                interattivo onChiedi={apriChat} />
            </div>
            <div className={`sheet-wrap ${tab === 'schema' ? 'show' : 'hide'} only-schema`}>
              <Scheda tipo="schema" materia={scheda.materia} argomento={scheda.argomento} blocchi={scheda.schema} />
            </div>
          </div>
        </section>
      )}

      <section className="archivio no-print">
        <h4>Archivio</h4>
        {archivio.length === 0 && <div className="vuoto">Ancora nessun argomento salvato in archivio</div>}
        <ul>
          {archivio.map(r => (
            <li key={r.id} className={holdId === r.id ? 'holding' : ''}>
              <span className="row-fill" />
              <button className="apri" onClick={() => apri(r.id)} disabled={holdId === r.id}>
                <span className="a-arg">{r.argomento}</span>
                <span className="a-meta">{r.materia ? r.materia + ' · ' : ''}{new Date(r.created_at).toLocaleDateString('it-IT')}</span>
              </button>
              <button className="del-hold"
                onPointerDown={() => startHold(r.id)} onPointerUp={cancelHold}
                onPointerLeave={cancelHold} onPointerCancel={cancelHold}
                title="Tieni premuto per eliminare">
                <span className="del-x">✕</span>
                <span className="del-hint">tieni premuto</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {chatOpen && <Chat scheda={scheda} focus={chatFocus} onClose={() => setChatOpen(false)} />}

      {regen && (
        <div className="modal-overlay" onClick={regenEsci}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Le schede a video non sono salvate</div>
            <p className="modal-text">Se generi nuove schede, queste andranno perse. Vuoi salvarle prima?</p>
            <div className="modal-actions">
              <button className="m-primary" onClick={regenSalvaEGenera}>SALVA e GENERA</button>
              <button onClick={regenSenzaSalvare}>GENERA SENZA SALVARE</button>
              <button className="m-ghost" onClick={regenEsci}>ESCI</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
