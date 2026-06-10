import React, { useEffect, useRef, useState } from 'react'
import Scheda from './Scheda.jsx'
import Chat from './Chat.jsx'
import { api, getPin, setPin, clearPin } from './api.js'

const VERSIONE = '0.5'

const MESSAGGI = {
  genera: ['Leggo l’argomento…', 'Scelgo le cose che contano…', 'Scrivo la lezione e il riepilogo…', 'Preparo esempi e disegni…', 'Ci siamo quasi…'],
  semplifica: ['Rendo tutto più semplice…', 'Accorcio le frasi…', 'Uso parole più facili…', 'Ci siamo quasi…']
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
  const [argomento, setArgomento] = useState('')
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

  useEffect(() => {
    if (!authed) return
    api('/api/elenco').then(d => { setArchivio(d); setReady(true) })
      .catch(e => { if (e.code === 401) { setAuthed(false); setReady(true) } else setReady(true) })
  }, [authed])

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

  function genera() {
    if (busy) return
    if (scheda && !salvato) { setRegen(true); return }
    doGenera()
  }

  async function semplifica() {
    if (!scheda || busy) return
    setBusy('semplifica'); setErrore('')
    try {
      const d = await api('/api/semplifica', { method: 'POST', body: scheda })
      setScheda(d); setSalvato(false)
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
  function cancelHold() {
    clearTimeout(holdTimer.current)
    setHoldId(null)
  }

  function stampa(quale) {
    document.body.classList.add(`print-${quale}`)
    const cleanup = () => { document.body.classList.remove('print-studio', 'print-schema'); window.removeEventListener('afterprint', cleanup) }
    window.addEventListener('afterprint', cleanup)
    setTimeout(() => window.print(), 60)
  }

  function apriChat(focus = null) { setChatFocus(focus); setChatOpen(true) }

  // azioni dal pop-up rigenera
  async function regenSalvaEGenera() { const ok = await salva(); if (ok) { setRegen(false); doGenera() } }
  function regenSenzaSalvare() { setRegen(false); doGenera() }
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
          <button className="ask-btn" onClick={() => apriChat(null)}>HO UNA DOMANDA</button>
        )}
      </header>

      <section className="ask no-print">
        <label>Di cosa hai bisogno?</label>
        <textarea rows={2} disabled={!!busy}
          placeholder="Es. Equazioni di secondo grado · Il moto uniformemente accelerato · La presa della Bastiglia"
          value={argomento} onChange={e => setArgomento(e.target.value)} />
        <div className="ask-actions">
          <button className="primary" onClick={genera} disabled={!!busy}>
            {busy === 'genera' ? 'Preparo le schede…' : 'Crea le schede'}
          </button>
          {scheda && (
            <button className="semplifica" onClick={semplifica} disabled={!!busy}>
              {busy === 'semplifica' ? 'Semplifico…' : 'SEMPLIFICA'}
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
              <button className={tab === 'studio' ? 'on' : ''} onClick={() => setTab('studio')}>Studio</button>
              <button className={tab === 'schema' ? 'on' : ''} onClick={() => setTab('schema')}>Riepilogo</button>
            </div>
            <div className="actions">
              <button onClick={() => stampa('studio')}>Stampa STUDIO</button>
              <button onClick={() => stampa('schema')}>Stampa RIEPILOGO</button>
              <button className="save" onClick={salva} disabled={salvato}>{salvato ? 'In archivio ✓' : 'Salva in archivio'}</button>
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
        {archivio.length === 0 && <div className="vuoto">Ancora nessuna scheda salvata.</div>}
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
