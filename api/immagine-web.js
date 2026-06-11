import { checkPin, readBody } from './_lib.js'

export const config = { maxDuration: 30 }

const UA = 'SCHEMINI/1.0 (study app for a student; educational use)'

function stripTags(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { query, categoria } = readBody(req)
  if (!query || !query.trim()) { res.status(400).json({ error: 'Query mancante' }); return }

  // piccola messa a punto della ricerca in base alla categoria
  let q = query.trim()
  if (categoria === 'cartina' && !/\b(map|mappa|carta)\b/i.test(q)) q += ' map'

  try {
    const base = 'https://commons.wikimedia.org/w/api.php'
    const params = new URLSearchParams({
      action: 'query', format: 'json', origin: '*',
      generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: '15',
      prop: 'imageinfo', iiprop: 'url|mime|extmetadata|size', iiurlwidth: '700'
    })
    const r = await fetch(`${base}?${params.toString()}`, { headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error('wiki ' + r.status)
    const data = await r.json()
    const pages = (data.query && data.query.pages) ? Object.values(data.query.pages) : []
    pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99))

    const okMime = m => m === 'image/jpeg' || m === 'image/png'
    const candidati = pages
      .map(p => p.imageinfo && p.imageinfo[0])
      .filter(ii => ii && ii.thumburl && okMime(ii.mime) && !(ii.width && ii.height && Math.max(ii.width, ii.height) < 300))

    let scelto = null, buf = null
    for (const ii of candidati.slice(0, 5)) {
      try {
        const ir = await fetch(ii.thumburl, { headers: { 'User-Agent': UA } })
        if (!ir.ok) continue
        const b = Buffer.from(await ir.arrayBuffer())
        if (b.length < 3000) continue // miniatura rotta/placeholder: passo alla prossima
        scelto = ii; buf = b; break
      } catch { /* prova la prossima */ }
    }
    if (!scelto) { res.status(404).json({ error: 'Nessuna immagine trovata' }); return }

    const mime = scelto.thumbmime || scelto.mime || 'image/jpeg'
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`

    const meta = scelto.extmetadata || {}
    const autore = stripTags(meta.Artist && meta.Artist.value) || 'autore sconosciuto'
    const licenza = stripTags(meta.LicenseShortName && meta.LicenseShortName.value)
    const attribution = `${autore}${licenza ? ' · ' + licenza : ''} · Wikimedia Commons`

    res.status(200).json({ dataUrl, attribution, sourceUrl: scelto.descriptionurl || '' })
  } catch (e) {
    res.status(500).json({ error: 'Recupero immagine fallito', dettaglio: String(e).slice(0, 200) })
  }
}
