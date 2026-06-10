import { checkPin, admin, readBody } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { id } = readBody(req)
  if (!id) { res.status(400).json({ error: 'id mancante' }); return }
  try {
    const { error } = await admin().from('schemini').delete().eq('id', id)
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e).slice(0, 300) })
  }
}
