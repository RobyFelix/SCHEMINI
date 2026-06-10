import React, { useEffect, useState } from 'react'
import Scheda from './Scheda.jsx'

const PIN_KEY = 'schemini_pin'

function getPin() { try { return sessionStorage.getItem(PIN_KEY) || '' } catch { return '' } }

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', 'x-app-pin': getPin() },
    body: body ? JSON.stringify(body) : undefined
  })
  if (res.status === 401) { const e = new Error('PIN'); e.code = 401; throw e }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Errore')
  return data
}

function PinGate({ onOk }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  async function entra() {
    try { sessionStorage.setItem(PIN_KEY, val); await api('/api/elenco'); onOk() }
    catch (e) { setErr(e.code === 401 ? 'PIN errato' : 'Errore di rete'); sessionStorage.removeItem(PIN_KEY) }
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
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')
  const [scheda, setScheda] = useState(null)     // {argomento, materia, slug, studio, schema}
  const [tab, setTab] = useState('studio')
  const [archivio, setArchivio] = useState([])
  const [salvato, setSalvato] = useState(false)

  useEffect(() => {
    if (!authed) return
    api('/api/elenco').then(d => { setArchivio(d); setReady(true) })
      .catch(e => { if (e.code === 401) { setAuthed(false); setReady(true) } else setReady(true) })
  }, [authed])

  async function genera() {
    if (!argomento.trim()) return
    setLoading(true); setErrore(''); setScheda(null); setSalvato(false)
    try {
      const d = await api('/api/genera', { method: 'POST', body: { argomento } })
      setScheda(d); setTab('studio')
    } catch (e) {
      setErrore(e.code === 401 ? 'PIN scaduto, rientra.' : 'Generazione fallita. Riprova.')
      if (e.code === 401) setAuthed(false)
    } finally { setLoading(false) }
  }

  async function salva() {
    if (!scheda) return
    try {
      const row = await api('/api/salva', { method: 'POST', body: scheda })
      setSalvato(true)
      setArchivio(a => [{ id: row.id, argomento: row.argomento, materia: row.materia, created_at: row.created_at }, ...a])
    } catch { setErrore('Salvataggio fallito.') }
  }

  async function apri(id) {
    setErrore(''); setSalvato(true)
    try {
      const d = await api(`/api/apri?id=${id}`)
      const c = d.contenuto || {}
      setScheda({ argomento: d.argomento, materia: d.materia, studio: c.studio, schema: c.schema })
      setTab('studio'); window.scrollTo(0, 0)
    } catch { setErrore('Apertura fallita.') }
  }

  async function elimina(id) {
    if (!confirm('Eliminare questa scheda dall\u2019archivio?')) return
    try { await api('/api/elimina', { method: 'POST', body: { id } }); setArchivio(a => a.filter(x => x.id !== id)) }
    catch { setErrore('Eliminazione fallita.') }
  }

  function stampa(quale) {
    document.body.classList.add(`print-${quale}`)
    const cleanup = () => { document.body.classList.remove(`print-studio`, `print-schema`); window.removeEventListener('afterprint', cleanup) }
    window.addEventListener('afterprint', cleanup)
    setTimeout(() => window.print(), 60)
  }

  if (!authed) return <PinGate onOk={() => setAuthed(true)} />
  if (!ready) return <div className="loading-full">Carico…</div>

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="logo">SCHEMINI</div>
        <div className="sub">schede di studio</div>
      </header>

      <section className="ask no-print">
        <label>Di cosa hai bisogno?</label>
        <textarea rows={2} placeholder="Es. Equazioni di secondo grado · Il moto uniformemente accelerato · La presa della Bastiglia"
          value={argomento} onChange={e => setArgomento(e.target.value)} />
        <button className="primary" onClick={genera} disabled={loading}>
          {loading ? 'Preparo le schede…' : 'Crea le schede'}
        </button>
        {errore && <div className="err">{errore}</div>}
      </section>

      {scheda && (
        <section className="risultato">
          <div className="toolbar no-print">
            <div className="tabs">
              <button className={tab === 'studio' ? 'on' : ''} onClick={() => setTab('studio')}>Studio</button>
              <button className={tab === 'schema' ? 'on' : ''} onClick={() => setTab('schema')}>Schema</button>
            </div>
            <div className="actions">
              <button onClick={() => stampa('studio')}>Stampa STUDIO</button>
              <button onClick={() => stampa('schema')}>Stampa SCHEMA</button>
              <button className="save" onClick={salva} disabled={salvato}>{salvato ? 'In archivio ✓' : 'Salva in archivio'}</button>
            </div>
          </div>

          <div className="print-area">
            <div className={`sheet-wrap ${tab === 'studio' ? 'show' : 'hide'} only-studio`}>
              <Scheda tipo="studio" materia={scheda.materia} argomento={scheda.argomento} blocchi={scheda.studio} />
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
            <li key={r.id}>
              <button className="apri" onClick={() => apri(r.id)}>
                <span className="a-arg">{r.argomento}</span>
                <span className="a-meta">{r.materia ? r.materia + ' · ' : ''}{new Date(r.created_at).toLocaleDateString('it-IT')}</span>
              </button>
              <button className="del" onClick={() => elimina(r.id)} aria-label="elimina">✕</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
