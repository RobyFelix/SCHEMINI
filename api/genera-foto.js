import { checkPin, slugify, readBody, parseJsonLoose, GENERA_SYSTEM } from './_lib.js'

export const config = { maxDuration: 60 }

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
const MAX_PAGINE = 5

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { immagini } = readBody(req)
  const imgs = (Array.isArray(immagini) ? immagini : []).filter(im => im && im.data).slice(0, MAX_PAGINE)
  if (imgs.length === 0) { res.status(400).json({ error: 'Nessuna pagina ricevuta' }); return }

  const content = imgs.map(im => ({
    type: 'image',
    source: { type: 'base64', media_type: im.media_type || 'image/jpeg', data: im.data }
  }))
  content.push({
    type: 'text',
    text: `Queste sono ${imgs.length} foto delle pagine del libro che la ragazza deve studiare, in ordine. Leggile con attenzione (testo, formule, esempi, figure) e produci le DUE schede (studio e riepilogo) sull'argomento di queste pagine, seguendo esattamente il formato richiesto. Il campo "argomento" deve sintetizzare il tema di queste pagine.`
  })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 10000, system: GENERA_SYSTEM, messages: [{ role: 'user', content }] })
    })
    if (!r.ok) { const t = await r.text(); res.status(502).json({ error: 'Errore dal modello', dettaglio: t.slice(0, 300) }); return }
    const data = await r.json()
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
    const parsed = parseJsonLoose(text)
    parsed.argomento = parsed.argomento || 'Dalle pagine del libro'
    parsed.slug = slugify(parsed.argomento)
    res.status(200).json(parsed)
  } catch (e) {
    res.status(500).json({ error: 'Lettura delle pagine fallita', dettaglio: String(e).slice(0, 300) })
  }
}
