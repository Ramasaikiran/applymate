import { TESTIMONIALS } from '../data/testimonials'

export default function Testimonials() {
  if (TESTIMONIALS.length === 0) return null
  return (
    <section id="testimonials" aria-labelledby="testimonials-title"
      style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 96px' }}>
      <h2 id="testimonials-title" style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 40, fontWeight: 400,
        textAlign: 'center', letterSpacing: '-0.025em', color: '#0f0f0f', marginBottom: 12 }}>
        What members say
      </h2>
      <p style={{ fontSize: 16, color: '#6b6b6b', textAlign: 'center', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.6 }}>
        In their own words, shared with their permission.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        {TESTIMONIALS.map(t => (
          <figure key={t.name + t.role} style={{ margin: 0, border: '1px solid #e5e5e5', borderRadius: 16, padding: 24, background: '#fff' }}>
            <blockquote style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: '#3b3b3b' }}>
              “{t.quote}”
            </blockquote>
            <figcaption style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {t.photo && <img src={t.photo} alt={t.name} width={40} height={40} loading="lazy"
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />}
              <span>
                <strong style={{ display: 'block', fontSize: 14, color: '#0f0f0f' }}>{t.name}</strong>
                <span style={{ fontSize: 13, color: '#6b6b6b' }}>{t.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
