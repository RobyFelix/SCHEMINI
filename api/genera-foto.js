import { checkPin, slugify, readBody, parseJsonLoose, GENERA_SYSTEM } from './_lib.js'

export const config = { maxDuration: 60 }

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
const MAX_PAGINE = 5

const ADDENDUM_FOTO = `

IMMAGINI DEL LIBRO (solo perché stai leggendo delle foto): oltre ai blocchi sopra, puoi inserire blocchi "immagine" che RIUSANO una figura presente nelle pagine fotografate (schema, disegno, grafico, cartina, foto), quando aiuta davvero la comprensione. Formato:
{"tipo":"immagine","pagina":N,"box":[x,y,w,h],"didascalia":"..."}
- "pagina" = numero della foto: 1 è la prima foto, 2 la seconda, e così via.
- "box" = riquadro NORMALIZZATO della figura su quella pagina, valori tra 0 e 1: [x, y, larghezza, altezza], dove x,y è l'angolo in alto a sinistra. Inquadra TUTTO il disegno (cerchi, punti, lettere, numeri, frecce, etichette) lasciando un piccolo margine attorno: meglio un filo di spazio in più che tagliare via un pezzo. Se sei in dubbio sui bordi, allarga leggermente invece di stringere.
- NON includere nel box il numero dell'esercizio, le scritte di consegna (es. "COMPLETA", "RISOLVI"), i titoli o il testo che sta attorno alla figura: solo il disegno vero e proprio.
- Usa "immagine" SOLO per figure vere del libro, mai per ritagliare del testo.
- Inseriscila nel punto giusto della spiegazione (di solito nello "studio"), con una didascalia breve.
- Non esagerare: solo le figure che servono davvero, in genere da 0 a 3 in tutto.`

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
    text: `Queste sono ${imgs.length} foto delle pagine del libro che la ragazza deve studiare, in ordine. Leggile con attenzione (testo, formule, esempi, figure) e produci le DUE schede (studio e riepilogo) sull'argomento di queste pagine, seguendo esattamente il formato richiesto. Quando una figura del libro aiuta la comprensione, riusala con un blocco "immagine". Il campo "argomento" deve sintetizzare il tema di queste pagine.`
  })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 10000, system: GENERA_SYSTEM + ADDENDUM_FOTO, messages: [{ role: 'user', content }] })
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
