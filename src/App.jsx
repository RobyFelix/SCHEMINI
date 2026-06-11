import React, { useEffect, useRef, useState } from 'react'
import Scheda from './Scheda.jsx'
import Chat from './Chat.jsx'
import { api, getPin, setPin, clearPin } from './api.js'

const VERSIONE = '1.6'
const MAX_PAGINE = 5

function normalizza(s) {
  if (!s) return s
  return { ...s, studio: Array.isArray(s.studio) ? s.studio : [], schema: Array.isArray(s.schema) ? s.schema : [] }
}

const MESSAGGI = {
  genera: ["Guardo che m'hai chiesto...", 'Scelgo la roba importante...', 'Sbrodolo gli schemi....', "C'aggiungo i disegnetti...", "...c'a posso fa!"],
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
const IcoCrop = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2v16h16" /><path d="M2 6h16v16" />
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

// Ritaglio verticale: tiene la fascia tra top e bottom (normalizzati 0..1),
// scartando alto e basso. Restituisce un nuovo data-URL.
function ritagliaVerticale(srcDataUrl, top, bottom) {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const W = img.width, H = img.height
      const y0 = Math.round(Math.max(0, Math.min(1, top)) * H)
      const y1 = Math.round(Math.max(0, Math.min(1, bottom)) * H)
      const h = Math.max(1, y1 - y0)
      const c = document.createElement('canvas'); c.width = W; c.height = h
      c.getContext('2d').drawImage(img, 0, y0, W, h, 0, 0, W, h)
      res(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => res(srcDataUrl)
    img.src = srcDataUrl
  })
}

// Ritaglia via i bordi quasi uniformi attorno alla figura (solo verso l'interno,
// non taglia mai il contenuto). Riceve i pixel di una regione e restituisce il
// riquadro stretto sul contenuto, oppure null se non c'è nulla da rifilare.
function rifilaSfondo(imgData, W, H) {
  const d = imgData.data
  const lum = i => (d[i] + d[i + 1] + d[i + 2]) / 3
  const colorato = i => Math.max(Math.abs(d[i] - d[i + 1]), Math.abs(d[i + 1] - d[i + 2]), Math.abs(d[i] - d[i + 2]))
  // luminosità di sfondo stimata dai 4 angoli (di solito bianco della pagina)
  const ang = [0, (W - 1) * 4, (H - 1) * W * 4, ((H - 1) * W + (W - 1)) * 4]
  let bg = 0; for (const i of ang) bg += lum(i); bg /= 4
  const thr = Math.max(20, bg * 0.12)
  const isBg = (x, y) => { const i = (y * W + x) * 4; return (bg - lum(i)) < thr && colorato(i) < 30 }
  const rigaBg = y => { let n = 0; for (let x = 0; x < W; x++) if (isBg(x, y)) n++; return n / W >= 0.985 }
  const colBg = x => { let n = 0; for (let y = 0; y < H; y++) if (isBg(x, y)) n++; return n / H >= 0.985 }
  let top = 0; while (top < H - 1 && rigaBg(top)) top++
  let bot = H - 1; while (bot > top && rigaBg(bot)) bot--
  let left = 0; while (left < W - 1 && colBg(left)) left++
  let right = W - 1; while (right > left && colBg(right)) right--
  const mx = Math.round((right - left) * 0.03), my = Math.round((bot - top) * 0.03)
  left = Math.max(0, left - mx); right = Math.min(W - 1, right + mx)
  top = Math.max(0, top - my); bot = Math.min(H - 1, bot + my)
  const w = right - left + 1, h = bot - top + 1
  if (w < 8 || h < 8) return null            // regione vuota: lascia stare
  if (w >= W && h >= H) return null           // niente da rifilare
  if (w * h < 0.30 * W * H) return null        // rifilatura sospetta: non rischio
  return { x: left, y: top, w, h }
}

function ritaglia(srcDataUrl, box, pad = 0.12) {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const W = img.width, H = img.height
      let [x, y, w, h] = box
      x = Math.max(0, Math.min(1, x)); y = Math.max(0, Math.min(1, y))
      w = Math.max(0.02, Math.min(1 - x, w)); h = Math.max(0.02, Math.min(1 - y, h))
      const px = w * pad, py = h * pad
      const cx = Math.max(0, x - px), cy = Math.max(0, y - py)
      const cw = Math.min(1 - cx, w + 2 * px), ch = Math.min(1 - cy, h + 2 * py)
      const sx = Math.round(cx * W), sy = Math.round(cy * H), sw = Math.round(cw * W), sh = Math.round(ch * H)
      if (sw < 8 || sh < 8) { res(null); return }
      // disegno la regione (margine generoso) su una canvas di servizio
      const t = document.createElement('canvas'); t.width = sw; t.height = sh
      const tc = t.getContext('2d'); tc.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      // aggancio ai bordi reali: rifilo lo sfondo uniforme attorno alla figura
      let rb = null
      try { rb = rifilaSfondo(tc.getImageData(0, 0, sw, sh), sw, sh) } catch {}
      const dx = rb ? rb.x : 0, dy = rb ? rb.y : 0, dw = rb ? rb.w : sw, dh = rb ? rb.h : sh
      const c = document.createElement('canvas'); c.width = dw; c.height = dh
      c.getContext('2d').drawImage(t, dx, dy, dw, dh, 0, 0, dw, dh)
      res(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => res(null)
    img.src = srcDataUrl
  })
}

async function arricchisci(d, foto) {
  const proc = async (blocchi) => {
    if (!Array.isArray(blocchi)) return blocchi
    const out = []
    for (const b of blocchi) {
      if (b && b.tipo === 'immagine' && Array.isArray(b.box) && b.box.length === 4) {
        const src = (foto[(b.pagina || 1) - 1] || {}).url
        if (src) { const crop = await ritaglia(src, b.box); out.push(crop ? { ...b, src: crop } : b) }
        else out.push(b)
      } else out.push(b)
    }
    return out
  }
  return { ...d, studio: await proc(d.studio), schema: await proc(d.schema) }
}

// Per le schede da testo: risolve i blocchi "immagine_web" reperendo l'immagine.
// Gli "schema" (SVG) non vanno risolti: si disegnano da soli.
async function arricchisciTesto(d) {
  const proc = async (blocchi) => {
    if (!Array.isArray(blocchi)) return blocchi
    const out = []
    for (const b of blocchi) {
      if (b && b.tipo === 'immagine_web' && b.query) {
        try {
          const r = await api('/api/immagine-web', { method: 'POST', body: { query: b.query, categoria: b.categoria || '' } })
          if (r && r.dataUrl) out.push({ ...b, src: r.dataUrl, attribution: r.attribution || '' })
          // se non trovata, scarto il blocco: niente figura rotta
        } catch { /* scarto in silenzio */ }
      } else out.push(b)
    }
    return out
  }
  return { ...d, studio: await proc(d.studio), schema: await proc(d.schema) }
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
        <div className="gate-ver">v{VERSIONE}</div>
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
  const [inputMode, setInputMode] = useState('foto')
  const [argomento, setArgomento] = useState('')
  const [foto, setFoto] = useState([])
  const [cropIdx, setCropIdx] = useState(null)
  const [cropTop, setCropTop] = useState(0)
  const [cropBot, setCropBot] = useState(1)
  const [busy, setBusy] = useState('')
  const [errore, setErrore] = useState('')
  const [scheda, setScheda] = useState(null)
  const [tab, setTab] = useState('studio')
  const [archivio, setArchivio] = useState([])
  const [salvato, setSalvato] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatFocus, setChatFocus] = useState(null)
  const [regen, setRegen] = useState(false)
  const [holdId, setHoldId] = useState(null)
  const holdTimer = useRef(null)
  const holdStart = useRef(null)
  const cropStage = useRef(null)
  const cropDrag = useRef(null)
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
      try { const d = await comprimi(f); setFoto(p => p.length < MAX_PAGINE ? [...p, { url: d, orig: d, top: 0, bottom: 1 }] : p) }
      catch { /* salta foto non valida */ }
    }
  }
  function rimuoviFoto(i) { setFoto(p => p.filter((_, j) => j !== i)) }
  function nuovaRichiesta() {
    setFoto([]); setScheda(null); setErrore(''); setSalvato(false); setSalvando(false); setTab('studio'); setChatOpen(false)
  }
  function spostaFoto(i, dir) {
    setFoto(p => { const j = i + dir; if (j < 0 || j >= p.length) return p; const a = [...p]; [a[i], a[j]] = [a[j], a[i]]; return a })
  }
  function apriCrop(i) {
    const f = foto[i]; if (!f) return
    setCropTop(f.top ?? 0); setCropBot(f.bottom ?? 1); setCropIdx(i)
  }
  function chiudiCrop() { cropDrag.current = null; setCropIdx(null) }
  function resetCrop() { setCropTop(0); setCropBot(1) }
  async function applicaCrop() {
    const i = cropIdx; if (i == null) return
    const f = foto[i]; if (!f) { chiudiCrop(); return }
    const noCrop = cropTop <= 0.001 && cropBot >= 0.999
    const url = noCrop ? f.orig : await ritagliaVerticale(f.orig, cropTop, cropBot)
    setFoto(p => p.map((x, j) => j === i ? { ...x, top: noCrop ? 0 : cropTop, bottom: noCrop ? 1 : cropBot, url } : x))
    chiudiCrop()
  }
  function cropDown(e, which) {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    cropDrag.current = which
  }
  function cropMove(e) {
    if (!cropDrag.current || !cropStage.current) return
    const r = cropStage.current.getBoundingClientRect()
    if (!r.height) return
    let y = (e.clientY - r.top) / r.height
    y = Math.max(0, Math.min(1, y))
    const MIN = 0.2
    if (cropDrag.current === 'top') setCropTop(Math.min(y, cropBot - MIN))
    else setCropBot(Math.max(y, cropTop + MIN))
  }
  function cropUp() { cropDrag.current = null }

  async function doGenera() {
    if (!argomento.trim()) return
    setBusy('genera'); setErrore(''); setScheda(null); setSalvato(false)
    try {
      const d = await api('/api/genera', { method: 'POST', body: { argomento } })
      const dd = await arricchisciTesto(d)
      setScheda(normalizza(dd)); setTab('studio')
    } catch (e) {
      setErrore(e.code === 401 ? 'PIN scaduto, rientra.' : 'Generazione fallita. Riprova.')
      if (e.code === 401) setAuthed(false)
    } finally { setBusy('') }
  }

  async function doGeneraFoto() {
    if (foto.length === 0) return
    setBusy('genera'); setErrore(''); setScheda(null); setSalvato(false)
    try {
      const immagini = foto.map(f => ({ media_type: 'image/jpeg', data: f.url.split(',')[1] }))
      const d = await api('/api/genera-foto', { method: 'POST', body: { immagini } })
      const dd = await arricchisci(d, foto)
      setScheda(normalizza(dd)); setTab('studio')
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
      const originali = (scheda[quale] || []).filter(b => b && b.tipo === 'immagine')
      const inviati = (scheda[quale] || []).map(b => (b && b.tipo === 'immagine') ? { tipo: 'immagine', didascalia: b.didascalia } : b)
      const d = await api('/api/semplifica', { method: 'POST', body: { argomento: scheda.argomento, materia: scheda.materia, quale, blocchi: inviati } })
      let nuovi = d.blocchi || scheda[quale]
      let k = 0
      nuovi = nuovi.map(b => {
        if (b && b.tipo === 'immagine') {
          const o = originali[k++]
          return o ? { ...b, src: o.src, box: o.box, pagina: o.pagina, didascalia: b.didascalia || o.didascalia } : b
        }
        return b
      })
      setScheda(s => ({ ...s, [quale]: nuovi }))
      setSalvato(false)
    } catch (e) {
      setErrore(e.code === 401 ? 'PIN scaduto, rientra.' : 'Semplificazione fallita. Riprova.')
      if (e.code === 401) setAuthed(false)
    } finally { setBusy('') }
  }

  async function salva() {
    if (!scheda || salvando) return true
    setSalvando(true); setErrore('')
    try {
      const row = await api('/api/salva', { method: 'POST', body: scheda })
      setSalvato(true)
      setArchivio(a => {
        const altri = a.filter(x => x.id !== row.id)
        return [{ id: row.id, argomento: row.argomento, materia: row.materia, created_at: row.created_at }, ...altri]
      })
      return true
    } catch (e) {
      if (e.code === 401) { setErrore('PIN scaduto, rientra.'); setAuthed(false) }
      else setErrore('Salvataggio fallito: ' + (e.message || 'errore'))
      return false
    } finally { setSalvando(false) }
  }

  async function apri(id) {
    setErrore(''); setSalvato(true); setChatOpen(false)
    try {
      const d = await api(`/api/apri?id=${id}`)
      const c = d.contenuto || {}
      setScheda(normalizza({ argomento: d.argomento, materia: d.materia, studio: c.studio, schema: c.schema }))
      setTab('studio'); window.scrollTo(0, 0)
    } catch { setErrore('Apertura fallita.') }
  }

  async function eliminaDavvero(id) {
    try { await api('/api/elimina', { method: 'POST', body: { id } }); setArchivio(a => a.filter(x => x.id !== id)) }
    catch { setErrore('Eliminazione fallita.') }
  }

  function startHold(e, id) {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    holdStart.current = { x: e.clientX, y: e.clientY }
    setHoldId(id)
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => { eliminaDavvero(id); setHoldId(null); holdStart.current = null }, 1300)
  }
  function moveHold(e) {
    const s = holdStart.current
    if (!s) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (dx * dx + dy * dy > 196) cancelHold() // oltre ~14px = movimento vero
  }
  function cancelHold() { clearTimeout(holdTimer.current); setHoldId(null); holdStart.current = null }

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
  if (!ready) return (
    <div className="loading-full">
      <div className="lf-box">
        <div className="lf-logo">SCHEMINI</div>
        <div className="lf-ver">v{VERSIONE}</div>
        <div className="lf-spin" />
        <div className="lf-msg">Carico…</div>
      </div>
    </div>
  )

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
          <button className={inputMode === 'foto' ? 'on' : ''} onClick={() => setInputMode('foto')}>Scatta er libro</button>
          <button className={inputMode === 'testo' ? 'on' : ''} onClick={() => setInputMode('testo')}>Scrivi che voj</button>
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
                  <img src={f.url} alt={`pagina ${i + 1}`} />
                  <span className="foto-num">{i + 1}</span>
                  <button className="foto-del" onClick={() => rimuoviFoto(i)} aria-label="rimuovi pagina">✕</button>
                  <button className={'foto-crop' + ((f.top > 0.001 || f.bottom < 0.999) ? ' on' : '')} onClick={() => apriCrop(i)} aria-label="ritaglia pagina"><IcoCrop /></button>
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
            {foto.length > 0 && !busy && (
              <button className="nuova-richiesta" onClick={nuovaRichiesta}>NUOVA RICHIESTA</button>
            )}
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
              <button className="save" onClick={salva} disabled={salvato || salvando}><IcoArchivio />{salvando ? 'Salvo…' : (salvato ? 'In archivio ✓' : 'Salva in archivio')}</button>
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
                onPointerDown={(e) => startHold(e, r.id)} onPointerMove={moveHold}
                onPointerUp={cancelHold} onPointerCancel={cancelHold}
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

      {cropIdx != null && foto[cropIdx] && (
        <div className="crop-overlay">
          <div className="crop-card">
            <div className="crop-title">Ritaglia la pagina {cropIdx + 1}</div>
            <div className="crop-hint">Trascina le maniglie per togliere la parte in alto o in basso.</div>
            <div className="crop-stage" ref={cropStage} onPointerMove={cropMove} onPointerUp={cropUp} onPointerCancel={cropUp}>
              <img src={foto[cropIdx].orig} alt="pagina" draggable="false" />
              <div className="crop-shade" style={{ top: 0, height: (cropTop * 100) + '%' }} />
              <div className="crop-shade" style={{ top: (cropBot * 100) + '%', bottom: 0 }} />
              <div className="crop-handle" style={{ top: (cropTop * 100) + '%' }} onPointerDown={(e) => cropDown(e, 'top')}><span /></div>
              <div className="crop-handle" style={{ top: (cropBot * 100) + '%' }} onPointerDown={(e) => cropDown(e, 'bot')}><span /></div>
            </div>
            <div className="crop-actions">
              <button className="crop-reset" onClick={resetCrop}>Tutta la pagina</button>
              <button className="crop-cancel" onClick={chiudiCrop}>Annulla</button>
              <button className="crop-ok" onClick={applicaCrop}>Fatto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
