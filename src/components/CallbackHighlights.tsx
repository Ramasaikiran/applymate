// Static callback figures shown on the landing page.
// Edit the numbers below, nothing else needs to change.
const SCREENING = [
  { label: '1 month users', pct: 50 },
  { label: '2 months users', pct: 68 },
  { label: '3 months users', pct: 80 },
]

const BY_EXPERIENCE = [
  { bucket: 'Freshers (0 yrs)', pct: 40 },
  { bucket: '0-2 years', pct: 50 },
  { bucket: '5-9 years', pct: 60 },
  { bucket: '20-22 years', pct: 40 },
]

const serif = "'Instrument Serif',Georgia,serif"

export default function CallbackHighlights() {
  return (
    <section id="callback-stats" aria-labelledby="callback-title"
      style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 96px' }}>
      <h2 id="callback-title" style={{ fontFamily: serif, fontSize: 'clamp(30px,6vw,40px)', fontWeight: 400,
        textAlign: 'center', letterSpacing: '-0.025em', color: '#0f0f0f', margin: '0 0 12px' }}>
        When can I get a screening call?
      </h2>
      <p style={{ fontSize: 16, color: '#6b6b6b', textAlign: 'center', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.6 }}>
        Share of users who got a screening call, by how long they stayed on a plan.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 64 }}>
        {SCREENING.map(s => (
          <div key={s.label} style={{ border: '1px solid #e5e5e5', borderRadius: 16, padding: '22px 10px',
            textAlign: 'center', background: '#fff' }}>
            <p style={{ fontFamily: serif, fontSize: 'clamp(32px,9vw,48px)', color: '#0f0f0f', margin: '0 0 4px',
              letterSpacing: '-0.02em', lineHeight: 1.1 }}>{s.pct}%</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0f0f0f', margin: '0 0 2px' }}>{s.label}</p>
            <p style={{ fontSize: 12, color: '#9b9b9b', margin: 0 }}>got a screening call</p>
          </div>
        ))}
      </div>

      <h2 style={{ fontFamily: serif, fontSize: 'clamp(30px,6vw,40px)', fontWeight: 400, textAlign: 'center',
        letterSpacing: '-0.025em', color: '#0f0f0f', margin: '0 0 12px' }}>
        Callbacks by experience
      </h2>
      <p style={{ fontSize: 16, color: '#6b6b6b', textAlign: 'center', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.6 }}>
        Callback rate for each experience group.
      </p>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {BY_EXPERIENCE.map(e => (
          <div key={e.bucket} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
              <strong style={{ color: '#0f0f0f' }}>{e.bucket}</strong>
              <span style={{ color: '#4a4a4a', fontWeight: 600 }}>{e.pct}%</span>
            </div>
            <div role="img" aria-label={`${e.bucket}: ${e.pct} percent`}
              style={{ height: 10, background: '#f0f0f0', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${e.pct}%`, height: '100%', background: '#22c55e', borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: '#9b9b9b', textAlign: 'center', margin: '28px auto 0', maxWidth: 600, lineHeight: 1.6 }}>
        Results vary and are not a guarantee of interviews or offers.
      </p>
    </section>
  )
}
