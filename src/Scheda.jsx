import React from 'react'
import { Inline, Display } from './katexUtil.jsx'
import Plot from './Plot.jsx'

const PROSE = new Set(['testo', 'elenco'])
const BOX = new Set(['callout', 'formula', 'esempio', 'casi', 'grafico', 'tabella', 'timeline'])

function bloccoTesto(b) {
  switch (b.tipo) {
    case 'testo': return b.testo || ''
    case 'elenco': return (b.voci || []).join('; ')
    case 'formula': return `${b.titolo ? b.titolo + ': ' : ''}${b.latex || ''}${b.legenda ? ' (' + b.legenda + ')' : ''}`
    case 'esempio': return `${b.titolo || 'Esempio'} — ${(b.passi || []).join('; ')}${b.verifica ? ' | Verifica: ' + b.verifica : ''}`
    case 'casi': return (b.voci || []).map(c => `${c.condizione} -> ${c.esito}`).join('; ')
    case 'callout': return `${b.titolo || ''}: ${Array.isArray(b.testo) ? b.testo.join('; ') : (b.testo || '')}`
    case 'grafico': return `grafico di ${b.funzione}${b.didascalia ? ' (' + b.didascalia + ')' : ''}`
    case 'tabella': return `${(b.intestazioni || []).join(' | ')} :: ${(b.righe || []).map(r => r.join(' / ')).join(' ; ')}`
    case 'timeline': return (b.eventi || []).map(e => `${e.data}: ${e.label}`).join('; ')
    default: return ''
  }
}

function Callout({ stile, titolo, testo }) {
  const map = {
    errore: { cls: 'red', lab: titolo || 'Attenzione · errore frequente' },
    collegamento: { cls: 'purple', lab: titolo || 'Collegamento' },
    nota: { cls: 'blue', lab: titolo || 'Nota' }
  }
  const m = map[stile] || map.nota
  return (
    <div className={`callout ${m.cls}`}>
      <div className="tag">{m.lab}</div>
      {Array.isArray(testo)
        ? <ul>{testo.map((t, i) => <li key={i}><Inline text={t} /></li>)}</ul>
        : <div><Inline text={testo} /></div>}
    </div>
  )
}

function Contenuto({ b }) {
  switch (b.tipo) {
    case 'essenziali':
      return (
        <div className="callout blue heart">
          <div className="tag">Se ricordi solo questo…</div>
          <ol>{(b.punti || []).map((p, i) => <li key={i}><Inline text={p} /></li>)}</ol>
        </div>
      )
    case 'testo':
      return <p className="testo"><Inline text={b.testo} /></p>
    case 'elenco':
      return <ul className="elenco">{(b.voci || []).map((v, i) => <li key={i}><Inline text={v} /></li>)}</ul>
    case 'formula':
      return (
        <div className="callout amber">
          {b.titolo && <div className="tag">{b.titolo}</div>}
          <Display tex={b.latex || ''} />
          {b.legenda && <div className="legenda"><Inline text={b.legenda} /></div>}
        </div>
      )
    case 'esempio':
      return (
        <div className="callout green">
          <div className="tag"><Inline text={b.titolo || 'Esempio svolto'} /></div>
          <ol className="passi">{(b.passi || []).map((p, i) => <li key={i}><Inline text={p} /></li>)}</ol>
          {b.verifica && <div className="verifica"><strong>Verifica:</strong> <Inline text={b.verifica} /></div>}
        </div>
      )
    case 'casi':
      return (
        <div className="casi">
          {(b.voci || []).map((c, i) => (
            <div className="caso" key={i}>
              <span className="cond"><Inline text={c.condizione} /></span>
              <span className="esito"><Inline text={c.esito} />{c.nota && <em> — <Inline text={c.nota} /></em>}</span>
            </div>
          ))}
        </div>
      )
    case 'callout':
      return <Callout {...b} />
    case 'grafico':
      return <Plot {...b} />
    case 'timeline':
      return (
        <div className="timeline">
          {(b.eventi || []).map((e, i) => (
            <div className="tl-item" key={i}><span className="tl-data">{e.data}</span><span className="tl-label"><Inline text={e.label} /></span></div>
          ))}
        </div>
      )
    case 'tabella':
      return (
        <table className="tab">
          <thead><tr>{(b.intestazioni || []).map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{(b.righe || []).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>)}</tbody>
        </table>
      )
    case 'glossario':
      return (
        <div className="glossario">
          <div className="gloss-title">Parole difficili</div>
          <div className="gloss-grid">
            {(b.voci || []).map((v, i) => (
              <div className="gloss-item" key={i}>
                <span className="gword">{v.parola}</span> — <span className="gdef"><Inline text={v.definizione} /></span>
              </div>
            ))}
          </div>
        </div>
      )
    default:
      return null
  }
}

function ChiediBtn({ onClick, cls }) {
  return <button className={`chiedi no-print ${cls || ''}`} title="Ho una domanda su questo punto" onClick={onClick}>?</button>
}

export default function Scheda({ tipo, materia, argomento, blocchi, interattivo, onChiedi }) {
  const list = blocchi || []
  const attivo = interattivo && onChiedi

  // 1ª passata: per ogni blocco, la sezione che lo governa; e la prosa raccolta per sezione.
  let cur = -1
  const blockSec = []
  const proseBySec = {}
  list.forEach((b, i) => {
    if (b.tipo === 'sezione') { cur = i; blockSec[i] = i }
    else {
      blockSec[i] = cur
      if (PROSE.has(b.tipo)) (proseBySec[cur] = proseBySec[cur] || []).push(bloccoTesto(b))
    }
  })
  const focusSezione = (b, i) => `${b.titolo}: ${(proseBySec[i] || []).join(' ')}`

  return (
    <div className={`sheet sheet-${tipo}`}>
      <div className="sheet-head">
        <span className="chip">{(materia || (tipo === 'studio' ? 'STUDIO' : 'RIEPILOGO')).toUpperCase()}</span>
        <h2>{argomento}</h2>
        <span className={`bollino ${tipo}`}>{tipo === 'studio' ? 'S' : 'R'}</span>
      </div>

      <div className="sheet-body">
        {list.map((b, i) => {
          // intestazione di sezione: un solo "?" accanto al titolo, se la sezione ha della prosa
          if (b.tipo === 'sezione') {
            const haProsa = attivo && (proseBySec[i] || []).length > 0
            return (
              <div className="sez" key={i}>
                <span className="num">{b.numero}</span>
                <h3>{b.titolo}</h3>
                {haProsa && <ChiediBtn cls="chiedi-sez" onClick={() => onChiedi(focusSezione(b, i))} />}
              </div>
            )
          }
          // prosa: nessun "?" individuale se appartiene a una sezione (coperta dal titolo);
          // se è prosa "orfana" prima di ogni sezione, "?" nell'angolo
          if (PROSE.has(b.tipo)) {
            const orfana = blockSec[i] === -1
            if (attivo && orfana) {
              return (
                <div className="blocco-wrap" key={i}>
                  <Contenuto b={b} />
                  <ChiediBtn onClick={() => onChiedi(bloccoTesto(b))} />
                </div>
              )
            }
            return <Contenuto b={b} key={i} />
          }
          // box colorati: "?" nell'angolo
          if (BOX.has(b.tipo)) {
            if (attivo) {
              return (
                <div className="blocco-wrap" key={i}>
                  <Contenuto b={b} />
                  <ChiediBtn onClick={() => onChiedi(bloccoTesto(b))} />
                </div>
              )
            }
            return <Contenuto b={b} key={i} />
          }
          // essenziali, glossario, altro: nessun "?"
          return <Contenuto b={b} key={i} />
        })}
      </div>
    </div>
  )
}
