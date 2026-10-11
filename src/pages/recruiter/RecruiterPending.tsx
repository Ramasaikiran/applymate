import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { CenterCard, H1, btnDark, btnGhost } from './ui'

export default function RecruiterPending() {
  const { recruiter, refreshProfile, signOut } = useAuth()
  const [checking, setChecking] = useState(false)

  if (!recruiter) return <Navigate to="/recruiter/apply" replace />
  if (recruiter.status === 'approved') return <Navigate to="/recruiter" replace />

  async function check() { setChecking(true); await refreshProfile(); setChecking(false) }

  const copy = {
    pending:   { title: 'Application under review', body: 'An admin is verifying your company details. Use Check status to see the decision. You cannot post jobs or view candidates until then.' },
    rejected:  { title: 'Application rejected', body: recruiter.review_note ? `Reason: ${recruiter.review_note}` : 'Your application was not approved. You can fix the details and resubmit.' },
    suspended: { title: 'Account suspended', body: recruiter.review_note ? `Reason: ${recruiter.review_note}` : 'Your recruiter access is suspended.' },
  }[recruiter.status]

  return (
    <CenterCard>
      <h1 style={H1}>{copy.title}</h1>
      <p style={{ fontSize: 14.5, color: '#6b6b6b', lineHeight: 1.7, margin: '0 0 22px' }}>{copy.body}</p>
      <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 12, padding: 16, fontSize: 13.5, color: '#4b4b4b', lineHeight: 1.8, marginBottom: 22 }}>
        <div><strong>{recruiter.company_name}</strong> · {recruiter.designation}</div>
        <div>{recruiter.work_email}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {recruiter.status === 'rejected' && (
          <Link to="/recruiter/apply" style={{ ...btnDark(), textDecoration: 'none', display: 'inline-block' }}>Edit and resubmit</Link>
        )}
        {recruiter.status === 'pending' && (
          <button onClick={check} disabled={checking} style={btnDark(checking)}>{checking ? 'Checking…' : 'Check status'}</button>
        )}
        <button onClick={signOut} style={btnGhost}>Sign out</button>
      </div>
      {recruiter.status === 'suspended' && (
        <p style={{ fontSize: 12.5, color: '#9b9b9b', marginTop: 18 }}>Questions? Email support@applymate.in</p>
      )}
    </CenterCard>
  )
}
