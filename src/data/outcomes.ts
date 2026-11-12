// Outcome figures shown on the landing page. Update here; no database needed.
export interface Outcome { label: string; pct: number; note: string }

export const SCREENING_CALLS: Outcome[] = [
  { label: '1 month',  pct: 50, note: 'of 1 month users got a screening call' },
  { label: '2 months', pct: 68, note: 'of 2 months users got a screening call' },
  { label: '3 months', pct: 80, note: 'of 3 months users got a screening call' },
]

export const CALLBACKS_BY_EXPERIENCE: Outcome[] = [
  { label: 'Freshers (0 yrs)', pct: 40, note: 'got a callback' },
  { label: '0–2 years',        pct: 50, note: 'got a callback' },
  { label: '5–9 years',        pct: 60, note: 'got a callback' },
  { label: '20–22 years',      pct: 15, note: 'got a callback' },
]
