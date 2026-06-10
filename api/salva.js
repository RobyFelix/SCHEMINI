import { checkPin, admin, slugify, readBody } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { argomento, materia, studio, schema } = readBody(req)
  if (!argomento || !studio || !schema) { res.status(400).json({ error: 'Dati incompleti' }); return }

  const slug = slugify(argomento)
  const contenuto = { materia: materia || null, studio, schema }
  const db = admin()

  try {
    // Una sola voce per argomento: se lo slug esiste gia, aggiorna; altrimenti inserisci.
    const { data: esistente } = await db.from('schemini').select('id').eq('slug', slug).limit(1).maybeSingle()

    if (esistente) {
      const { data, error } = await db.from('schemini')
        .update({ argomento, materia: materia || null, contenuto })
        .eq('id', esistente.id)
        .select('id, argomento, materia, created_at')
        .single()
      if (error) { res.status(500).json({ error: error.message }); return }
      res.status(200).json({ ...data, aggiornata: true })
    } else {
      const { data, error } = await db.from('schemini')
        .insert({ argomento, slug, materia: materia || null, contenuto })
        .select('id, argomento, materia, created_at')
        .single()
      if (error) { res.status(500).json({ error: error.message }); return }
      res.status(200).json({ ...data, aggiornata: false })
    }
  } catch (e) {
    res.status(500).json({ error: String(e).slice(0, 300) })
  }
}
