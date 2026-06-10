import React from 'react'
import { Inline, Display } from './katexUtil.jsx'
import Plot from './Plot.jsx'

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

function Block({ b }) {
  switch (b.tipo) {
    case 'essenziali':
      return (
        <div className="callout blue heart">
          <div className="tag">Se ricordi solo questo…</div>
          <ol>{(b.punti || []).map((p, i) => <li key={i}><Inline text={p} /></li>)}</ol>
        </div>
      )
    case 'sezione':
      return (
        <div className="sez">
          <span className="num">{b.numero}</span>
          <h3>{b.titolo}</h3>
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
          <div className="tag">{b.titolo || 'Esempio svolto'}</div>
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
                <span className="gword">{v.sillabe || v.parola}</span> — <span className="gdef"><Inline text={v.definizione} /></span>
              </div>
            ))}
          </div>
        </div>
      )
    default:
      return null
  }
}

export default function Scheda({ tipo, materia, argomento, blocchi }) {
  return (
    <div className={`sheet sheet-${tipo}`}>
      <div className="sheet-head">
        <span className="chip">{(materia || 'STUDIO').toUpperCase()}</span>
        <h2>{argomento}</h2>
        <span className={`badge ${tipo}`}>{tipo === 'studio' ? 'STUDIO' : 'SCHEMA'}</span>
      </div>
      <div className="sheet-body">
        {(blocchi || []).map((b, i) => <Block key={i} b={b} />)}
      </div>
    </div>
  )
}
