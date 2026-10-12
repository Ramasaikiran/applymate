import { useEffect, useState } from 'react'
import { supabase, type Job } from '../../lib/supabase'
import { jobBadge, TONE_STYLE } from '../../lib/jobReview'
import AdminNav from './AdminNav'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'
const FILTERS: Filter[] = ['pending', 'approved', 'rejected', 'all']

export default function AdminJobApprovals() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error: err } = await supabase.from('jobs').select('*')
      .not('recruiter_id', 'is', null).order('posted_at', { ascending: false })
    if (err) setError(err.message)
    setJobs((data ?? []) as Job[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function decide(j: Job, decision: 'approved' | 'rejected') {
    const note = (notes[j.id] ?? '').trim()
    if (decision === 'rejected' && !note) { setError('Add a reason before rejecting.'); return }
    setBusy(j.id); setError(null)
    const { data, error: err } = await supabase.rpc('admin_review_job', { p_job_id: j.id, p_decision: decision, p_note: note || null })
    setBusy(null)
    if (err || !data?.ok) { setError(data?.error ?? err?.message ?? 'Failed'); return }
    load()
  }

  const count = (f: Filter) => jobs.filter(j => f === 'all' || j.review_status === f).length
  const shown = jobs.filter(j => filter === 'all' || j.review_status === filter)

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
      <AdminNav title="Admin" />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 28, fontWeight: 400, margin: '0 0 6px' }}>Job approvals</h1>
        <p style={{ fontSize: 13.5, color: '#6b6b6b', margin: '0 0 16px' }}>
          Recruiter jobs go live for paid members only after you approve them. Check the company, role and apply link.
        </p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 99, border: '1px solid #e5e5e5',
              cursor: 'pointer', textTransform: 'capitalize', fontSize: 12.5, fontWeight: 600, fontFamily: "'Inter',sans-serif",
              background: filter === f ? '#0f0f0f' : '#fff', color: filter === f ? '#fff' : '#6b6b6b' }}>{f} ({count(f)})</button>
          ))}
        </div>
        {error && <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: 12, fontSize: 13.5, color: '#dc2626', marginBottom: 14 }}>{error}</div>}
        {loading && <p style={{ color: '#9b9b9b' }}>Loading…</p>}
        {!loading && shown.length === 0 && <p style={{ color: '#9b9b9b', textAlign: 'center', padding: 40 }}>No jobs here.</p>}
        <div style={{ display: 'grid', gap: 12 }}>
          {shown.map(j => {
            const b = jobBadge(j); const t = TONE_STYLE[b.tone]
            return (
              <div key={j.id} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 2px' }}>{j.title}</p>
                    <p style={{ fontSize: 12.5, color: '#9b9b9b', margin: 0 }}>{j.company} · posted by {j.recruiter_name ?? 'recruiter'}</p>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: t.bg, color: t.fg, height: 'fit-content' }}>{b.label}</span>
                </div>
                <div style={{ fontSize: 13, color: '#3b3b3b', lineHeight: 1.8, margin: '12px 0', wordBreak: 'break-word' }}>
                  <div>{[j.location, j.work_mode, j.job_type, j.role_category].filter(Boolean).join(' · ')}</div>
                  {!!j.required_skills?.length && <div>Skills: {j.required_skills.join(', ')}</div>}
                  {(j.salary_min != null || j.salary_max != null) && <div>Salary: ₹{j.salary_min ?? '?'} to ₹{j.salary_max ?? '?'}</div>}
                  <div>Apply link: {j.apply_url ? <a href={j.apply_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0f0f0f' }}>{j.apply_url}</a> : 'none'}</div>
                  {j.description && <div style={{ whiteSpace: 'pre-wrap', color: '#6b6b6b', marginTop: 6 }}>{j.description}</div>}
                  {j.review_note && <div style={{ color: '#6b6b6b', marginTop: 6 }}>Last note: {j.review_note}</div>}
                </div>
                {j.review_status !== 'approved' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input placeholder="Reason (required to reject)" value={notes[j.id] ?? ''}
                      onChange={e => setNotes(p => ({ ...p, [j.id]: e.target.value }))}
                      style={{ flex: 1, minWidth: 200, height: 38, padding: '0 12px', border: '1.5px solid #e5e5e5', borderRadius: 8, fontSize: 13, fontFamily: "'Inter',sans-serif" }} />
                    <button disabled={busy === j.id} onClick={() => decide(j, 'approved')}
                      style={{ height: 38, padding: '0 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Approve</button>
                    {j.review_status === 'pending' && (
                      <button disabled={busy === j.id} onClick={() => decide(j, 'rejected')}
                        style={{ height: 38, padding: '0 16px', background: '#fff', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Reject</button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
