import { checkPin, slugify, readBody, callClaude, GENERA_SYSTEM, ADDENDUM_VISIVO } from './_lib.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { argomento } = readBody(req)
  if (!argomento || !argomento.trim()) { res.status(400).json({ error: 'Argomento mancante' }); return }

  try {
    const parsed = await callClaude(GENERA_SYSTEM + ADDENDUM_VISIVO, `Argomento richiesto: ${argomento.trim()}`)
    parsed.argomento = parsed.argomento || argomento.trim()
    parsed.slug = slugify(parsed.argomento)
    res.status(200).json(parsed)
  } catch (e) {
    res.status(500).json({ error: 'Generazione fallita', dettaglio: String(e).slice(0, 300) })
  }
}
