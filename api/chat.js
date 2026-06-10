import { checkPin, readBody, VOCE } from './_lib.js'

export const config = { maxDuration: 60 }

const MODEL = process.env.ANTHROPIC_CHAT_MODEL || 'claude-sonnet-4-6'

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { scheda, focus, history, domanda } = readBody(req)
  if (!domanda || !domanda.trim()) { res.status(400).json({ error: 'Domanda mancante' }); return }

  let system = `Sei come un amico piu grande, bravo e gentile, che aiuta una ragazza di SECONDA LICEO SCIENTIFICO con un lieve DSA. Conosci la scheda di studio che sta guardando e rispondi alle sue domande su quell'argomento.

${VOCE}

- Spiega da zero quando serve, con esempi concreti e numeri piccoli.
- Per le formule usa LaTeX tra segni di dollaro singoli, es. $x^2+1$.
- Resta sull'argomento della scheda; se chiede cose fuori tema, riportala con gentilezza all'argomento.`

  if (scheda) {
    system += `\n\nEcco la scheda che sta guardando (JSON):\n${JSON.stringify({ argomento: scheda.argomento, materia: scheda.materia, studio: scheda.studio, schema: scheda.schema }).slice(0, 14000)}`
  }
  if (focus && String(focus).trim()) {
    system += `\n\nLa sua domanda riguarda IN PARTICOLARE questo punto della scheda: "${String(focus).slice(0, 1200)}". Concentrati su quello, salvo che ti chieda altro.`
  }

  const messages = []
  if (Array.isArray(history)) {
    for (const m of history.slice(-12)) {
      if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
        messages.push({ role: m.role, content: m.content })
      }
    }
  }
  messages.push({ role: 'user', content: domanda.trim() })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system, messages })
    })
    if (!r.ok) { const t = await r.text(); res.status(502).json({ error: 'Errore dal modello', dettaglio: t.slice(0, 300) }); return }
    const data = await r.json()
    const risposta = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    res.status(200).json({ risposta })
  } catch (e) {
    res.status(500).json({ error: 'Chat fallita', dettaglio: String(e).slice(0, 300) })
  }
}
