import { checkPin, admin, slugify, readBody } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { argomento, materia, studio, schema } = readBody(req)
  if (!argomento || !studio || !schema) { res.status(400).json({ error: 'Dati incompleti' }); return }

  try {
    const { data, error } = await admin()
      .from('schemini')
      .insert({
        argomento,
        slug: slugify(argomento),
        materia: materia || null,
        contenuto: { materia: materia || null, studio, schema }
      })
      .select('id, argomento, materia, created_at')
      .single()

    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: String(e).slice(0, 300) })
  }
}
