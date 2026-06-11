import { checkPin, readBody, callClaudeText } from './_lib.js'

export const config = { maxDuration: 45 }

const SYS = `Sei un illustratore didattico. Ricevi la DESCRIZIONE di uno schema e disegni UN'unica immagine SVG, pulita, chiara ed etichettata, adatta a una studentessa di liceo con un lieve DSA.

REGOLE:
- Rispondi SOLO con il codice SVG, niente testo prima o dopo, niente backtick.
- Inizia con <svg>, includi xmlns='http://www.w3.org/2000/svg' e un viewBox (es. viewBox='0 0 480 300'). Usa apici SINGOLI per gli attributi.
- Disegno SEMPLICE e CORRETTO: poche forme essenziali, linee scure #1f2d3d (stroke-width 2-3), riempimenti tenui, un tocco di blu #2f74b5 o azzurro chiaro per liquidi/evidenze. Sfondo trasparente.
- Etichette in ITALIANO, font-size circa 16, leggibili, vicine a ciò che indicano.
- VIETATO: <script>, gestori di eventi (onclick...), <foreignObject>, <image>, riferimenti o link esterni. Solo forme, linee e testo.
- Chiaro più che bello: meglio uno schema leggibile e corretto che uno ricco e confuso.

ESEMPIO (vasi comunicanti) — questo è lo stile e la pulizia da seguire:
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 300'>
  <rect x='60' y='80' width='70' height='160' fill='none' stroke='#1f2d3d' stroke-width='3'/>
  <rect x='350' y='80' width='70' height='160' fill='none' stroke='#1f2d3d' stroke-width='3'/>
  <rect x='130' y='215' width='220' height='25' fill='none' stroke='#1f2d3d' stroke-width='3'/>
  <rect x='62' y='150' width='66' height='89' fill='#bfe0f2'/>
  <rect x='352' y='150' width='66' height='89' fill='#bfe0f2'/>
  <rect x='131' y='216' width='218' height='23' fill='#bfe0f2'/>
  <line x1='40' y1='150' x2='440' y2='150' stroke='#2f74b5' stroke-width='2' stroke-dasharray='6 5'/>
  <text x='95' y='70' font-size='16' text-anchor='middle' fill='#1f2d3d'>A</text>
  <text x='385' y='70' font-size='16' text-anchor='middle' fill='#1f2d3d'>B</text>
  <text x='240' y='140' font-size='15' text-anchor='middle' fill='#2f74b5'>stesso livello</text>
</svg>

Ora disegna lo schema richiesto, con la stessa pulizia.`

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { descrizione } = readBody(req)
  if (!descrizione || !descrizione.trim()) { res.status(400).json({ error: 'Descrizione mancante' }); return }

  try {
    const txt = await callClaudeText(SYS, `Disegna lo schema per: ${descrizione.trim()}`, {
      model: process.env.ANTHROPIC_SCHEMA_MODEL || undefined,
      max_tokens: 4000
    })
    const a = txt.search(/<svg[\s>]/i)
    const b = txt.toLowerCase().lastIndexOf('</svg>')
    if (a === -1 || b === -1) { res.status(422).json({ error: 'SVG non valido' }); return }
    res.status(200).json({ svg: txt.slice(a, b + 6) })
  } catch (e) {
    res.status(500).json({ error: 'Disegno fallito', dettaglio: String(e).slice(0, 200) })
  }
}
