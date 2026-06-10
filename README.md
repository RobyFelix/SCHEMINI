# SCHEMINI — Fase 1

Web-app per generare schede di studio (STUDIO + SCHEMA) da un argomento, con archivio su Supabase.
Stack: React + Vite (frontend) · Funzioni serverless Vercel (`/api`) · Supabase (database) · Claude (Anthropic).

## Cosa fa la Fase 1
- Inserisci un argomento → Claude genera due schede (STUDIO completa, SCHEMA compatta).
- Le schede si vedono a video e si stampano in **PDF A4 a colori** (pulsanti "Stampa STUDIO" / "Stampa SCHEMA"; la SCHEMA resta su una facciata).
- Le salvi in **Archivio** (Supabase) e le riapri/elimini.
- Accesso protetto da **PIN** (controllato lato server).

> Non inclusi in Fase 1 (previsti dopo): chatbot, voce, lettura ad alta voce, "AGGIORNA MATERIALE".

## 1) Database (Supabase)
Nel progetto Supabase → SQL Editor → esegui:
```sql
create table public.schemini (
  id uuid primary key default gen_random_uuid(),
  argomento text not null,
  slug text not null,
  materia text,
  contenuto jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.schemini enable row level security;
```
La RLS è attiva e senza policy: il database è raggiungibile solo dalle funzioni serverless (service role).

## 2) GitHub
Carica tutti questi file nel repository `schemini` (mantieni la struttura delle cartelle: `api/...`, `src/...`).

## 3) Vercel
1. Importa il repository su Vercel (Framework: **Vite**, rilevato in automatico).
2. Project Settings → **Environment Variables** → aggiungi (senza prefisso `VITE_`):
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`  →  `https://zvztuvipruatnfvfrrgd.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_PIN`  →  `0011`
   - (opzionale) `ANTHROPIC_MODEL` → default `claude-opus-4-8`
3. **Deploy**. Apri l'URL, inserisci il PIN, prova un argomento.

## Stampa A4 / colore / fronte-retro
- A4 e colori di sfondo sono forzati via CSS. Se i riquadri colorati uscissero bianchi, abilita "Grafica di sfondo" nella finestra di stampa.
- Il fronte/retro è la spunta "Fronte/retro" della finestra di stampa: il layout è già predisposto (interruzioni pulite, margini speculari).
