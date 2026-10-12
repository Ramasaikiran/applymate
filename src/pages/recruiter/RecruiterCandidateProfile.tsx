import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, type CandidateFull, type Job } from '../../lib/supabase'
import { RecruiterShell, Chip, ErrorBox, card, inp, lbl, btnDark, FONT } from './ui'

const mailBtn: React.CSSProperties = {
  background: '#fff', color: '#0f0f0f', border: '1.5px solid #bbf7d0', padding: '8px 14px',
  borderRadius: 9, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', fontFamily: FONT,
}

export default function RecruiterCandidateProfile() {
  const { id } = useParams<{ id: string }>()
  const { profile, recruiter } = useAuth()
  const [data, setData] = useState<CandidateFull | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const startedFor = useRef<string | null>(null)

  const [jobs, setJobs] = useState<Pick<Job, 'id' | 'title'>[]>([])
  const [type, setType] = useState<'assessment' | 'interview'>('interview')
  const [jobId, setJobId] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [composed, setComposed] = useState<{ subject: string; body: string } | null>(null)
    const [inviteError, setInviteError] = useState<string | null>(null)
  const [resumeErr, setResumeErr] = useState<string | null>(null)

  async function openResume(path: string) {
    setResumeErr(null)
    const { data: s, error: err } = await supabase.storage.from('resumes').createSignedUrl(path, 600)
    if (err || !s?.signedUrl) { setResumeErr('Could not open the resume.'); return }
    window.open(s.signedUrl, '_blank', 'noopener,noreferrer')
  }


  useEffect(() => {
    if (!id || startedFor.current === id) return   // one view per mount (view is logged server-side)
    startedFor.current = id
    ;(async () => {
      const { data: res, error: err } = await supabase.rpc('recruiter_view_candidate', { p_candidate_id: id })
      setLoading(false)
      if (err) { setError('Could not open this profile.'); return }
      if (!res?.ok) { setError(res?.error ?? 'Candidate not available.'); return }
      setData(res as CandidateFull)
    })()
    supabase.from('jobs').select('id,title').eq('status', 'published')
      .then(({ data: j }) => setJobs((j ?? []) as Pick<Job, 'id' | 'title'>[]))
  }, [id])

  async function sendInvite() {
    if (!id) return
    setSending(true); setInviteError(null); setComposed(null)
    const { data: res, error: err } = await supabase.rpc('recruiter_send_invite', {
      p_candidate_id: id, p_type: type, p_message: message.trim() || null, p_job_id: jobId || null,
    })
    if (err || !res?.ok) { setSending(false); setInviteError(res?.error ?? 'Could not send the invite.'); return }

    // ApplyMate never sends this email. The recruiter sends it from their own
    // work mailbox using the links below. The RPC only logs the invite and
    // enforces limits.
    const jobTitle = jobs.find(j => j.id === jobId)?.title
    const kind = type === 'assessment' ? 'assessment' : 'interview'
    const first = data?.candidate.full_name.split(' ')[0] ?? 'there'
    const subject = `${recruiter?.company_name ?? 'Our company'}: ${kind} invitation${jobTitle ? ` for ${jobTitle}` : ''}`
    const body = [
      `Hi ${first},`, '',
      `I'm ${profile?.full_name ?? ''} from ${recruiter?.company_name ?? ''}. I came across your profile on ApplyMate and would like to invite you for ${kind === 'assessment' ? 'an assessment' : 'an interview'}${jobTitle ? ` for the ${jobTitle} role` : ''}.`,
      ...(message.trim() ? ['', message.trim()] : []),
      '', 'Please reply to this email to confirm.', '', 'Regards,', profile?.full_name ?? '',
      `${recruiter?.designation ?? ''}, ${recruiter?.company_name ?? ''}`,
    ].join('\n')
    setSending(false)
    setMessage('')
    setComposed({ subject, body })
  }

  const c = data?.candidate
  const skills = data?.student?.technical_skills ?? data?.professional?.technical_skills ?? []

  return (
    <RecruiterShell>
      <Link to="/recruiter" style={{ fontSize: 13, color: '#6b6b6b', textDecoration: 'none' }}>← Back to candidates</Link>

      {loading && <p style={{ color: '#9b9b9b', marginTop: 24 }}>Opening profile…</p>}
      {error && <div style={{ marginTop: 20 }}><ErrorBox>{error}</ErrorBox></div>}

      {c && (
        <div style={{ display: 'grid', gap: 16, marginTop: 18, fontFamily: FONT }}>
          <div style={card}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              {c.photo_url && <img src={c.photo_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />}
              <div>
                <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 28, fontWeight: 400, margin: '0 0 4px' }}>{c.full_name}</h1>
                <p style={{ fontSize: 13, color: '#9b9b9b', margin: 0, textTransform: 'capitalize' }}>
                  {c.user_type}{c.country ? ` · ${c.country}` : ''}
                </p>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#9b9b9b', margin: '14px 0 0' }}>
              This candidate was notified that you viewed their profile.
            </p>
          </div>

          <div style={card}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px' }}>Contact</p>
            <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
              <div>Email: <a href={`mailto:${c.email}`} style={{ color: '#0f0f0f' }}>{c.email}</a></div>
              {c.mobile_number && <div>Phone: <a href={`tel:${c.mobile_number}`} style={{ color: '#0f0f0f' }}>{c.mobile_number}</a></div>}
              {c.linkedin_url && <div>LinkedIn: <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0f0f0f' }}>{c.linkedin_url}</a></div>}
              {c.github_url && <div>GitHub: <a href={c.github_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0f0f0f' }}>{c.github_url}</a></div>}
            </div>
          </div>

          <div style={card}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px' }}>Background</p>
            {(() => {
              const path = data.student?.resume_url ?? data.professional?.resume_url ?? null
              return path
                ? <button onClick={() => openResume(path)} style={{ ...mailBtn, cursor: 'pointer', marginBottom: 12 }}>View resume</button>
                : <p style={{ fontSize: 13, color: '#9b9b9b', margin: '0 0 12px' }}>No resume uploaded.</p>
            })()}
            {resumeErr && <ErrorBox>{resumeErr}</ErrorBox>}
            {data.student && (
              <div style={{ fontSize: 14, lineHeight: 1.9, color: '#3b3b3b' }}>
                <div>{[data.student.college_name, data.student.degree, data.student.branch].filter(Boolean).join(' · ')}</div>
                <div>{[data.student.passout_year ? `Class of ${data.student.passout_year}` : null, data.student.cgpa != null ? `CGPA ${data.student.cgpa}` : null].filter(Boolean).join(' · ')}</div>
                {data.student.internship_done && data.student.internship_details && <div>Internship: {data.student.internship_details}</div>}
                {data.student.projects && <div style={{ whiteSpace: 'pre-wrap' }}>Projects: {data.student.projects}</div>}
              </div>
            )}
            {data.professional && (
              <div style={{ fontSize: 14, lineHeight: 1.9, color: '#3b3b3b' }}>
                <div>{[data.professional.previous_job_title, data.professional.previous_company].filter(Boolean).join(' at ')}</div>
                <div>{data.professional.years_experience != null ? `${data.professional.years_experience} years experience` : ''}</div>
                {data.professional.notice_period && <div>Notice period: {data.professional.notice_period_days ?? '?'} days</div>}
              </div>
            )}
            {!!skills.length && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {skills.map(s => <Chip key={s}>{s}</Chip>)}
              </div>
            )}
          </div>

          <div style={card}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Invite this candidate</p>
            <p style={{ fontSize: 12, color: '#9b9b9b', margin: '0 0 12px' }}>The email is sent from your own work mailbox, not from ApplyMate.</p>
            {inviteError && <ErrorBox>{inviteError}</ErrorBox>}
            {composed && c && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <p style={{ fontSize: 13.5, color: '#16a34a', fontWeight: 600, margin: '0 0 6px' }}>Invite logged. Now send it from your work email.</p>
                <p style={{ fontSize: 12.5, color: '#4b4b4b', margin: '0 0 10px', lineHeight: 1.6 }}>
                  ApplyMate does not send email for you. Pick your mail app. The message is pre-filled.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a style={mailBtn} href={`mailto:${c.email}?subject=${encodeURIComponent(composed.subject)}&body=${encodeURIComponent(composed.body)}`}>Default mail app</a>
                  <a style={mailBtn} target="_blank" rel="noopener noreferrer" href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.email)}&su=${encodeURIComponent(composed.subject)}&body=${encodeURIComponent(composed.body)}`}>Gmail / Google Workspace</a>
                  <a style={mailBtn} target="_blank" rel="noopener noreferrer" href={`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(c.email)}&subject=${encodeURIComponent(composed.subject)}&body=${encodeURIComponent(composed.body)}`}>Outlook / Microsoft 365</a>
                </div>
                <p style={{ fontSize: 11.5, color: '#9b9b9b', margin: '10px 0 0' }}>Send it from {recruiter?.work_email}. Use your company address only.</p>
              </div>
            )}
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
              <div><label style={lbl}>Invite type</label>
                <select style={inp} value={type} onChange={e => setType(e.target.value as typeof type)}>
                  <option value="interview">Interview</option>
                  <option value="assessment">Assessment</option>
                </select></div>
              <div><label style={lbl}>For job (optional)</label>
                <select style={inp} value={jobId} onChange={e => setJobId(e.target.value)}>
                  <option value="">No specific job</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Message (optional, max 1000 characters)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 1000))} rows={4}
                style={{ ...inp, height: 'auto', padding: 12, resize: 'vertical' }}
                placeholder="Share the role, timing, or assessment link." />
            </div>
            <button onClick={sendInvite} disabled={sending} style={{ ...btnDark(sending), marginTop: 14 }}>
              {sending ? 'Preparing…' : 'Prepare invite'}
            </button>
          </div>
        </div>
      )}
    </RecruiterShell>
  )
}
