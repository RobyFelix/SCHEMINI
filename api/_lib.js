import { createClient } from '@supabase/supabase-js'

export function checkPin(req, res) {
  const pin = req.headers['x-app-pin']
  if (!pin || pin !== process.env.APP_PIN) {
    res.status(401).json({ error: 'PIN non valido' })
    return false
  }
  return true
}

export function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })
}

export function slugify(s) {
  return (s || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'scheda'
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  try { return JSON.parse(req.body || '{}') } catch { return {} }
}

// Descrizione dei tipi di blocco, condivisa da genera e semplifica.
export const BLOCK_TYPES = `Tipi di blocco disponibili (usa solo questi):
{"tipo":"essenziali","punti":["...","...","..."]}
{"tipo":"sezione","numero":1,"titolo":"..."}
{"tipo":"testo","testo":"... puoi mettere math inline tra segni di dollaro: $x^2$ ..."}
{"tipo":"elenco","voci":["...","..."]}
{"tipo":"formula","titolo":"...","latex":"x=\\\\frac{-b\\\\pm\\\\sqrt{\\\\Delta}}{2a}","legenda":"..."}
{"tipo":"esempio","titolo":"Risolvi ...","passi":["...","..."],"verifica":"..."}
{"tipo":"casi","voci":[{"condizione":"$\\\\Delta>0$","esito":"due soluzioni","nota":"..."}]}
{"tipo":"callout","stile":"errore","titolo":"...","testo":"..."}
{"tipo":"callout","stile":"collegamento","titolo":"...","testo":"..."}
{"tipo":"grafico","funzione":"x^2-5*x+6","dominio":[-1,5],"punti":[[2,0,"2"],[3,0,"3"]],"xlabel":"x","ylabel":"y","didascalia":"..."}
{"tipo":"timeline","eventi":[{"data":"...","label":"..."}]}
{"tipo":"tabella","intestazioni":["...","..."],"righe":[["...","..."],["...","..."]]}
{"tipo":"glossario","voci":[{"parola":"Discriminante","sillabe":"Di·scri·mi·nan·te","definizione":"..."}]}

Note tecniche:
- Nei campi "latex" usa sintassi LaTeX: \\\\frac, \\\\sqrt, \\\\pm, ^{}, _{}, \\\\Delta, ecc.
- In "funzione" usa una espressione in stile JavaScript/mathjs (es. "x^2-5*x+6", "sin(x)", "2*x+1").`

// Chiama il modello Anthropic e restituisce il JSON parsato.
export async function callClaude(system, user) {
  const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 10000,
      system,
      messages: [{ role: 'user', content: user }]
    })
  })
  if (!r.ok) { const t = await r.text(); throw new Error(t.slice(0, 400)) }
  const data = await r.json()
  let text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
  text = text.replace(/^```(json)?/i, '').replace(/```$/i, '').trim()
  try { return JSON.parse(text) }
  catch { const a = text.indexOf('{'), b = text.lastIndexOf('}'); return JSON.parse(text.slice(a, b + 1)) }
}
