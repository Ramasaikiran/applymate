import { useEffect, useState } from 'react'
import { supabase, type Recruiter, type RecruiterStatus } from '../../lib/supabase'
import AdminNav from './AdminNav'

type Row = Recruiter & { profiles: { full_name: string; email: string } | null }
const FILTERS: (RecruiterStatus | 'all')[] = ['pending', 'approved', 'rejected', 'suspended', 'all']
const COLOR: Record<RecruiterStatus, string> = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626', suspended: '#6b6b6b' }

export default function AdminRecruiters() {
  const [rows, setRows] = useState<Row[]>([])
  const [filter, setFilter] = useState<RecruiterStatus | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error: err } = await supabase.from('recruiters')
      .select('*, profiles!recruiters_id_fkey(full_name,email)').order('created_at', { ascending: false })
    if (err) setError(err.message)
    setRows((data ?? []) as unknown as Row[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function review(r: Row, status: 'approved' | 'rejected' | 'suspended') {
    const note = (notes[r.id] ?? '').trim()
    if (status !== 'approved' && !note) { setError('Add a reason before rejecting or suspending.'); return }
    setBusy(r.id); setError(null)
    const { data, error: err } = await supabase.rpc('admin_review_recruiter', {
      p_recruiter_id: r.id, p_status: status, p_note: note || null,
    })
    setBusy(null)
    if (err || !data?.ok) { setError(data?.error ?? err?.message ?? 'Failed'); return }
    load()
  }

  const shown = rows.filter(r => filter === 'all' || r.status === filter)
  const link = (u: string) => <a href={u} target="_blank" rel="noopener noreferrer" style={{ color: '#0f0f0f' }}>{u}</a>

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
      <AdminNav title="Admin" />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 28, fontWeight: 400, margin: '0 0 16px' }}>Recruiters</h1>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: 99, border: '1px solid #e5e5e5', cursor: 'pointer', textTransform: 'capitalize',
              fontSize: 12.5, fontWeight: 600, fontFamily: "'Inter',sans-serif",
              background: filter === f ? '#0f0f0f' : '#fff', color: filter === f ? '#fff' : '#6b6b6b' }}>
              {f}{f !== 'all' ? ` (${rows.filter(r => r.status === f).length})` : ''}
            </button>
          ))}
        </div>
        {error && <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: 12, fontSize: 13.5, color: '#dc2626', marginBottom: 14 }}>{error}</div>}
        {loading && <p style={{ color: '#9b9b9b' }}>Loading…</p>}
        {!loading && shown.length === 0 && <p style={{ color: '#9b9b9b', textAlign: 'center', padding: 40 }}>No recruiters here.</p>}
        <div style={{ display: 'grid', gap: 12 }}>
          {shown.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 2px' }}>{r.company_name}</p>
                  <p style={{ fontSize: 12.5, color: '#9b9b9b', margin: 0 }}>{r.profiles?.full_name} · {r.designation}</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: COLOR[r.status], textTransform: 'capitalize' }}>{r.status}</span>
              </div>
              <div style={{ fontSize: 13, color: '#3b3b3b', lineHeight: 1.9, margin: '12px 0', wordBreak: 'break-all' }}>
                <div>Work email: {r.work_email}</div>
                <div>Website: {link(r.company_website)}</div>
                <div>LinkedIn: {link(r.linkedin_url)}</div>
                <div>GSTIN: {r.gstin || '—'} · CIN: {r.cin || '—'}</div>
                {r.review_note && <div style={{ color: '#6b6b6b' }}>Last note: {r.review_note}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input placeholder="Reason (required to reject or suspend)" value={notes[r.id] ?? ''}
                  onChange={e => setNotes(p => ({ ...p, [r.id]: e.target.value }))}
                  style={{ flex: 1, minWidth: 200, height: 38, padding: '0 12px', border: '1.5px solid #e5e5e5', borderRadius: 8, fontSize: 13, fontFamily: "'Inter',sans-serif" }} />
                {r.status !== 'approved' && (
                  <button disabled={busy === r.id} onClick={() => review(r, 'approved')}
                    style={{ height: 38, padding: '0 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Approve</button>
                )}
                {r.status === 'pending' && (
                  <button disabled={busy === r.id} onClick={() => review(r, 'rejected')}
                    style={{ height: 38, padding: '0 16px', background: '#fff', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Reject</button>
                )}
                {r.status === 'approved' && (
                  <button disabled={busy === r.id} onClick={() => review(r, 'suspended')}
                    style={{ height: 38, padding: '0 16px', background: '#fff', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Suspend</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
