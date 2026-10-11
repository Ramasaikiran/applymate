import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { CenterCard, ErrorBox, H1, inp, lbl, btnDark, btnGhost, FONT } from './ui'

function withProtocol(url: string) {
  const u = url.trim()
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

export default function RecruiterApply() {
  const { user, recruiter, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [company, setCompany] = useState(recruiter?.company_name ?? '')
  const [website, setWebsite] = useState(recruiter?.company_website ?? '')
  const [designation, setDesignation] = useState(recruiter?.designation ?? '')
  const [linkedin, setLinkedin] = useState(recruiter?.linkedin_url ?? '')
  const [gstin, setGstin] = useState(recruiter?.gstin ?? '')
  const [cin, setCin] = useState(recruiter?.cin ?? '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Already submitted and waiting / suspended: nothing to edit here.
  if (recruiter && (recruiter.status === 'pending' || recruiter.status === 'suspended')) {
    return <Navigate to="/recruiter/pending" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!company.trim() || !designation.trim()) { setError('Company name and designation are required.'); return }
    if (!website.trim() || !website.includes('.')) { setError('Enter your company website.'); return }
    if (!/linkedin\.com\//i.test(linkedin)) { setError('Enter your LinkedIn profile URL (linkedin.com/in/...).'); return }

    setLoading(true)
    const { data, error: rpcErr } = await supabase.rpc('apply_as_recruiter', {
      p_company_name: company, p_company_website: withProtocol(website),
      p_designation: designation, p_linkedin_url: withProtocol(linkedin),
      p_gstin: gstin.trim() || null, p_cin: cin.trim() || null,
    })
    if (rpcErr || !data?.ok) {
      setLoading(false)
      setError(data?.error ?? 'Could not submit. Please try again.')
      return
    }
    await refreshProfile()
    setLoading(false)
    navigate('/recruiter/pending', { replace: true })
  }

  return (
    <CenterCard width={560}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#9b9b9b', margin: '0 0 8px' }}>STEP 2 OF 2</p>
      <h1 style={H1}>Verify your company</h1>
      <p style={{ fontSize: 14.5, color: '#6b6b6b', lineHeight: 1.65, margin: '0 0 22px' }}>
        An admin reviews these details before you can post jobs or view candidates.
      </p>
      {recruiter?.status === 'rejected' && (
        <ErrorBox>Your last application was rejected{recruiter.review_note ? `: ${recruiter.review_note}` : '.'} Update the details and resubmit.</ErrorBox>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={lbl}>Work email (verified)</label>
          <input style={{ ...inp, background: '#fafafa', color: '#6b6b6b' }} value={user?.email ?? ''} readOnly />
        </div>
        <div>
          <label style={lbl}>Company name</label>
          <input style={inp} value={company} onChange={e => setCompany(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Company website</label>
          <input style={inp} value={website} onChange={e => setWebsite(e.target.value)} placeholder="yourcompany.com" />
        </div>
        <div>
          <label style={lbl}>Your designation</label>
          <input style={inp} value={designation} onChange={e => setDesignation(e.target.value)} placeholder="Talent Acquisition Lead" />
        </div>
        <div>
          <label style={lbl}>Your LinkedIn profile</label>
          <input style={inp} value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin.com/in/yourname" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>GSTIN (optional)</label>
            <input style={inp} value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label style={lbl}>CIN (optional)</label>
            <input style={inp} value={cin} onChange={e => setCin(e.target.value.toUpperCase())} />
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#9b9b9b', margin: 0, lineHeight: 1.6 }}>
          GSTIN or CIN speeds up review. Staffing agencies and freelance recruiters may be asked for client authorization.
        </p>
        <button type="submit" disabled={loading} style={{ ...btnDark(loading), height: 50, fontSize: 15, fontFamily: FONT }}>
          {loading ? 'Submitting…' : 'Submit for review →'}
        </button>
        <button type="button" onClick={signOut} style={{ ...btnGhost, alignSelf: 'center' }}>Sign out</button>
      </form>
    </CenterCard>
  )
}
