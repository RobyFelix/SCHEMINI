import React from 'react'
import { Inline } from './katexUtil.jsx'
import { FigBlock } from './Scheda.jsx'

const DIFF_LABEL = { semplice: 'Semplice', media: 'Media', difficile: 'Difficile' }

function lettera(i) { return String.fromCharCode(97 + i) + ')' }

function rispostaTesto(q) {
  if (q.tipo === 'multipla' && Array.isArray(q.opzioni)) {
    const idx = q.opzioni.findIndex(o => String(o).trim() === String(q.risposta).trim())
    if (idx >= 0) return `${lettera(idx)} ${q.opzioni[idx]}`
  }
  return q.risposta || ''
}

export default function Test({ argomento, materia, difficolta, domande }) {
  const list = Array.isArray(domande) ? domande : []
  return (
    <div className="test-print">
      <div className="test-head">
        {materia && <span className="test-mat">{materia}</span>}
        <h2 className="test-titolo">{argomento} — Test</h2>
        <div className="test-sub">
          <span>Difficoltà: <strong>{DIFF_LABEL[difficolta] || difficolta}</strong></span>
          <span className="test-anag">Nome: ____________________   Data: __________</span>
        </div>
      </div>

      <ol className="test-domande">
        {list.map((q, i) => (
          <li key={i} className="test-q">
            <div className="test-q-testo"><Inline text={q.testo || ''} /></div>
            {q.visual_fig && <div className="test-q-fig"><FigBlock b={q.visual_fig} /></div>}
            {q.tipo === 'multipla' && Array.isArray(q.opzioni) && (
              <ul className="test-opz">
                {q.opzioni.map((o, j) => (
                  <li key={j}><span className="test-lett">{lettera(j)}</span> <Inline text={String(o)} /></li>
                ))}
              </ul>
            )}
            {q.tipo === 'vero_falso' && (
              <div className="test-vf"><span>Vero ▢</span><span>Falso ▢</span></div>
            )}
            {q.tipo === 'aperta' && (
              <div className="test-righe"><span /><span /></div>
            )}
          </li>
        ))}
      </ol>

      <div className="test-risposte">
        <h3 className="test-risp-titolo">Risposte</h3>
        <ol>
          {list.map((q, i) => (
            <li key={i}>
              <span className="test-risp-val">{rispostaTesto(q)}</span>
              {q.perche && <span className="test-risp-perche"> — <Inline text={q.perche} /></span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
