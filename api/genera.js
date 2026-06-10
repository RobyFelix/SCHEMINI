import { checkPin, slugify, readBody } from './_lib.js'

export const config = { maxDuration: 60 } // Vercel: fino a 60s (Hobby) per la generazione

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

const SYSTEM = `Sei un assistente che prepara schede di studio per una studentessa di SECONDA LICEO SCIENTIFICO (scienze applicate), con un lieve DSA (difficolta con la memoria di lavoro e con la decodifica di parole nuove). Le sue materie principali sono MATEMATICA e FISICA.

Devi produrre DUE schede sullo stesso argomento:
- "studio": scheda completa per CAPIRE e memorizzare (sta in circa 2 pagine A4).
- "schema": versione COMPATTA per ripasso veloce e da consultare in verifica (1 pagina, solo l'essenziale).

REGOLE DI STILE (importanti per il suo DSA):
- Italiano, frasi BREVI, una idea per riga. Poco testo, niente "rumore".
- Spezza i contenuti in piccoli gruppi (max 3-4 elementi).
- Ogni termine tecnico difficile va nel glossario, con la sillabazione (es. "Di·scri·mi·nan·te").
- Inizia sempre con il blocco "essenziali" (le 2-3 cose che contano davvero).
- Per matematica/fisica: usa SEMPRE almeno una formula e un esempio svolto passo-passo; usa un grafico quando aiuta.
- Inserisci 1-2 callout "errore" con gli sbagli tipici.

FORMATO: rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, senza backtick.
Schema:
{
 "argomento": "string",
 "materia": "Matematica" | "Fisica" | "Storia" | ...,
 "studio": [ ...blocchi... ],
 "schema": [ ...blocchi... ]
}

Tipi di blocco disponibili (usa solo questi):
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
- In "funzione" usa una espressione in stile JavaScript/mathjs (es. "x^2-5*x+6", "sin(x)", "2*x+1").
- La scheda "schema" deve essere molto piu sintetica della "studio": stessi concetti, ridotti all'osso.`

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { argomento } = readBody(req)
  if (!argomento || !argomento.trim()) { res.status(400).json({ error: 'Argomento mancante' }); return }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Argomento: ${argomento.trim()}` }]
      })
    })

    if (!r.ok) {
      const t = await r.text()
      res.status(502).json({ error: 'Errore dal modello', dettaglio: t.slice(0, 500) })
      return
    }

    const data = await r.json()
    let text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    text = text.replace(/^```(json)?/i, '').replace(/```$/i, '').trim()

    let parsed
    try { parsed = JSON.parse(text) }
    catch {
      const a = text.indexOf('{'), b = text.lastIndexOf('}')
      parsed = JSON.parse(text.slice(a, b + 1))
    }

    parsed.argomento = parsed.argomento || argomento.trim()
    parsed.slug = slugify(parsed.argomento)
    res.status(200).json(parsed)
  } catch (e) {
    res.status(500).json({ error: 'Generazione fallita', dettaglio: String(e).slice(0, 300) })
  }
}
