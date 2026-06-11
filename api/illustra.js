import { checkPin, readBody, callClaudeText, DISEGNO_REGOLE } from './_lib.js'

export const config = { maxDuration: 45 }

const SYS = `Sei un illustratore didattico per una studentessa di liceo con un lieve DSA. Ti do un ARGOMENTO di studio. Scegli LA cosa più utile da mostrare e rispondi in UNO di questi tre modi, niente altro:

1) Se serve un'IMMAGINE REALE — una CARTINA/MAPPA geografica, un luogo, una regione, uno Stato, un monumento, una persona storica, un'opera d'arte — NON disegnarla. Rispondi con UNA sola riga in questo formato:
IMMAGINE: <query di ricerca> | <categoria>
dove <categoria> è una tra: cartina, monumento, foto, opera. Per le CARTINE la query deve essere in INGLESE con la parola "map" e il nome proprio (es. "Lazio map", "Roman Gaul map", "Italy physical map").

2) Se serve uno SCHEMA ASTRATTO (fisica, geometria, processo, ciclo, relazione, struttura): disegnalo in SVG seguendo le regole qui sotto, e rispondi SOLO con l'SVG.

3) Se l'argomento non è illustrabile in modo utile: rispondi solo con la parola NESSUNO.

Promemoria: una cartina o mappa geografica va SEMPRE reperita (modo 1), MAI disegnata.

${DISEGNO_REGOLE}`

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { argomento, materia } = readBody(req)
  if (!argomento || !argomento.trim()) { res.status(400).json({ error: 'Argomento mancante' }); return }

  try {
    const user = `Argomento: ${argomento.trim()}${materia ? ` (Materia: ${materia})` : ''}.`
    const txt = await callClaudeText(SYS, user, { model: process.env.ANTHROPIC_SCHEMA_MODEL || undefined, max_tokens: 4000 })

    const a = txt.search(/<svg[\s>]/i)
    if (a !== -1) {
      const b = txt.toLowerCase().lastIndexOf('</svg>')
      if (b > a) { res.status(200).json({ kind: 'disegno', svg: txt.slice(a, b + 6) }); return }
    }
    const m = txt.match(/IMMAGINE:\s*(.+?)\s*\|\s*([a-z]+)/i)
    if (m) { res.status(200).json({ kind: 'web', query: m[1].trim(), categoria: m[2].trim().toLowerCase() }); return }
    res.status(200).json({ kind: 'nessuno' })
  } catch (e) {
    res.status(500).json({ error: 'Illustrazione fallita', dettaglio: String(e).slice(0, 200) })
  }
}
