import React from 'react'
import { compile } from 'mathjs'

export default function Plot({ funzione, dominio = [-5, 5], punti = [], xlabel = 'x', ylabel = 'y', didascalia }) {
  const W = 360, H = 240, pad = 26
  let fn
  try { fn = compile(funzione) } catch { return <div className="fig-err">grafico non disponibile</div> }

  const [xmin, xmax] = dominio
  const N = 160
  const pts = []
  for (let i = 0; i <= N; i++) {
    const x = xmin + (xmax - xmin) * (i / N)
    let y
    try { y = fn.evaluate({ x }) } catch { y = NaN }
    if (typeof y === 'number' && isFinite(y)) pts.push([x, y])
  }
  if (!pts.length) return <div className="fig-err">grafico non disponibile</div>

  let ymin = Math.min(...pts.map(p => p[1]))
  let ymax = Math.max(...pts.map(p => p[1]))
  punti.forEach(p => { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]) })
  if (ymin === ymax) { ymin -= 1; ymax += 1 }
  const my = (ymax - ymin) * 0.12; ymin -= my; ymax += my

  const sx = x => pad + (x - xmin) / (xmax - xmin) * (W - 2 * pad)
  const sy = y => H - pad - (y - ymin) / (ymax - ymin) * (H - 2 * pad)

  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ')
  const x0 = (xmin <= 0 && xmax >= 0) ? sx(0) : null
  const y0 = (ymin <= 0 && ymax >= 0) ? sy(0) : null

  return (
    <div className="fig">
      <svg viewBox={`0 0 ${W} ${H}`} className="plot" role="img" aria-label={`grafico di ${funzione}`}>
        <rect x="0" y="0" width={W} height={H} fill="white" />
        {y0 != null && <line x1={pad} y1={y0} x2={W - pad} y2={y0} stroke="#c9c9c9" strokeWidth="1" />}
        {x0 != null && <line x1={x0} y1={pad} x2={x0} y2={H - pad} stroke="#c9c9c9" strokeWidth="1" />}
        {x0 != null && <text x={x0 + 4} y={pad - 8} fontSize="11" fill="#888">{ylabel}</text>}
        {y0 != null && <text x={W - pad + 2} y={y0 - 6} fontSize="11" fill="#888">{xlabel}</text>}
        <path d={path} fill="none" stroke="#2f74b5" strokeWidth="2.4" />
        {punti.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p[0])} cy={sy(p[1])} r="3.4" fill="#cf3a30" />
            {p[2] != null && <text x={sx(p[0])} y={sy(p[1]) + 16} fontSize="11" fill="#cf3a30" textAnchor="middle">{p[2]}</text>}
          </g>
        ))}
      </svg>
      {didascalia && <div className="figcap">{didascalia}</div>}
    </div>
  )
}
