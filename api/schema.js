import { checkPin, readBody, callClaudeText, DISEGNO_REGOLE } from './_lib.js'

export const config = { maxDuration: 45 }

const SYS = `Sei un illustratore didattico. Ricevi la DESCRIZIONE di uno schema e disegni UN'unica immagine SVG pulita ed etichettata, adatta a una studentessa di liceo con un lieve DSA.

${DISEGNO_REGOLE}

Ora disegna lo schema descritto, con la stessa pulizia.`

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
