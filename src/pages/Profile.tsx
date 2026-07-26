import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const ROLES = ['SDE / Software Engineer','Frontend Engineer','Backend Engineer','Full Stack Engineer',
  'ML / AI Engineer','Data Scientist','Data Analyst','Other']
const YEARS = ['1st Year','2nd Year','3rd Year','4th Year','Graduated']

const inp: React.CSSProperties = {
  width: '100%', height: 46, padding: '0 14px',
  fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#0f0f0f',
  background: '#fff', border: '1.5px solid #e5e5e5',
  borderRadius: 10, outline: 'none', boxSizing: 'border-box',
}
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 6,
}

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobile, setMobile] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [github, setGithub] = useState('')
  const [roleInts, setRoleInts] = useState<string[]>([])
  const [currentYear, setCurrentYear] = useState('')
  const [passoutYear, setPassoutYear] = useState('')
  const [isStudent, setIsStudent] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deletionStatus, setDeletionStatus] = useState<'none' | 'pending' | 'rejected'>('none')
  const [deletionRequesting, setDeletionRequesting] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    if (!profile) return
    setFirstName(profile.first_name ?? '')
    setLastName(profile.last_name ?? '')
    setMobile(profile.mobile_number ?? '')
    setLinkedin(profile.linkedin_url ?? '')
    setGithub(profile.github_url ?? '')
    setRoleInts(profile.role_interests ?? [])
    setIsStudent(profile.user_type === 'student')

    if (profile.user_type === 'student') {
      const { data } = await supabase.from('student_details')
        .select('current_year, passout_year').eq('id', profile.id).maybeSingle()
      setCurrentYear(data?.current_year ?? '')
      setPassoutYear(data?.passout_year ? String(data.passout_year) : '')
    }

    const { data: delReq } = await supabase.from('profile_deletion_requests')
      .select('status').eq('user_id', profile.id)
      .order('requested_at', { ascending: false }).limit(1).maybeSingle()
    setDeletionStatus(delReq?.status === 'pending' ? 'pending' : delReq?.status === 'rejected' ? 'rejected' : 'none')
  }

  function toggleRole(r: string) {
    setRoleInts(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true); setError(null); setSaved(false)
    try {
      const { error: profErr } = await supabase.from('profiles').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        mobile_number: mobile.trim() || null,
        linkedin_url: linkedin.trim() || null,
        github_url: github.trim() || null,
        role_interests: roleInts,
      }).eq('id', profile.id)
      if (profErr) throw profErr

      if (isStudent) {
        const { error: sdErr } = await supabase.from('student_details').update({
          current_year: currentYear || null,
          passout_year: passoutYear ? parseInt(passoutYear) : null,
        }).eq('id', profile.id)
        if (sdErr) throw sdErr
      }

      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function requestDeletion() {
    setDeletionRequesting(true); setDeletionError(null)
    try {
      const { error } = await supabase.rpc('request_profile_deletion', { p_reason: null })
      if (error) throw error
      setDeletionStatus('pending')
      setShowDeleteConfirm(false)
    } catch (err) {
      setDeletionError((err as Error).message)
    } finally {
      setDeletionRequesting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px',
          height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/dashboard" style={{ fontSize: 13, color: '#6b6b6b', textDecoration: 'none' }}>← Dashboard</Link>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={signOut} style={{ background: 'none', border: 'none',
              fontSize: 13, color: '#9b9b9b', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              padding: '6px 10px' }}>Sign out</button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px 80px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#b5b5b5',
          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>MY PROFILE</p>
        <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 28,
          fontWeight: 400, color: '#0f0f0f', letterSpacing: '-0.02em', marginBottom: 28 }}>
          Your details
        </h1>

        {error && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12,
          padding: 24, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>First name</label>
              <input style={inp} value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div>
              <label style={label}>Last name</label>
              <input style={inp} value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={label}>Mobile number</label>
            <input style={inp} value={mobile} onChange={e => setMobile(e.target.value)} />
          </div>

          <div>
            <label style={label}>LinkedIn URL</label>
            <input style={inp} value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
          </div>

          <div>
            <label style={label}>GitHub URL</label>
            <input style={inp} value={github} onChange={e => setGithub(e.target.value)} placeholder="https://github.com/..." />
          </div>

          <div>
            <label style={label}>Roles interested in</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ROLES.map(r => (
                <button key={r} type="button" onClick={() => toggleRole(r)} style={{
                  padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                  border: '1px solid #e5e5e5', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                  background: roleInts.includes(r) ? '#0f0f0f' : '#f5f5f5',
                  color: roleInts.includes(r) ? '#fff' : '#4b4b4b',
                }}>{r}</button>
              ))}
            </div>
          </div>

          {isStudent && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={label}>Current year</label>
                <select value={currentYear} onChange={e => setCurrentYear(e.target.value)}
                  style={{ ...inp, appearance: 'none' as const }}>
                  <option value="">Select</option>
                  {YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Graduation year</label>
                <input style={inp} type="number" value={passoutYear}
                  onChange={e => setPassoutYear(e.target.value)} placeholder="2026" />
                <p style={{ fontSize: 11, color: '#b5b5b5', marginTop: 4 }}>
                  Still in an earlier year? Update this any time — it controls which batch-specific jobs you see.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <button onClick={handleSave} disabled={saving} style={{
              background: '#0f0f0f', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 9, fontSize: 13.5, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              fontFamily: "'Inter',sans-serif",
            }}>{saving ? 'Saving…' : 'Save changes'}</button>
            {saved && <span style={{ fontSize: 12.5, color: '#16a34a', fontWeight: 600 }}>Saved ✓</span>}
          </div>
        </div>

        {/* Danger zone — delete profile, admin-approved */}
        <div style={{ padding: '16px 20px', background: '#fff',
          border: '1px solid #fecaca', borderRadius: 12, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f', marginBottom: 2 }}>Delete profile</p>
            <p style={{ fontSize: 12, color: '#9b9b9b' }}>
              {deletionStatus === 'pending'
                ? 'Request sent. An admin will review it — your profile stays active until then.'
                : deletionStatus === 'rejected'
                ? 'Your last request was declined. You can send another.'
                : 'Permanently removes your profile and application history. Requires admin approval.'}
            </p>
            {deletionError && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{deletionError}</p>}
          </div>
          {deletionStatus === 'pending' ? (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#b45309', background: '#fffbeb',
              border: '1px solid #fde68a', borderRadius: 8, padding: '9px 16px', flexShrink: 0 }}>
              Pending review
            </span>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)} style={{
              background: '#fff', color: '#dc2626', border: '1px solid #fecaca',
              padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Inter',sans-serif", flexShrink: 0,
            }}>
              Request deletion
            </button>
          )}
        </div>

        {showDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%' }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#0f0f0f', marginBottom: 8,
                fontFamily: "'Inter',sans-serif" }}>Delete your profile?</p>
              <p style={{ fontSize: 13.5, color: '#6b6b6b', lineHeight: 1.6, marginBottom: 22 }}>
                This sends a deletion request to our team. Once an admin approves it,
                your profile, resume, and application history are permanently removed. This can't be undone.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deletionRequesting} style={{
                  background: '#f5f5f5', color: '#0f0f0f', border: 'none', padding: '10px 18px',
                  borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'Inter',sans-serif",
                }}>Cancel</button>
                <button onClick={requestDeletion} disabled={deletionRequesting} style={{
                  background: '#dc2626', color: '#fff', border: 'none', padding: '10px 18px',
                  borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                  cursor: deletionRequesting ? 'not-allowed' : 'pointer', opacity: deletionRequesting ? 0.7 : 1,
                  fontFamily: "'Inter',sans-serif",
                }}>{deletionRequesting ? 'Sending…' : 'Yes, request deletion'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
