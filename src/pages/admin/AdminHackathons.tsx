import { useEffect, useState } from 'react'
import { supabase, type Hackathon, type HackathonStatus } from '../../lib/supabase'
import AdminNav from './AdminNav'

const BLANK: Omit<Hackathon,'id'|'posted_at'|'updated_at'> = {
  title: '', organizer: '', description: '', mode: null, location: '',
  tags: [], prize_pool: '', team_size_min: null, team_size_max: null,
  register_url: '', start_date: null, end_date: null, last_date: null,
  status: 'draft', is_active: true,
}

const STATUS_META: Record<HackathonStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#9b9b9b', bg: '#f5f5f5' },
  published: { label: 'Published', color: '#16a34a', bg: '#f0fdf4' },
  inactive:  { label: 'Inactive',  color: '#dc2626', bg: '#fef2f2' },
}

export default function AdminHackathons() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof BLANK>(BLANK)
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | HackathonStatus>('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setLoadErr(null)
    const { data, error: err } = await supabase.from('hackathons').select('*').order('posted_at', { ascending: false })
    if (err) { console.error('Hackathons load error:', err); setLoadErr(err.message) }
    setHackathons((data as Hackathon[]) ?? [])
    setLoading(false)
  }

  const filtered = hackathons.filter(h => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || h.title.toLowerCase().includes(q) ||
      h.organizer.toLowerCase().includes(q) || (h.location ?? '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || h.status === statusFilter
    return matchesSearch && matchesStatus
  })

  function openNew() {
    setForm(BLANK); setTagsInput(''); setEditId(null); setError(null); setShowForm(true)
  }

  function openEdit(h: Hackathon) {
    setForm({
      title: h.title, organizer: h.organizer, description: h.description ?? '',
      mode: h.mode, location: h.location ?? '', tags: h.tags,
      prize_pool: h.prize_pool ?? '', team_size_min: h.team_size_min, team_size_max: h.team_size_max,
      register_url: h.register_url ?? '', start_date: h.start_date, end_date: h.end_date, last_date: h.last_date,
      status: h.status, is_active: h.is_active,
    })
    setTagsInput(h.tags.join(', '))
    setEditId(h.id); setError(null); setShowForm(true)
  }

  async function handleSave(publishNow?: boolean) {
    if (!form.title.trim() || !form.organizer.trim()) { setError('Title and organizer are required.'); return }
    setSaving(true); setError(null)
    const payload = {
      ...form,
      status: publishNow ? 'published' : form.status,
      tags: tagsInput.split(',').map(s => s.trim()).filter(Boolean),
    }
    const { error: dbErr } = editId
      ? await supabase.from('hackathons').update(payload).eq('id', editId)
      : await supabase.from('hackathons').insert(payload)
    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    setSaving(false); setShowForm(false)
    await load()
  }

  async function setStatus(h: Hackathon, status: HackathonStatus) {
    await supabase.from('hackathons').update({ status }).eq('id', h.id)
    setHackathons(prev => prev.map(x => x.id === h.id ? { ...x, status } : x))
  }

  async function deleteHackathon(h: Hackathon) {
    if (!confirm(`Delete "${h.title}" by ${h.organizer}? This can't be undone.`)) return
    await supabase.from('hackathons').delete().eq('id', h.id)
    setHackathons(prev => prev.filter(x => x.id !== h.id))
  }

  const inp: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 14px', fontSize: 14, color: '#0f0f0f',
    border: '1.5px solid #e5e5e5', borderRadius: 10, background: '#fff',
    fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
      <AdminNav title="Hackathons" />
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 28px',
        background: '#fff', borderBottom: '1.5px solid #f0f0f0', gap: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>Hackathons</span>
        <button onClick={openNew} style={{
          marginLeft: 'auto', padding: '8px 18px', background: '#0f0f0f', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: "'Inter',sans-serif",
        }}>+ Add hackathon</button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '36px 24px' }}>

        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px',
              width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 22, fontWeight: 400, color: '#0f0f0f' }}>
                  {editId ? 'Edit hackathon' : 'Add new hackathon'}
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
                  { label: 'Hackathon title *', key: 'title',        ph: 'Smart India Hackathon' },
                  { label: 'Organizer *',       key: 'organizer',    ph: 'Ministry of Education' },
                  { label: 'Location',          key: 'location',     ph: 'Hyderabad / Online' },
                  { label: 'Prize pool',        key: 'prize_pool',   ph: '₹1,00,000' },
                  { label: 'Register URL',      key: 'register_url', ph: 'https://hackathon.com/register' },
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
                    Tags (comma-separated)
                  </label>
                  <input style={inp} value={tagsInput}
                    onChange={e => setTagsInput(e.target.value)}
                    placeholder="AI, Fintech, Open Innovation" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>
                      Min team size
                    </label>
                    <input style={inp} type="number" min="1"
                      value={form.team_size_min ?? ''}
                      onChange={e => setForm(p => ({ ...p, team_size_min: e.target.value ? parseInt(e.target.value, 10) : null }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>
                      Max team size
                    </label>
                    <input style={inp} type="number" min="1"
                      value={form.team_size_max ?? ''}
                      onChange={e => setForm(p => ({ ...p, team_size_max: e.target.value ? parseInt(e.target.value, 10) : null }))} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>Mode</label>
                  <select value={form.mode ?? ''}
                    onChange={e => setForm(p => ({ ...p, mode: (e.target.value || null) as typeof form.mode }))}
                    style={{ ...inp, appearance: 'none' as const }}>
                    <option value="">Not specified</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>Start date</label>
                    <input style={inp} type="date" value={form.start_date ?? ''}
                      onChange={e => setForm(p => ({ ...p, start_date: e.target.value || null }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>End date</label>
                    <input style={inp} type="date" value={form.end_date ?? ''}
                      onChange={e => setForm(p => ({ ...p, end_date: e.target.value || null }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>Register by</label>
                    <input style={inp} type="date" value={form.last_date ?? ''}
                      onChange={e => setForm(p => ({ ...p, last_date: e.target.value || null }))} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>Description</label>
                  <textarea rows={4} value={form.description ?? ''}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Theme, tracks, eligibility…"
                    style={{ ...inp, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.6 }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 8 }}>
                    Status
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['draft', 'published', 'inactive'] as HackathonStatus[]).map(s => {
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
            Hackathons ({filtered.length}{search || statusFilter !== 'all' ? ` of ${hackathons.length}` : ''})
          </h1>
        </div>

        {loadErr && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
            Couldn't load hackathons: {loadErr}
          </div>
        )}

        {hackathons.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, organizer, or location…"
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
        ) : hackathons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 15, color: '#9b9b9b', marginBottom: 16 }}>No hackathons yet.</p>
            <button onClick={openNew} style={{
              padding: '10px 20px', background: '#0f0f0f', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Inter',sans-serif",
            }}>Add first hackathon →</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 14, color: '#b5b5b5' }}>
            No hackathons match your filters.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(h => {
              const st = STATUS_META[h.status] ?? STATUS_META.draft
              return (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', background: '#fff',
                  border: `1.5px solid #f0f0f0`, borderLeft: `3px solid ${st.color}`,
                  borderRadius: 12, gap: 12,
                  opacity: h.status === 'inactive' ? 0.65 : 1,
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 500, color: '#0f0f0f', marginBottom: 3,
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {h.title}
                      <span style={{ fontSize: 10, fontWeight: 700, color: st.color,
                        background: st.bg, padding: '2px 8px', borderRadius: 99 }}>
                        {st.label.toUpperCase()}
                      </span>
                    </p>
                    <p style={{ fontSize: 13, color: '#9b9b9b', marginBottom: 6 }}>
                      {h.organizer}, {h.mode ?? 'mode n/a'}, {h.location || 'Online'}
                      {h.last_date && `, register by ${h.last_date}`}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {(h.tags ?? []).slice(0, 6).map(t => (
                        <span key={t} style={{ fontSize: 11, padding: '2px 8px', background: '#f0f0f0',
                          color: '#6b6b6b', borderRadius: 99 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', maxWidth: 200, justifyContent: 'flex-end' }}>
                    <button onClick={() => openEdit(h)} style={{
                      padding: '7px 14px', background: '#f5f5f5', color: '#0f0f0f',
                      border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                      fontFamily: "'Inter',sans-serif",
                    }}>Edit</button>
                    {h.status !== 'published' && (
                      <button onClick={() => setStatus(h, 'published')} style={{
                        padding: '7px 14px', background: '#f0fdf4', color: '#16a34a',
                        border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                        fontFamily: "'Inter',sans-serif",
                      }}>Publish</button>
                    )}
                    {h.status === 'published' && (
                      <button onClick={() => setStatus(h, 'draft')} style={{
                        padding: '7px 14px', background: '#f5f5f5', color: '#6b6b6b',
                        border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                        fontFamily: "'Inter',sans-serif",
                      }}>Unpublish</button>
                    )}
                    <button onClick={() => deleteHackathon(h)} style={{
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
