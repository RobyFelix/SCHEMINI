import { checkPin, admin, readBody } from './_lib.js'

export default async function handler(req, res) {
  if (!checkPin(req, res)) return
  const id = req.query?.id || readBody(req).id
  if (!id) { res.status(400).json({ error: 'id mancante' }); return }
  try {
    const { data, error } = await admin()
      .from('schemini')
      .select('id, argomento, materia, contenuto, created_at')
      .eq('id', id)
      .single()

    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: String(e).slice(0, 300) })
  }
}
