import { checkPin, readBody, callClaude, BLOCK_TYPES, VOCE } from './_lib.js'

export const config = { maxDuration: 60 }

function sys(quale) {
  const tipo = quale === 'studio'
    ? 'una LEZIONE DA ZERO e progressiva: DEVE restare tale (NON trasformarla in un riassunto), va solo resa ancora più facile, con passi più piccoli e parole più comuni.'
    : 'un RIEPILOGO COMPATTO: tienilo corto e sintetico, va solo reso più chiaro e con parole più facili.'
  return `Ricevi i blocchi (in JSON) di UNA SOLA scheda di studio, per una ragazza di SECONDA LICEO SCIENTIFICO con un lieve DSA. Materie principali: MATEMATICA e FISICA.

${VOCE}

Questa scheda è ${tipo}

Il tuo compito: riscriverla PIÙ SEMPLICE di com'è adesso, senza perdere i concetti importanti né la correttezza.
- PAROLE DI TUTTI I GIORNI: preferisci parole brevi e comuni; sostituisci i termini tecnici o difficili con parole semplici. Se un termine tecnico DEVE restare, spiegalo lì accanto la prima volta (es. "la circonferenza, cioè il bordo del cerchio").
- Frasi ancora più corte, una sola idea per riga, senza incisi e senza catene di parole complicate (es. "il prodotto dei due segmenti" → "moltiplichi i due pezzi").
- Tono concreto e diretto, niente formulazioni astratte.
- Esempi più semplici, con numeri piccoli.
- Mantieni le formule corrette, ma quando puoi spiegale anche a parole.
- Conserva la stessa struttura a blocchi e gli stessi tipi.
- Se trovi blocchi di tipo "immagine", riportali IDENTICI dove sono, senza modificarli.
- Glossario: parole INTERE, mai spezzate in sillabe.
- Lavora SOLO su questi blocchi: non inventare un'altra scheda.

FORMATO: rispondi SOLO con questo oggetto JSON, senza testo prima o dopo, senza backtick.
{"blocchi":[...blocchi...]}

${BLOCK_TYPES}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { argomento, materia, quale, blocchi } = readBody(req)
  const q = quale === 'schema' ? 'schema' : 'studio'
  if (!Array.isArray(blocchi) || blocchi.length === 0) { res.status(400).json({ error: 'Blocchi mancanti' }); return }

  try {
    const user = `Argomento: ${argomento || ''} (materia: ${materia || '—'})\nBlocchi attuali di questa scheda da semplificare (JSON):\n${JSON.stringify(blocchi)}`
    const parsed = await callClaude(sys(q), user)
    const out = Array.isArray(parsed) ? parsed : (parsed.blocchi || parsed.studio || parsed.schema)
    if (!Array.isArray(out)) { res.status(500).json({ error: 'Risposta non valida' }); return }
    res.status(200).json({ blocchi: out })
  } catch (e) {
    res.status(500).json({ error: 'Semplificazione fallita', dettaglio: String(e).slice(0, 300) })
  }
}
