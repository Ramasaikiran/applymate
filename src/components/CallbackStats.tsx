import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// A figure is shown only when its group is big enough to mean something.
const MIN_SAMPLE = 10

interface Row { eligible: number; got_call: number }
interface Stats {
  windows: (Row & { days: number })[]
  experience: (Row & { bucket: string })[]
}

const pct = (r: Row) => Math.round((r.got_call / r.eligible) * 100)
const WINDOW_LABEL: Record<number, string> = { 30: 'Within 1 month', 60: 'Within 2 months', 90: 'Within 3 months' }

export default function CallbackStats() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let alive = true
    supabase.rpc('get_callback_stats').then(({ data, error }) => {
      if (alive && !error && data) setStats(data as Stats)
    })
    return () => { alive = false }
  }, [])

  if (!stats) return null
  const windows = stats.windows.filter(w => w.eligible >= MIN_SAMPLE)
  const experience = stats.experience.filter(e => e.eligible >= MIN_SAMPLE)
  if (windows.length === 0 && experience.length === 0) return null

  return (
    <section id="callback-stats" aria-labelledby="callback-title"
      style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 96px' }}>
      {windows.length > 0 && (
        <>
          <h2 id="callback-title" style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 40, fontWeight: 400,
            textAlign: 'center', letterSpacing: '-0.025em', color: '#0f0f0f', marginBottom: 12 }}>
            When can you expect a screening call?
          </h2>
          <p style={{ fontSize: 16, color: '#6b6b6b', textAlign: 'center', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Share of Pro and Max Pro subscribers who got an interview or HR-round call.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${windows.length},1fr)`, gap: 16, marginBottom: 56 }}>
            {windows.map(w => (
              <div key={w.days} style={{ border: '1px solid #e5e5e5', borderRadius: 16, padding: '24px 16px', textAlign: 'center', background: '#fff' }}>
                <p style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 44, color: '#0f0f0f', margin: '0 0 4px', letterSpacing: '-0.02em' }}>{pct(w)}%</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0f0f0f', margin: '0 0 4px' }}>{WINDOW_LABEL[w.days]}</p>
                <p style={{ fontSize: 12, color: '#9b9b9b', margin: 0 }}>{w.got_call} of {w.eligible} subscribers</p>
              </div>
            ))}
          </div>
        </>
      )}

      {experience.length > 0 && (
        <>
          <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 40, fontWeight: 400,
            textAlign: 'center', letterSpacing: '-0.025em', color: '#0f0f0f', marginBottom: 12 }}>
            Callbacks by experience
          </h2>
          <p style={{ fontSize: 16, color: '#6b6b6b', textAlign: 'center', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Share of subscribers in each experience group who got at least one interview call.
          </p>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            {experience.map(e => (
              <div key={e.bucket} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <strong style={{ color: '#0f0f0f' }}>{e.bucket}</strong>
                  <span style={{ color: '#4a4a4a' }}>{pct(e)}% <span style={{ color: '#9b9b9b', fontSize: 12 }}>({e.got_call} of {e.eligible})</span></span>
                </div>
                <div role="img" aria-label={`${e.bucket}: ${pct(e)} percent`} style={{ height: 10, background: '#f0f0f0', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${pct(e)}%`, height: '100%', background: '#22c55e', borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ fontSize: 12, color: '#9b9b9b', textAlign: 'center', margin: '28px auto 0', maxWidth: 600, lineHeight: 1.6 }}>
        Based on ApplyMate's own tracked applications. A call means an application reached the interview or HR round, or later.
        Results vary and are not a guarantee of interviews or offers.
      </p>
    </section>
  )
}
