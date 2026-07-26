import { useEffect, useState } from 'react'
import { supabase, type Job, type JobStatus, type SubscriptionPlan } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import AdminNav from './AdminNav'

const BLANK: Omit<Job,'id'|'posted_at'|'updated_at'> = {
  title: '', company: '', description: '', required_skills: [],
  required_experience_min: 0, required_experience_max: null,
  job_type: 'full-time', work_mode: null, role_category: '', required_passout_year: null, location: '', country: 'India',
  salary_min: null, salary_max: null, apply_url: '', last_date: null,
  plan_visibility: ['free', 'basic', 'pro', 'maxpro'], status: 'draft', is_active: true,
}

const STATUS_META: Record<JobStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#9b9b9b', bg: '#f5f5f5' },
  published: { label: 'Published', color: '#16a34a', bg: '#f0fdf4' },
  inactive:  { label: 'Inactive',  color: '#dc2626', bg: '#fef2f2' },
}

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: 'Free', basic: 'Basic', pro: 'Pro', maxpro: 'Max Pro',
}

export default function AdminJobs() {
  const { profile } = useAuth()
  const [jobs,    setJobs]    = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [form,    setForm]    = useState<typeof BLANK>(BLANK)
  const [skillsInput, setSkillsInput] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [showForm,setShowForm]= useState(false)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [search,  setSearch]  = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setLoadErr(null)
    const { data, error: err } = await supabase.from('jobs').select('*').order('posted_at', { ascending: false })
    if (err) { console.error('Jobs load error:', err); setLoadErr(err.message) }
    setJobs((data as Job[]) ?? [])
    setLoading(false)
  }

  const filteredJobs = jobs.filter(j => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) || (j.location ?? '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || j.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const urlCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    if (j.apply_url) acc[j.apply_url] = (acc[j.apply_url] ?? 0) + 1
    return acc
  }, {})

  function openNew() {
    setForm(BLANK); setSkillsInput(''); setEditId(null); setError(null); setShowForm(true)
  }

  function openEdit(job: Job) {
    setForm({
      title: job.title, company: job.company, description: job.description ?? '',
      required_skills: job.required_skills, required_experience_min: job.required_experience_min,
      required_experience_max: job.required_experience_max, job_type: job.job_type,
      work_mode: job.work_mode, role_category: job.role_category ?? '',
      required_passout_year: job.required_passout_year ?? null, location: job.location ?? '',
      country: job.country ?? 'India', salary_min: job.salary_min, salary_max: job.salary_max,
      apply_url: job.apply_url ?? '', last_date: job.last_date,
      plan_visibility: job.plan_visibility?.length ? job.plan_visibility : ['free', 'basic', 'pro', 'maxpro'],
      status: job.status, is_active: job.is_active,
    })
    setSkillsInput(job.required_skills.join(', '))
    setEditId(job.id); setError(null); setShowForm(true)
  }

  async function handleSave(publishNow?: boolean) {
    if (!form.title.trim() || !form.company.trim()) { setError('Title and company are required.'); return }
    setSaving(true); setError(null)
    const payload = {
      ...form,
      status: publishNow ? 'published' : form.status,
      required_skills: skillsInput.split(',').map(s => s.trim()).filter(Boolean),
      created_by: profile?.id,
    }
    const { error: dbErr } = editId
      ? await supabase.from('jobs').update(payload).eq('id', editId)
      : await supabase.from('jobs').insert(payload)
    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    setSaving(false); setShowForm(false)
    await load()
  }

  async function setStatus(job: Job, status: JobStatus) {
    await supabase.from('jobs').update({ status }).eq('id', job.id)
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status } : j))
  }

  async function deleteJob(job: Job) {
    if (!confirm(`Delete "${job.title}" at ${job.company}? This can't be undone.`)) return
    await supabase.from('jobs').delete().eq('id', job.id)
    setJobs(prev => prev.filter(j => j.id !== job.id))
  }

  function togglePlanVisibility(plan: SubscriptionPlan) {
    setForm(p => ({
      ...p,
      plan_visibility: p.plan_visibility.includes(plan)
        ? p.plan_visibility.filter(v => v !== plan)
        : [...p.plan_visibility, plan],
    }))
  }

  const inp: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 14px', fontSize: 14, color: '#0f0f0f',
    border: '1.5px solid #e5e5e5', borderRadius: 10, background: '#fff',
    fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
      <AdminNav title="Job Listings" />
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 28px',
        background: '#fff', borderBottom: '1.5px solid #f0f0f0', gap: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>Job Listings</span>
        <button onClick={openNew} style={{
          marginLeft: 'auto', padding: '8px 18px', background: '#0f0f0f', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: "'Inter',sans-serif",
        }}>+ Add job</button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '36px 24px' }}>

        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px',
              width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 22, fontWeight: 400, color: '#0f0f0f' }}>
                  {editId ? 'Edit job' : 'Add new job'}
                </h2>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 20, color: '#9b9b9b' }}>×</button>
              </div>

              {error && (
                <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fef2f2',
                  border: '1px solid #fecaca', borderRadius: 10, fontSize: 14, color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Job title *',  key: 'title',    ph: 'Software Engineer' },
                  { label: 'Company *',    key: 'company',  ph: 'Accenture' },
                  { label: 'Location',     key: 'location', ph: 'Hyderabad / Remote' },
                  { label: 'Country',      key: 'country',  ph: 'India' },
                  { label: 'Apply URL',    key: 'apply_url',ph: 'https://careers.company.com/job/123' },
                  { label: 'Role category',key: 'role_category', ph: 'SDE / ML / Data' },
                ].map(({ label, key, ph }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>{label}</label>
                    <input style={inp} value={(form as Record<string,unknown>)[key] as string ?? ''}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={ph} />
                  </div>
                ))}

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>
                    Required skills / tags (comma-separated)
                  </label>
                  <input style={inp} value={skillsInput}
                    onChange={e => setSkillsInput(e.target.value)}
                    placeholder="Java, Spring Boot, React, SQL" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>
                      Min experience (yrs)
                    </label>
                    <input style={inp} type="number" step="0.5" min="0"
                      value={form.required_experience_min}
                      onChange={e => setForm(p => ({ ...p, required_experience_min: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>
                      Max experience (yrs)
                    </label>
                    <input style={inp} type="number" step="0.5" min="0"
                      value={form.required_experience_max ?? ''}
                      onChange={e => setForm(p => ({ ...p, required_experience_max: e.target.value ? parseFloat(e.target.value) : null }))} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>
                    Eligible graduation year
                  </label>
                  <input style={inp} type="number" placeholder="e.g. 2026, leave blank for all years"
                    value={form.required_passout_year ?? ''}
                    onChange={e => setForm(p => ({ ...p, required_passout_year: e.target.value ? parseInt(e.target.value) : null }))} />
                  <p style={{ fontSize: 11, color: '#b5b5b5', marginTop: 4 }}>
                    Only students who selected this graduation year will see the job. Leave blank to show it to everyone.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>
                      Min salary (₹)
                    </label>
                    <input style={inp} type="number"
                      value={form.salary_min ?? ''}
                      onChange={e => setForm(p => ({ ...p, salary_min: e.target.value ? parseFloat(e.target.value) : null }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>
                      Max salary (₹)
                    </label>
                    <input style={inp} type="number"
                      value={form.salary_max ?? ''}
                      onChange={e => setForm(p => ({ ...p, salary_max: e.target.value ? parseFloat(e.target.value) : null }))} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>Job type</label>
                    <select value={form.job_type ?? 'full-time'}
                      onChange={e => setForm(p => ({ ...p, job_type: e.target.value }))}
                      style={{ ...inp, appearance: 'none' as const }}>
                      {['full-time','internship','contract','part-time'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>Work mode</label>
                    <select value={form.work_mode ?? ''}
                      onChange={e => setForm(p => ({ ...p, work_mode: (e.target.value || null) as typeof form.work_mode }))}
                      style={{ ...inp, appearance: 'none' as const }}>
                      <option value="">Not specified</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">Onsite</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>
                    Last date to apply
                  </label>
                  <input style={inp} type="date" value={form.last_date ?? ''}
                    onChange={e => setForm(p => ({ ...p, last_date: e.target.value || null }))} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>Description</label>
                  <textarea rows={4} value={form.description ?? ''}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Job description, responsibilities, requirements…"
                    style={{ ...inp, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.6 }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 8 }}>
                    Plan visibility: which plans see this job
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['free', 'basic', 'pro', 'maxpro'] as SubscriptionPlan[]).map(plan => {
                      const on = form.plan_visibility.includes(plan)
                      return (
                        <button key={plan} type="button" onClick={() => togglePlanVisibility(plan)} style={{
                          flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                          background: on ? '#0f0f0f' : '#f5f5f5',
                          color: on ? '#fff' : '#9b9b9b',
                          border: 'none',
                        }}>{PLAN_LABELS[plan]}</button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 8 }}>
                    Status
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['draft', 'published', 'inactive'] as JobStatus[]).map(s => {
                      const on = form.status === s
                      return (
                        <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))} style={{
                          flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                          background: on ? STATUS_META[s].color : '#f5f5f5',
                          color: on ? '#fff' : '#9b9b9b',
                          border: 'none',
                        }}>{STATUS_META[s].label}</button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button onClick={() => handleSave()} disabled={saving} style={{
                    flex: 1, height: 46, background: saving ? '#6b6b6b' : '#f5f5f5', color: '#0f0f0f',
                    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Inter',sans-serif",
                  }}>
                    {saving ? 'Saving…' : 'Save as draft'}
                  </button>
                  <button onClick={() => handleSave(true)} disabled={saving} style={{
                    flex: 1, height: 46, background: saving ? '#6b6b6b' : '#16a34a', color: '#fff',
                    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Inter',sans-serif",
                  }}>
                    {saving ? 'Publishing…' : 'Publish now'}
                  </button>
                </div>
                <button onClick={() => setShowForm(false)} style={{
                  height: 40, background: 'none', color: '#9b9b9b',
                  border: 'none', fontSize: 13, cursor: 'pointer',
                  fontFamily: "'Inter',sans-serif",
                }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 28, fontWeight: 400, color: '#0f0f0f' }}>
            Jobs ({filteredJobs.length}{search || statusFilter !== 'all' ? ` of ${jobs.length}` : ''})
          </h1>
        </div>

        {loadErr && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
            Couldn't load jobs: {loadErr}
          </div>
        )}

        {jobs.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, company, or location…"
              style={{
                flex: 1, height: 42, padding: '0 14px',
                fontSize: 14, fontFamily: "'Inter',sans-serif", color: '#0f0f0f',
                background: '#fff', border: '1.5px solid #e5e5e5', borderRadius: 10,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              style={{ height: 42, padding: '0 12px', fontSize: 14, fontFamily: "'Inter',sans-serif",
                color: '#0f0f0f', background: '#fff', border: '1.5px solid #e5e5e5', borderRadius: 10,
                outline: 'none' }}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 14, color: '#b5b5b5' }}>Loading…</div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 15, color: '#9b9b9b', marginBottom: 16 }}>No jobs yet.</p>
            <button onClick={openNew} style={{
              padding: '10px 20px', background: '#0f0f0f', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Inter',sans-serif",
            }}>Add first job →</button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 14, color: '#b5b5b5' }}>
            No jobs match your filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredJobs.map(job => {
              const st = STATUS_META[job.status] ?? STATUS_META.draft
              return (
                <div key={job.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', background: '#fff',
                  border: `1.5px solid #f0f0f0`, borderLeft: `3px solid ${st.color}`,
                  borderRadius: 12, gap: 12,
                  opacity: job.status === 'inactive' ? 0.65 : 1,
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 500, color: '#0f0f0f', marginBottom: 3,
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {job.title}
                      <span style={{ fontSize: 10, fontWeight: 700, color: st.color,
                        background: st.bg, padding: '2px 8px', borderRadius: 99 }}>
                        {st.label.toUpperCase()}
                      </span>
                      {job.apply_url && urlCounts[job.apply_url] > 1 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309',
                          background: '#fef3c7', padding: '2px 8px', borderRadius: 99 }}>
                          DUPLICATE URL
                        </span>
                      )}
                      {job.required_passout_year && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb',
                          background: '#eff6ff', padding: '2px 8px', borderRadius: 99 }}>
                          {job.required_passout_year} BATCH ONLY
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 13, color: '#9b9b9b', marginBottom: 6 }}>
                      {job.company}, {job.job_type}, {job.location || 'Remote'}
                      {job.required_experience_min > 0 && `, ${job.required_experience_min}${job.required_experience_max ? `-${job.required_experience_max}` : '+'}y exp`}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                      {(job.required_skills ?? []).slice(0, 6).map(s => (
                        <span key={s} style={{ fontSize: 11, padding: '2px 8px', background: '#f0f0f0',
                          color: '#6b6b6b', borderRadius: 99 }}>{s}</span>
                      ))}
                      {(job.required_skills?.length ?? 0) > 6 && (
                        <span style={{ fontSize: 11, color: '#b5b5b5' }}>+{job.required_skills.length - 6} more</span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: '#b5b5b5' }}>
                      Visible to: {(job.plan_visibility ?? []).map(p => PLAN_LABELS[p]).join(', ') || 'None'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', maxWidth: 200, justifyContent: 'flex-end' }}>
                    <button onClick={() => openEdit(job)} style={{
                      padding: '7px 14px', background: '#f5f5f5', color: '#0f0f0f',
                      border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                      fontFamily: "'Inter',sans-serif",
                    }}>Edit</button>
                    {job.status !== 'published' && (
                      <button onClick={() => setStatus(job, 'published')} style={{
                        padding: '7px 14px', background: '#f0fdf4', color: '#16a34a',
                        border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                        fontFamily: "'Inter',sans-serif",
                      }}>Publish</button>
                    )}
                    {job.status === 'published' && (
                      <button onClick={() => setStatus(job, 'draft')} style={{
                        padding: '7px 14px', background: '#f5f5f5', color: '#6b6b6b',
                        border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                        fontFamily: "'Inter',sans-serif",
                      }}>Unpublish</button>
                    )}
                    <button onClick={() => deleteJob(job)} style={{
                      padding: '7px 14px', background: '#fef2f2', color: '#dc2626',
                      border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                      fontFamily: "'Inter',sans-serif",
                    }}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
