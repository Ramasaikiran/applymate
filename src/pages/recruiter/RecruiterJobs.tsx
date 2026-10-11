import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, type Job, type JobStatus } from '../../lib/supabase'
import { RecruiterShell, Chip, ErrorBox, card, inp, lbl, btnDark, btnGhost, FONT } from './ui'

interface Form {
  title: string; description: string; skills: string; expMin: string; expMax: string
  jobType: string; workMode: string; location: string; salaryMin: string; salaryMax: string
  applyUrl: string; lastDate: string; gradYears: string; roleCategory: string
}
const EMPTY: Form = {
  title: '', description: '', skills: '', expMin: '0', expMax: '', jobType: 'full-time', workMode: 'onsite',
  location: '', salaryMin: '', salaryMax: '', applyUrl: '', lastDate: '', gradYears: '', roleCategory: '',
}
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', published: 'Live', inactive: 'Paused' }

export default function RecruiterJobs() {
  const { user, recruiter } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error: err } = await supabase.from('jobs').select('*')
      .eq('recruiter_id', user!.id).order('posted_at', { ascending: false })
    if (err) setError('Could not load your jobs.')
    setJobs((data ?? []) as Job[])
    setLoading(false)
  }
  useEffect(() => { if (user) load() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm(p => ({ ...p, [k]: e.target.value }))

  function edit(j: Job) {
    setEditId(j.id); setShowForm(true); setError(null)
    setForm({
      title: j.title, description: j.description ?? '', skills: (j.required_skills ?? []).join(', '),
      expMin: String(j.required_experience_min ?? 0), expMax: j.required_experience_max != null ? String(j.required_experience_max) : '',
      jobType: j.job_type ?? 'full-time', workMode: j.work_mode ?? 'onsite', location: j.location ?? '',
      salaryMin: j.salary_min != null ? String(j.salary_min) : '', salaryMax: j.salary_max != null ? String(j.salary_max) : '',
      applyUrl: j.apply_url ?? '', lastDate: j.last_date ?? '', gradYears: (j.graduation_years ?? []).join(', '),
      roleCategory: j.role_category ?? '',
    })
  }

  async function save(e: FormEvent, status: JobStatus) {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) { setError('Job title is required.'); return }
    if (!/^https?:\/\//i.test(form.applyUrl.trim())) { setError('Apply link must start with http:// or https://'); return }
    setSaving(true)
    const payload = {
      title: form.title.trim(), company: recruiter?.company_name ?? '', description: form.description.trim() || null,
      required_skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      required_experience_min: Number(form.expMin) || 0,
      required_experience_max: form.expMax ? Number(form.expMax) : null,
      job_type: form.jobType, work_mode: form.workMode, role_category: form.roleCategory.trim() || null,
      location: form.location.trim() || null, country: 'India',
      salary_min: form.salaryMin ? Number(form.salaryMin) : null,
      salary_max: form.salaryMax ? Number(form.salaryMax) : null,
      apply_url: form.applyUrl.trim(), last_date: form.lastDate || null,
      graduation_years: form.gradYears.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
      status, is_active: true,
    }
    const { error: err } = editId
      ? await supabase.from('jobs').update(payload).eq('id', editId)
      : await supabase.from('jobs').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false); setEditId(null); setForm(EMPTY)
    load()
  }

  async function setStatus(j: Job, status: JobStatus) {
    const { error: err } = await supabase.from('jobs').update({ status }).eq('id', j.id)
    if (err) { setError(err.message); return }
    setJobs(prev => prev.map(x => x.id === j.id ? { ...x, status } : x))
  }

  async function remove(j: Job) {
    if (!window.confirm(`Delete "${j.title}"?`)) return
    const { error: err } = await supabase.from('jobs').delete().eq('id', j.id)
    if (err) { setError(err.message); return }
    setJobs(prev => prev.filter(x => x.id !== j.id))
  }

  return (
    <RecruiterShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 30, fontWeight: 400, margin: '0 0 6px' }}>My jobs</h1>
          <p style={{ fontSize: 13.5, color: '#6b6b6b', margin: 0, lineHeight: 1.6, maxWidth: 560 }}>
            Only paid ApplyMate members can see these jobs. They see your name and company, not your profile.
          </p>
        </div>
        {!showForm && <button onClick={() => { setEditId(null); setForm(EMPTY); setShowForm(true) }} style={btnDark()}>+ Post a job</button>}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {showForm && (
        <form style={{ ...card, display: 'grid', gap: 14, marginBottom: 20, fontFamily: FONT }} onSubmit={e => save(e, 'published')}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{editId ? 'Edit job' : 'New job'}</p>
          <div><label style={lbl}>Title</label><input style={inp} value={form.title} onChange={set('title')} /></div>
          <div><label style={lbl}>Description</label>
            <textarea rows={5} value={form.description} onChange={set('description')} style={{ ...inp, height: 'auto', padding: 12, resize: 'vertical' }} /></div>
          <div><label style={lbl}>Required skills (comma separated)</label><input style={inp} value={form.skills} onChange={set('skills')} /></div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            <div><label style={lbl}>Min. experience (yrs)</label><input style={inp} type="number" min="0" step="0.5" value={form.expMin} onChange={set('expMin')} /></div>
            <div><label style={lbl}>Max. experience (yrs)</label><input style={inp} type="number" min="0" step="0.5" value={form.expMax} onChange={set('expMax')} /></div>
            <div><label style={lbl}>Job type</label>
              <select style={inp} value={form.jobType} onChange={set('jobType')}>
                {['full-time', 'internship', 'contract', 'part-time'].map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label style={lbl}>Work mode</label>
              <select style={inp} value={form.workMode} onChange={set('workMode')}>
                {['onsite', 'hybrid', 'remote'].map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            <div><label style={lbl}>Location</label><input style={inp} value={form.location} onChange={set('location')} /></div>
            <div><label style={lbl}>Role category</label><input style={inp} value={form.roleCategory} onChange={set('roleCategory')} placeholder="SDE, Data, Product" /></div>
            <div><label style={lbl}>Salary min (₹/yr)</label><input style={inp} type="number" min="0" value={form.salaryMin} onChange={set('salaryMin')} /></div>
            <div><label style={lbl}>Salary max (₹/yr)</label><input style={inp} type="number" min="0" value={form.salaryMax} onChange={set('salaryMax')} /></div>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <div><label style={lbl}>Apply link</label><input style={inp} value={form.applyUrl} onChange={set('applyUrl')} placeholder="https://" /></div>
            <div><label style={lbl}>Last date to apply</label><input style={inp} type="date" value={form.lastDate} onChange={set('lastDate')} /></div>
            <div><label style={lbl}>Graduation years (optional)</label><input style={inp} value={form.gradYears} onChange={set('gradYears')} placeholder="2025, 2026" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" disabled={saving} style={btnDark(saving)}>{saving ? 'Saving…' : 'Publish'}</button>
            <button type="button" disabled={saving} onClick={e => save(e, 'draft')} style={btnGhost}>Save as draft</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} style={btnGhost}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p style={{ color: '#9b9b9b' }}>Loading…</p> : jobs.length === 0 && !showForm ? (
        <p style={{ textAlign: 'center', color: '#9b9b9b', fontSize: 14, padding: '40px 0' }}>No jobs yet. Post your first one.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {jobs.map(j => (
            <div key={j.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontFamily: FONT }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 3px' }}>{j.title}</p>
                <p style={{ fontSize: 12.5, color: '#9b9b9b', margin: '0 0 8px' }}>
                  {[j.location, j.work_mode, j.job_type].filter(Boolean).join(' · ')}
                </p>
                <Chip>{STATUS_LABEL[j.status] ?? j.status}</Chip>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {j.status !== 'published'
                  ? <button style={btnGhost} onClick={() => setStatus(j, 'published')}>Publish</button>
                  : <button style={btnGhost} onClick={() => setStatus(j, 'inactive')}>Pause</button>}
                <button style={btnGhost} onClick={() => edit(j)}>Edit</button>
                <button style={{ ...btnGhost, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => remove(j)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </RecruiterShell>
  )
}
