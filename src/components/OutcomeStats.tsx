import { useEffect, useRef, useState } from 'react'
import { SCREENING_CALLS, CALLBACKS_BY_EXPERIENCE, type Outcome } from '../data/outcomes'

// Same layout and colours as the "How it works" section.
function StatsBlock({ eyebrow, title, sub, items, highlight }: {
  eyebrow: string; title: string; sub: string; items: Outcome[]; highlight: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setInView(true); io.disconnect() } }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const n = items.length
  const edge = 100 / (2 * n)
  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 96px' }}>
      <p className="eyebrow-label" style={{ textAlign: 'center', marginBottom: 12 }}>{eyebrow}</p>
      <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 40, fontWeight: 400, textAlign: 'center',
        letterSpacing: '-0.025em', color: '#0f0f0f', marginBottom: 16 }}>{title}</h2>
      <p style={{ fontSize: 16, color: '#6b6b6b', textAlign: 'center', maxWidth: 500, margin: '0 auto 56px' }}>{sub}</p>

      <div ref={ref} style={{ position: 'relative' }}>
        <div className="steps-progress-track" style={{ position: 'absolute', top: 0, left: `${edge}%`, right: `${edge}%`, height: 2, background: '#e5e5e5', zIndex: 1 }} />
        <div className="steps-progress-fill" style={{ position: 'absolute', top: 0, left: `${edge}%`, height: 2, background: '#22c55e', zIndex: 2,
          width: inView ? `${100 - 2 * edge}%` : '0%', transition: 'width 1.1s cubic-bezier(0.65,0,0.35,1)' }} />
        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${n},1fr)`, gap: 2, background: '#f0f0f0', borderRadius: 16, overflow: 'hidden' }}>
          {items.map((it, i) => {
            const dark = i === highlight
            return (
              <div key={it.label} className="steps-card" style={{
                background: dark ? '#0f0f0f' : '#fff', padding: '36px 30px',
                opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(14px)',
                transition: `opacity 0.5s ease ${i * 0.15}s, transform 0.5s ease ${i * 0.15}s`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.4)' : '#b5b5b5', letterSpacing: '0.08em' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                    background: dark ? 'rgba(255,255,255,0.1)' : '#f5f5f5', color: dark ? 'rgba(255,255,255,0.6)' : '#9b9b9b' }}>{it.label}</span>
                </div>
                <p className="step-title" style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 44, lineHeight: 1.1,
                  color: dark ? '#fff' : '#0f0f0f', marginBottom: 10 }}>{it.pct}%</p>
                <p className="step-desc" style={{ fontSize: 14, color: dark ? 'rgba(255,255,255,0.55)' : '#9b9b9b', lineHeight: 1.65 }}>{it.note}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default function OutcomeStats() {
  return (
    <>
      <StatsBlock eyebrow="SCREENING CALLS" title="When can I get a screening call?"
        sub="The longer you stay, the better the odds." items={SCREENING_CALLS} highlight={1} />
      <StatsBlock eyebrow="CALLBACKS BY EXPERIENCE" title="Callbacks by experience"
        sub="How callbacks look at each experience level." items={CALLBACKS_BY_EXPERIENCE} highlight={2} />
      <p style={{ fontSize: 12, color: '#9b9b9b', textAlign: 'center', margin: '-56px auto 80px', padding: '0 24px', maxWidth: 560 }}>
        Results vary and are not a guarantee of interviews or offers.
      </p>
    </>
  )
}
