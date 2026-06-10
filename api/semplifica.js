import { checkPin, slugify, readBody, callClaude, BLOCK_TYPES } from './_lib.js'

export const config = { maxDuration: 60 }

const SYSTEM = `Ricevi due schede di studio gia pronte (in JSON) per una studentessa di SECONDA LICEO SCIENTIFICO con un lieve DSA. Le sue materie principali sono MATEMATICA e FISICA.

Il tuo compito: RISCRIVERLE PIU SEMPLICI di come sono adesso, senza perdere i concetti importanti ne la correttezza.

Come semplificare:
- La scheda "studio" deve restare una LEZIONE DA ZERO e progressiva (NON trasformarla in un riassunto): rendila solo ancora piu facile, con passi ancora piu piccoli e parole ancora piu comuni.
- Frasi ancora piu corte, una sola idea per riga.
- Parole piu comuni e concrete; evita i termini difficili (se proprio servono, spiegali nel glossario con la sillabazione).
- Meno testo: togli i dettagli non essenziali, tieni solo il cuore.
- Esempi piu semplici, con numeri piccoli.
- Mantieni le formule corrette, ma quando puoi spiegale anche a parole.
- Conserva la stessa struttura a blocchi e lo stesso formato JSON.

FORMATO: rispondi SOLO con l'oggetto JSON, senza testo prima o dopo, senza backtick.
Schema:
{"argomento":"string","materia":"...","studio":[...blocchi...],"schema":[...blocchi...]}

${BLOCK_TYPES}`

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { argomento, materia, studio, schema } = readBody(req)
  if (!argomento || !studio || !schema) { res.status(400).json({ error: 'Dati incompleti' }); return }

  try {
    const user = `Ecco le schede attuali da semplificare ulteriormente (JSON):\n${JSON.stringify({ argomento, materia, studio, schema })}`
    const parsed = await callClaude(SYSTEM, user)
    parsed.argomento = parsed.argomento || argomento
    parsed.materia = parsed.materia || materia
    parsed.slug = slugify(parsed.argomento)
    res.status(200).json(parsed)
  } catch (e) {
    res.status(500).json({ error: 'Semplificazione fallita', dettaglio: String(e).slice(0, 300) })
  }
}
