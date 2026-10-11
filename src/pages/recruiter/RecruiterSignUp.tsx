import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { workEmailError } from '../../lib/workEmail'
import { CenterCard, ErrorBox, H1, inp, lbl, btnDark, FONT } from './ui'

export default function RecruiterSignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (fullName.trim().length < 2) { setError('Enter your full name.'); return }
    const emailErr = workEmailError(email)
    if (emailErr) { setError(emailErr); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    const cleanEmail = email.trim().toLowerCase()
    const { error: err } = await signUp(fullName.trim(), cleanEmail, password, 'recruiter')
    setLoading(false)
    if (err) {
      // The DB trigger rejects free-mail domains with a generic database error.
      setError(/database error|work email/i.test(err) ? 'Use your company email address.' : err)
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (session) navigate('/recruiter/apply')
    else navigate('/check-inbox', { state: { email: cleanEmail, next: '/recruiter/apply' } })
  }

  return (
    <CenterCard>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#9b9b9b', margin: '0 0 8px' }}>FOR RECRUITERS</p>
      <h1 style={H1}>Hire from ApplyMate</h1>
      <p style={{ fontSize: 14.5, color: '#6b6b6b', lineHeight: 1.65, margin: '0 0 24px' }}>
        Post jobs to paid ApplyMate members and contact candidates who opted in.
        Accounts are verified before you can post or view profiles.
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={lbl}>Full name</label>
          <input style={inp} value={fullName} autoComplete="name" onChange={e => setFullName(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Work email</label>
          <input style={inp} type="email" inputMode="email" value={email} autoComplete="email"
            onChange={e => setEmail(e.target.value)} placeholder="you@yourcompany.com" />
          <p style={{ fontSize: 11.5, color: '#9b9b9b', margin: '6px 0 0' }}>
            Company email only. We send a 6-digit code to verify it.
          </p>
        </div>
        <div>
          <label style={lbl}>Password</label>
          <input style={inp} type="password" value={password} autoComplete="new-password"
            onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </div>
        <button type="submit" disabled={loading} style={{ ...btnDark(loading), height: 50, fontSize: 15, fontFamily: FONT }}>
          {loading ? 'Creating account…' : 'Create recruiter account →'}
        </button>
      </form>
      <p style={{ marginTop: 22, textAlign: 'center', fontSize: 13, color: '#9b9b9b' }}>
        Already have an account?{' '}
        <Link to="/recruiter/sign-in" style={{ color: '#0f0f0f', fontWeight: 600, textDecoration: 'none', borderBottom: '1.5px solid #0f0f0f' }}>Sign in</Link>
      </p>
      <p style={{ marginTop: 10, textAlign: 'center', fontSize: 12.5, color: '#b5b5b5' }}>
        Looking for a job instead? <Link to="/sign-up" style={{ color: '#6b6b6b' }}>Candidate sign up</Link>
      </p>
    </CenterCard>
  )
}
