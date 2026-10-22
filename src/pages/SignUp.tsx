import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import GoogleIcon from '../components/GoogleIcon'
import PasswordStrength, { passwordRequirementsMet } from '../components/PasswordStrength'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useRateLimit } from '../hooks/useRateLimit'
import { COUNTRIES, getCountry } from '../lib/pricing'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function TrustStrip() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 }}>
      {['Cancel anytime', 'Secure payment'].map((t, i) => (
        <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#b5b5b5' }}>
          
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {t}
        </span>
      ))}
    </div>
  )
}

function ShowHideToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="oc-eye-btn" aria-label="Toggle password visibility">
      {show
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  )
}

export default function SignUp() {
  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]           = useState<'email' | 'details'>('email')
  const [email, setEmail]         = useState('')
  const { blocked, blockMessage, recordAttempt } = useRateLimit(
    email.trim() ? `oc_su_rl:${email.trim().toLowerCase()}` : 'oc_su_rl:pending'
  )
  const [fullName, setFullName]   = useState('')
  const [country, setCountry]     = useState('')
  const [referralSource, setReferralSource] = useState('')
  const [password, setPassword]   = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(false)
  const [gLoading, setGLoading]   = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
 const [blockedUntil, setBlockedUntil] = useState<number | null>(null)
 const [nowTick, setNowTick] = useState(Date.now())
 const [agreed, setAgreed] = useState(false)
 const [agreedErr, setAgreedErr] = useState(false)

 useEffect(() => {
 if (!blockedUntil) return
 const id = setInterval(() => {
 const t = Date.now()
 setNowTick(t)
 if (t >= blockedUntil) setBlockedUntil(null)
 }, 1000)
 return () => clearInterval(id)
 }, [blockedUntil])

 const secsLeft = blockedUntil ? Math.max(0, Math.ceil((blockedUntil - nowTick) / 1000)) : 0
 function humanSecs(s: number) {
 return s >= 3600 ? `${Math.ceil(s / 3600)}h` : s >= 60 ? `${Math.ceil(s / 60)}m` : `${s}s`
 }

  function validateEmail() {
    if (!EMAIL_RE.test(email.trim())) { setErrors({ email: 'Enter a valid email address.' }); return false }
    setErrors({}); return true
  }

  function validateDetails() {
    const next: Record<string, string> = {}
    if (!fullName.trim() || fullName.trim().length < 2) next.fullName = 'Enter your full name.'
    if (!passwordRequirementsMet(password)) next.password = '8+ chars, uppercase, number.'
    if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleEmailStep(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!fullName.trim() || fullName.trim().length < 2) next.fullName = 'Enter your full name.'
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!getCountry(country)) next.country = 'Select your country.'
    if (Object.keys(next).length > 0) { setErrors(next); return }
    setStep('details')
    setTimeout(() => document.getElementById('password-input')?.focus(), 100)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validateDetails()) return
    if (!agreed) { setAgreedErr(true); return }
    if (blocked || secsLeft > 0) return
    setLoading(true)

    // Server-side IP check, blocks bots/DDoS even if localStorage cleared
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-signup-rate-limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
      })
      // The function answers 429 (not 200) when the IP is over the limit, so a
      // `res.ok` guard here would skip exactly the case we need to handle.
      if (res.ok || res.status === 429) {
        const data = await res.json().catch(() => null)
        if (data && data.allowed === false) {
          const secs = Math.max(data.retry_after_seconds ?? 0, 1)
          setBlockedUntil(Date.now() + secs * 1000)
          setLoading(false)
          return
        }
      }
      // Other non-2xx (e.g. misconfigured function) -> fail open, don't block real users
    } catch { /* fail-open if edge function unreachable */ }

    const { error } = await signUp(fullName.trim(), email.trim().toLowerCase(), password, undefined, country, referralSource)
    setLoading(false)
    if (error) { setFormError(error); return }
    recordAttempt()
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-signup-attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
    }).catch(() => { /* best-effort, never block the user on this */ })

    // signUp() succeeding doesn't mean the user is actually signed in,
    // with "Confirm email" required, Supabase creates the account but
    // withholds the session until the code is verified. This previously
    // navigated to /onboarding unconditionally, which either silently
    // dropped unverified users into a protected route with no session,
    // or (for a not-yet-expired existing signup) skipped verification
    // entirely. Only go straight to onboarding if a session actually
    // exists; otherwise send them to enter the code.
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      navigate('/onboarding')
    } else {
      navigate('/check-inbox', { state: { email: email.trim().toLowerCase() } })
    }
  }

  async function handleGoogle() {
    if (!getCountry(country)) { setErrors(p => ({ ...p, country: 'Select your country first.' })); return }
    if (!agreed) { setAgreedErr(true); return }
    // Applied to the profile in AuthCallback once Google sign-in returns.
    try {
      localStorage.setItem('am_pricing_country', country)
      if (referralSource.trim()) localStorage.setItem('am_referral_source', referralSource.trim().slice(0, 200))
    } catch { /* storage blocked */ }
    setGLoading(true)
    const { error } = await signInWithGoogle()
    if (error) { setFormError(error); setGLoading(false) }
  }

  return (
    <AuthLayout
      eyebrow="2 MINUTE SETUP"
      title="Start getting interviews"
      subtitle="Be among our first founding members. Stop applying manually."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/sign-in" style={{ color: '#0f0f0f', fontWeight: 600, textDecoration: 'none', borderBottom: '1.5px solid #0f0f0f' }}>
            Sign in
          </Link>
        </>
      }
    >
      {/* Country: sets pricing currency, locked after signup */}
      <div style={{ marginBottom: 16 }}>
        <label className="oc-label">Country</label>
        <select className={`oc-input${errors.country ? ' error' : ''}`} value={country}
          onChange={(e) => { setCountry(e.target.value); setErrors(p => ({ ...p, country: '' })) }}>
          <option value="">Select your country</option>
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        {errors.country && <p className="oc-field-error">{errors.country}</p>}
        <p style={{ fontSize: 11.5, color: '#9b9b9b', marginTop: 6 }}>
          Sets your plan currency. Cannot be changed later.
        </p>
      </div>

      {/* Optional: how the user found us (shown to admins) */}
      <div style={{ marginBottom: 16 }}>
        <label className="oc-label" htmlFor="referral-source">How did you hear about us? <span style={{ color: '#9b9b9b', fontWeight: 400 }}>(optional)</span></label>
        <input id="referral-source" className="oc-input" type="text" maxLength={200}
          value={referralSource} onChange={(e) => setReferralSource(e.target.value)}
          placeholder="e.g. LinkedIn, a friend, Google" />
      </div>

      {/* Google: Primary CTA */}
      <button type="button" onClick={handleGoogle} disabled={gLoading} className="oc-btn-primary" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        opacity: gLoading ? 0.6 : (agreed ? 1 : 0.55),
      }}>
        <GoogleIcon />
        {gLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, margin: '14px 0 0' }}>
        <input
          id="agree-checkbox" type="checkbox" checked={agreed}
          onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setAgreedErr(false) }}
          style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, accentColor: '#0f0f0f', cursor: 'pointer' }}
        />
        <label htmlFor="agree-checkbox" style={{ fontSize: 11.5, color: agreedErr ? '#dc2626' : '#9b9b9b', lineHeight: 1.5, cursor: 'pointer' }}>
          I agree to the{' '}
          <a href="/terms" style={{ color: '#6b6b6b', textDecoration: 'underline' }}>Terms</a>,{' '}
          <a href="/privacy" style={{ color: '#6b6b6b', textDecoration: 'underline' }}>Privacy Policy</a>, and{' '}
          <a href="/refund-policy" style={{ color: '#6b6b6b', textDecoration: 'underline' }}>Refund Policy</a>.
        </label>
      </div>
      {agreedErr && <p style={{ fontSize: 12, color: '#dc2626', margin: '4px 0 0 25px' }}>Please accept the Terms to continue.</p>}

      <TrustStrip />

      <div className="oc-divider" style={{ margin: '24px 0' }}><span>or use email</span></div>

      {formError && <div className="oc-error">{formError}</div>}

      {/* Step 1: full name + email */}
      {step === 'email' && (
        <form onSubmit={handleEmailStep} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="oc-label">Full name</label>
            <input className={`oc-input${errors.fullName ? ' error' : ''}`}
              type="text" value={fullName}
              onChange={(e) => { setFullName(e.target.value); setErrors(p => ({...p, fullName: ''})) }}
              placeholder="Rahul Sharma" autoComplete="name" autoFocus />
            {errors.fullName && <p className="oc-field-error">{errors.fullName}</p>}
          </div>
          <div>
            <label className="oc-label">Email</label>
            <input className={`oc-input${errors.email ? ' error' : ''}`}
              type="email" inputMode="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors(p => ({...p, email: ''})) }}
              placeholder="you@example.com" autoComplete="email" />
            {errors.email && <p className="oc-field-error">{errors.email}</p>}
          </div>
          <button type="submit" className="oc-btn-primary" style={{ marginTop: 2 }}>
            Continue →
          </button>
        </form>
      )}

      {/* Step 2: password only (name+email confirmed above) */}
      {step === 'details' && (
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Confirmed identity */}
          <div style={{ background: '#f7f7f7', borderRadius: 10, padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>{fullName.trim()}</span>
              </div>
              <p style={{ fontSize: 12, color: '#9b9b9b', paddingLeft: 21 }}>{email}</p>
            </div>
            <button type="button" onClick={() => { setStep('email'); setErrors({}) }}
              style={{ fontSize: 12, color: '#6b6b6b', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Inter',sans-serif",
                padding: 6 }}>
              Edit
            </button>
          </div>

          <div>
            <label className="oc-label">Create password</label>
            <div style={{ position: 'relative' }}>
              <input id="password-input"
                className={`oc-input${errors.password ? ' error' : ''}`}
                type={showPwd ? 'text' : 'password'} value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(p => ({...p, password: ''})); setFormError(null) }}
                placeholder="Create a strong password" autoComplete="new-password"
                style={{ paddingRight: 48 }} />
              <ShowHideToggle show={showPwd} onToggle={() => setShowPwd(p => !p)} />
            </div>
            <PasswordStrength password={password} />
            {errors.password && <p className="oc-field-error">{errors.password}</p>}
          </div>

          <div>
            <label className="oc-label">Confirm password</label>
            <div style={{ position: 'relative' }}>
              <input id="confirm-password-input"
                className={`oc-input${errors.confirmPassword ? ' error' : ''}`}
                type={showConfirmPwd ? 'text' : 'password'} value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors(p => ({...p, confirmPassword: ''})); setFormError(null) }}
                placeholder="Re-enter your password" autoComplete="new-password"
                style={{ paddingRight: 48 }} />
              <ShowHideToggle show={showConfirmPwd} onToggle={() => setShowConfirmPwd(p => !p)} />
            </div>
            {errors.confirmPassword && <p className="oc-field-error">{errors.confirmPassword}</p>}
          </div>

          <button type="submit" disabled={loading || blocked || secsLeft > 0} className="oc-btn-primary" style={{ marginTop: 4 }}>
            {loading ? 'Creating your account…'
              : secsLeft > 0 ? `Try again in ${humanSecs(secsLeft)}`
              : blocked ? (blockMessage ?? 'Blocked')
              : 'Create account →'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
