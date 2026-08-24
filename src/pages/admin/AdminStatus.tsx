import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { StatusComponent, StatusIncident, ComponentStatus, IncidentStatus } from '../../lib/supabase'
import AdminNav from './AdminNav'

const COMPONENT_STATUSES: ComponentStatus[] = ['operational', 'degraded', 'down']
const INCIDENT_STATUSES: IncidentStatus[] = ['investigating', 'monitoring', 'resolved']

const STATUS_META: Record<ComponentStatus, { label: string; color: string; bg: string }> = {
  operational: { label: 'Operational', color: '#16a34a', bg: '#f0fdf4' },
  degraded:    { label: 'Degraded',    color: '#d97706', bg: '#fffbeb' },
  down:        { label: 'Down',        color: '#dc2626', bg: '#fef2f2' },
}

const BLANK_INCIDENT = { title: '', message: '', component_id: '', status: 'investigating' as IncidentStatus }

export default function AdminStatus() {
  const [components, setComponents] = useState<StatusComponent[]>([])
  const [incidents, setIncidents] = useState<StatusIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [savingComponent, setSavingComponent] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_INCIDENT)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setLoadErr(null)
    const [compRes, incRes] = await Promise.all([
      supabase.from('status_components').select('*').order('sort_order'),
      supabase.from('status_incidents').select('*').order('created_at', { ascending: false }),
    ])
    if (compRes.error || incRes.error) {
      setLoadErr(compRes.error?.message || incRes.error?.message || 'Failed to load.')
    }
    setComponents((compRes.data as StatusComponent[]) ?? [])
    setIncidents((incRes.data as StatusIncident[]) ?? [])
    setLoading(false)
  }

  async function updateComponentStatus(id: string, status: ComponentStatus) {
    setSavingComponent(id)
    const { error: err } = await supabase.from('status_components')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (err) {
      setLoadErr(err.message)
    } else {
      setComponents(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    }
    setSavingComponent(null)
  }

  async function postIncident(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.message.trim()) { setError('Title and message are required.'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('status_incidents').insert({
      title: form.title.trim(),
      message: form.message.trim(),
      component_id: form.component_id || null,
      status: form.status,
      resolved_at: form.status === 'resolved' ? new Date().toISOString() : null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(BLANK_INCIDENT); setShowForm(false)
    load()
  }

  async function updateIncidentStatus(id: string, status: IncidentStatus) {
    const { error: err } = await supabase.from('status_incidents').update({
      status,
      updated_at: new Date().toISOString(),
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    }).eq('id', id)
    if (err) { setLoadErr(err.message); return }
    load()
  }

  const inp: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 14px', fontSize: 14, color: '#0f0f0f',
    border: '1.5px solid #e5e5e5', borderRadius: 10, background: '#fff',
    fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
      <AdminNav title="Status Page" />
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 28px',
        background: '#fff', borderBottom: '1.5px solid #f0f0f0', gap: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>Status Page</span>
        <a href="/status" target="_blank" rel="noopener noreferrer" style={{
          marginLeft: 'auto', fontSize: 13, color: '#6b6b6b', textDecoration: 'none' }}>
          View public page →
        </a>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px 80px' }}>
        {loadErr && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
            {loadErr}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 14, color: '#b5b5b5' }}>Loading…</div>
        ) : (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f0f0f', marginBottom: 14 }}>Components</h2>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden', marginBottom: 36, background: '#fff' }}>
              {components.map((c, i) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', borderTop: i === 0 ? 'none' : '1px solid #f5f5f5',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>{c.name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {COMPONENT_STATUSES.map(s => (
                      <button key={s} disabled={savingComponent === c.id}
                        onClick={() => updateComponentStatus(c.id, s)}
                        style={{
                          padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                          cursor: savingComponent === c.id ? 'default' : 'pointer',
                          border: c.status === s ? `1.5px solid ${STATUS_META[s].color}` : '1.5px solid #e5e5e5',
                          background: c.status === s ? STATUS_META[s].bg : '#fff',
                          color: c.status === s ? STATUS_META[s].color : '#9b9b9b',
                          opacity: savingComponent === c.id ? 0.5 : 1,
                        }}>
                        {STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f0f0f' }}>Incidents</h2>
              <button onClick={() => { setShowForm(v => !v); setError(null) }} style={{
                padding: '8px 16px', background: showForm ? '#f5f5f5' : '#0f0f0f',
                color: showForm ? '#0f0f0f' : '#fff', border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              }}>
                {showForm ? 'Cancel' : '+ Post incident'}
              </button>
            </div>

            {showForm && (
              <form onSubmit={postIncident} style={{
                border: '1px solid #f0f0f0', borderRadius: 12, padding: 18,
                background: '#fff', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                {error && (
                  <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: 8, fontSize: 13, color: '#dc2626' }}>{error}</div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>Title</label>
                  <input style={inp} value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Payment confirmations delayed" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>Component</label>
                  <select value={form.component_id} onChange={e => setForm(p => ({ ...p, component_id: e.target.value }))}
                    style={{ ...inp, appearance: 'none' as const }}>
                    <option value="">General / not component-specific</option>
                    {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 5 }}>Message</label>
                  <textarea rows={3} value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="What's happening, and what users should expect."
                    style={{ ...inp, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 8 }}>Status</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {INCIDENT_STATUSES.map(s => (
                      <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))} style={{
                        padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: form.status === s ? '1.5px solid #0f0f0f' : '1.5px solid #e5e5e5',
                        background: form.status === s ? '#0f0f0f' : '#fff',
                        color: form.status === s ? '#fff' : '#9b9b9b',
                      }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={saving} style={{
                  padding: '12px', background: '#0f0f0f', color: '#fff', border: 'none',
                  borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
                  fontFamily: "'Inter',sans-serif", opacity: saving ? 0.6 : 1,
                }}>
                  {saving ? 'Posting…' : 'Post incident'}
                </button>
              </form>
            )}

            {incidents.length === 0 && !showForm && (
              <p style={{ fontSize: 13, color: '#9b9b9b' }}>No incidents yet.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {incidents.map(inc => (
                <div key={inc.id} style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: 14, background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f0f0f' }}>{inc.title}</span>
                    <select value={inc.status} onChange={e => updateIncidentStatus(inc.id, e.target.value as IncidentStatus)}
                      style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999,
                        border: '1.5px solid #e5e5e5', background: '#fff', color: '#6b6b6b',
                        fontFamily: "'Inter',sans-serif", outline: 'none' }}>
                      {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <p style={{ fontSize: 13, color: '#3b3b3b', lineHeight: 1.6, marginBottom: 4 }}>{inc.message}</p>
                  <p style={{ fontSize: 12, color: '#b5b5b5' }}>
                    {new Date(inc.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
