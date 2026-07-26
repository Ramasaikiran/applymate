function scorePassword(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

const LABELS = ['Weak', 'Fair', 'Good', 'Strong', 'Excellent']
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#22c55e']

export function passwordRequirementsMet(pw: string) {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)
}

export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const score = scorePassword(password)

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            height: 3, flex: 1, borderRadius: 99,
            background: i <= score ? COLORS[score] : '#f0f0f0',
            transition: 'background 0.3s ease',
          }} />
        ))}
      </div>
      <p style={{ marginTop: 7, fontSize: 12, color: '#b5b5b5' }}>
        {LABELS[score]} (8+ chars, uppercase letter, number)
      </p>
    </div>
  )
}
