import { checkPin, readBody, callClaude } from './_lib.js'

export const config = { maxDuration: 90 }

const N = 7

const SYS = `Sei un insegnante gentile che prepara un piccolo TEST (${N} domande) per una ragazza di liceo con un lieve DSA, sull'argomento della scheda che le ha fatto studiare. Le domande devono essere coerenti con quello che la scheda insegna.

REGOLA FONDAMENTALE, non violarla MAI: la difficoltà deve stare SOLO nel rispondere correttamente, MAI nel capire la domanda. Quindi:
- prosa sempre semplice, chiara e diretta; frasi brevi; una sola cosa chiesta per domanda;
- niente trabocchetti, niente doppie negazioni, niente domande ambigue o capziose;
- ogni termine tecnico usato nella domanda deve essere già spiegato nella scheda.

Livelli di difficoltà (cambia QUANTO si deve ragionare, non quanto è difficile leggere):
- semplice: ricordare un fatto o una definizione presente nella scheda.
- media: applicare una regola, fare un piccolo calcolo, spiegare con parole proprie.
- difficile: collegare due o più concetti, scegliere il caso giusto, ragionare in più passaggi — ma la domanda resta sempre limpida.

Tipi di domanda: usa un MIX — scelta multipla (3-4 alternative plausibili, una sola corretta), vero/falso, e 1-2 domande aperte brevi.

Illustrazioni: AL MASSIMO 2-3 domande possono avere un campo "visual", e SOLO quando un'immagine aiuta a CAPIRE la domanda (es. una figura geometrica, una mappa), MAI quando svelerebbe la risposta. Una cartina/mappa va sempre cercata con immagine_web (query in INGLESE con "map"), mai disegnata; "diagramma" disegnato solo per schemi astratti (geometria, fisica, processi).

Per le formule usa LaTeX tra dollari singoli, es. $a^2+b^2$.

Rispondi SOLO con JSON valido, senza testo intorno, in questo formato:
{ "domande": [
  { "tipo": "multipla|aperta|vero_falso",
    "testo": "...",
    "opzioni": ["...","...","..."],
    "risposta": "...",
    "perche": "...",
    "visual": null }
] }
- "opzioni": includilo SOLO per le domande a scelta multipla.
- "risposta": per la multipla scrivi il TESTO esatto dell'opzione corretta; per vero/falso scrivi "Vero" oppure "Falso"; per l'aperta la risposta attesa, breve.
- "perche": una frase che spiega perché quella è la risposta giusta.
- "visual": null tranne nelle (massimo) 2-3 domande illustrate, dove vale {"tipo":"diagramma","descrizione":"...","didascalia":"..."} oppure {"tipo":"immagine_web","query":"...","categoria":"cartina|monumento|foto|opera","didascalia":"..."}.`

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Metodo non consentito' }); return }
  if (!checkPin(req, res)) return

  const { scheda, difficolta } = readBody(req)
  if (!scheda || !scheda.argomento) { res.status(400).json({ error: 'Scheda mancante' }); return }
  const diff = ['semplice', 'media', 'difficile'].includes(difficolta) ? difficolta : 'media'

  const user = `Argomento: ${scheda.argomento}${scheda.materia ? ` (Materia: ${scheda.materia})` : ''}.
Difficoltà richiesta: ${diff}.

Ecco la scheda di studio (JSON). Genera il test su QUESTI contenuti:
${JSON.stringify(scheda.studio || []).slice(0, 14000)}`

  try {
    const out = await callClaude(SYS, user)
    const domande = Array.isArray(out && out.domande) ? out.domande : []
    if (!domande.length) { res.status(502).json({ error: 'Nessuna domanda generata' }); return }
    res.status(200).json({ argomento: scheda.argomento, materia: scheda.materia || '', difficolta: diff, domande })
  } catch (e) {
    res.status(500).json({ error: 'Generazione test fallita', dettaglio: String(e).slice(0, 300) })
  }
}
