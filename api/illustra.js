import { checkPin, readBody, callClaudeText, DISEGNO_REGOLE } from './_lib.js'

export const config = { maxDuration: 45 }

const SYS = `Sei un illustratore didattico. Ti do un ARGOMENTO di studio di liceo. Se è illustrabile con UNO schema utile a capirlo, disegnalo. Se è puramente astratto/verbale e un disegno non aiuterebbe (es. una regola grammaticale, un concetto storico narrativo), rispondi SOLO con la parola NESSUNO, niente altro.

${DISEGNO_REGOLE}

Disegna lo schema più utile per l'argomento, oppure scrivi NESSUNO.`

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { argomento, materia } = readBody(req)
  if (!argomento || !argomento.trim()) { res.status(400).json({ error: 'Argomento mancante' }); return }

  try {
    const user = `Argomento: ${argomento.trim()}${materia ? ` (Materia: ${materia})` : ''}.`
    const txt = await callClaudeText(SYS, user, { model: process.env.ANTHROPIC_SCHEMA_MODEL || undefined, max_tokens: 4000 })
    const a = txt.search(/<svg[\s>]/i)
    const b = txt.toLowerCase().lastIndexOf('</svg>')
    if (a === -1 || b === -1) { res.status(200).json({ svg: null }); return } // NESSUNO o non illustrabile
    res.status(200).json({ svg: txt.slice(a, b + 6) })
  } catch (e) {
    res.status(500).json({ error: 'Illustrazione fallita', dettaglio: String(e).slice(0, 200) })
  }
}
