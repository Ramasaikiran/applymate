import { TESTIMONIALS } from '../data/testimonials'

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')

// Pull the first sentence out as a headline quote; the rest stays as body text.
function splitQuote(quote: string) {
  const paras = quote.split('\n\n')
  const m = paras[0]!.match(/^(.+?[.!?])\s+([\s\S]*)$/)
  if (!m) return { lead: null as string | null, body: paras }
  return { lead: m[1]!, body: [m[2]!, ...paras.slice(1)].filter(Boolean) }
}

export default function Testimonials() {
  if (TESTIMONIALS.length === 0) return null
  const single = TESTIMONIALS.length === 1
  return (
    <section id="testimonials" aria-labelledby="testimonials-title"
      style={{ background: '#fafafa', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', padding: '80px 24px', marginBottom: 96 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: '#22c55e', textTransform: 'uppercase', textAlign: 'center', margin: '0 0 12px' }}>
          Member stories
        </p>
        <h2 id="testimonials-title" style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 'clamp(30px,5vw,42px)', fontWeight: 400,
          textAlign: 'center', letterSpacing: '-0.025em', color: '#0f0f0f', margin: '0 0 40px' }}>
          What members say about ApplyMate
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: single ? 'minmax(0,680px)' : 'repeat(auto-fit,minmax(300px,1fr))', gap: 20, justifyContent: 'center' }}>
          {TESTIMONIALS.map(t => {
            const { lead, body } = splitQuote(t.quote)
            return (
              <figure key={t.name + t.role} style={{ margin: 0, background: '#fff', border: '1px solid #ececec', borderRadius: 20,
                padding: 'clamp(24px,5vw,40px)', boxShadow: '0 8px 30px rgba(0,0,0,0.05)', position: 'relative' }}>
                <span aria-hidden="true" style={{ position: 'absolute', top: 14, left: 24, fontFamily: "'Instrument Serif',Georgia,serif",
                  fontSize: 80, lineHeight: 1, color: '#dcfce7' }}>“</span>
                <blockquote style={{ margin: '28px 0 24px', position: 'relative' }}>
                  {lead && (
                    <p style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 'clamp(22px,4vw,28px)', lineHeight: 1.3,
                      letterSpacing: '-0.01em', color: '#0f0f0f', margin: '0 0 18px' }}>{lead}</p>
                  )}
                  {body.map((para, i) => (
                    <p key={i} style={{ fontSize: 15, lineHeight: 1.7, color: '#4a4a4a', margin: '0 0 12px' }}>{para}</p>
                  ))}
                </blockquote>
                <figcaption style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20, borderTop: '1px solid #f0f0f0' }}>
                  {t.photo ? (
                    <img src={t.photo} alt={t.name} width={44} height={44} loading="lazy"
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: '50%', background: '#0f0f0f', color: '#fff',
                      fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {initials(t.name)}
                    </span>
                  )}
                  <span>
                    <strong style={{ display: 'block', fontSize: 15, color: '#0f0f0f' }}>{t.name}</strong>
                    <span style={{ fontSize: 13, color: '#6b6b6b' }}>{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            )
          })}
        </div>
      </div>
    </section>
  )
}
