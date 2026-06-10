const PIN_KEY = 'schemini_pin'

export function getPin() { try { return sessionStorage.getItem(PIN_KEY) || '' } catch { return '' } }
export function setPin(v) { try { sessionStorage.setItem(PIN_KEY, v) } catch {} }
export function clearPin() { try { sessionStorage.removeItem(PIN_KEY) } catch {} }

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', 'x-app-pin': getPin() },
    body: body ? JSON.stringify(body) : undefined
  })
  if (res.status === 401) { const e = new Error('PIN'); e.code = 401; throw e }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Errore')
  return data
}
