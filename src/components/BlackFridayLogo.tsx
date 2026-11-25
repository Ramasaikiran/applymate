// "BLACK [FRIDAY] SALE" wordmark. Dark-theme friendly: white serif text,
// with FRIDAY on a slightly tilted white pill. Uses Instrument Serif,
// already loaded site-wide.
export default function BlackFridayLogo({ size = 14 }: { size?: number }) {
  const text: React.CSSProperties = {
    fontFamily: "'Instrument Serif',Georgia,serif",
    fontSize: size, fontWeight: 400, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: '#fff', lineHeight: 1,
  }
  return (
    <span role="img" aria-label="Black Friday Sale"
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.45, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
      <span style={text}>Black</span>
      <span style={{
        ...text, color: '#0f0f0f', background: '#fff', borderRadius: size * 0.4,
        padding: `${size * 0.28}px ${size * 0.7}px`, transform: 'rotate(-3deg)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.25)',
      }}>Friday</span>
      <span style={text}>Sale</span>
    </span>
  )
}
