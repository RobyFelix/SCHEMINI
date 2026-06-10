import { checkPin, admin } from './_lib.js'

export default async function handler(req, res) {
  if (!checkPin(req, res)) return
  try {
    const { data, error } = await admin()
      .from('schemini')
      .select('id, argomento, materia, created_at')
      .order('created_at', { ascending: false })

    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json(data || [])
  } catch (e) {
    res.status(500).json({ error: String(e).slice(0, 300) })
  }
}
