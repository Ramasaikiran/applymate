import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// One-time, dismissible prompt for PAID candidates who have not opted in.
// Visibility stays OFF until the candidate says yes (consent, DPDP).
export default function RecruiterVisibilityPrompt() {
  const { profile, subscription, refreshProfile } = useAuth()
  const key = profile ? `oc_rv_prompt_${profile.id}` : ''
  const [hidden, setHidden] = useState(() => {
    try { return !!key && localStorage.getItem(key) === '1' } catch { return false }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paid = !!subscription && subscription.plan !== 'free'
  if (!profile || !paid || !profile.user_type || profile.recruiter_visible || hidden) return null

  function dismiss() {
    try { localStorage.setItem(key, '1') } catch { /* ignore */ }
    setHidden(true)
  }

  async function enable() {
    setBusy(true); setError(null)
    const { error: err } = await supabase.from('profiles').update({ recruiter_visible: true }).eq('id', profile!.id)
    if (err) { setBusy(false); setError('Could not save. Please try again.'); return }
    await refreshProfile()
    setBusy(false)
  }

  return (
    <div style={{ marginBottom: 20, padding: '16px 18px', background: '#fff', border: '1px solid #e8e8e8',
      borderRadius: 12, fontFamily: "'Inter',sans-serif" }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f', margin: '0 0 4px' }}>Let verified recruiters find you</p>
      <p style={{ fontSize: 12.5, color: '#6b6b6b', lineHeight: 1.6, margin: '0 0 12px' }}>
        As a paid member you can be discovered by admin-verified recruiters. They can see your profile, email and phone.
        You get a notification with their name and company every time. You can turn this off any time in My Profile.
      </p>
      {error && <p style={{ fontSize: 12.5, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={enable} disabled={busy} style={{ background: '#0f0f0f', color: '#fff', border: 'none',
          padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1, fontFamily: "'Inter',sans-serif" }}>{busy ? 'Saving…' : 'Turn on'}</button>
        <button onClick={dismiss} style={{ background: '#fff', color: '#6b6b6b', border: '1.5px solid #e5e5e5',
          padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: "'Inter',sans-serif" }}>Not now</button>
      </div>
    </div>
  )
}
