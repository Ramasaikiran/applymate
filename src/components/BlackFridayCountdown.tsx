// Boxed countdown (days / hours / mins / secs). Digits slide in on every
// change, so the seconds box visibly ticks. Reduced-motion users get no animation.
const CSS = `
@keyframes bfTick { 0% { transform: translateY(-70%); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
@keyframes bfPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(232,185,107,0.55) } 50% { box-shadow: 0 0 0 5px rgba(232,185,107,0) } }
.bf-digit { display: inline-block; animation: bfTick .4s ease-out }
.bf-secs { animation: bfPulse 1s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .bf-digit, .bf-secs { animation: none } }
`

export default function BlackFridayCountdown({ ms, size = 'sm' }: { ms: number; size?: 'sm' | 'lg' }) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const parts = [
    { label: 'Days', v: Math.floor(t / 86400) },
    { label: 'Hrs', v: Math.floor((t % 86400) / 3600) },
    { label: 'Mins', v: Math.floor((t % 3600) / 60) },
    { label: 'Secs', v: t % 60, live: true },
  ]
  const lg = size === 'lg'
  return (
    <span role="timer" aria-label="Time left in the sale"
      style={{ display: 'inline-flex', alignItems: 'center', gap: lg ? 10 : 6 }}>
      <style>{CSS}</style>
      {parts.map(p => (
        <span key={p.label} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: lg ? 4 : 2 }}>
          <span className={p.live ? 'bf-secs' : undefined} style={{
            minWidth: lg ? 56 : 30, padding: lg ? '10px 8px' : '3px 5px', borderRadius: lg ? 10 : 6,
            overflow: 'hidden', textAlign: 'center', lineHeight: 1,
            fontSize: lg ? 26 : 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            fontFamily: "'Inter',sans-serif",
            background: p.live ? '#e8b96b' : 'rgba(255,255,255,0.12)',
            color: p.live ? '#0f0f0f' : '#fff',
            border: p.live ? '1px solid #e8b96b' : '1px solid rgba(255,255,255,0.18)',
          }}>
            <span key={p.v} className="bf-digit">{String(p.v).padStart(2, '0')}</span>
          </span>
          <span style={{ fontSize: lg ? 11 : 9, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{p.label}</span>
        </span>
      ))}
    </span>
  )
}
