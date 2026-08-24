import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { StatusComponent, StatusIncident, ComponentStatus } from '../lib/supabase'

const STATUS_COPY: Record<ComponentStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded performance',
  down: 'Down',
}
const STATUS_COLOR: Record<ComponentStatus, string> = {
  operational: '#22c55e',
  degraded: '#f59e0b',
  down: '#ef4444',
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function Status() {
  const [components, setComponents] = useState<StatusComponent[] | null>(null)
  const [incidents, setIncidents] = useState<StatusIncident[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [compRes, incRes] = await Promise.all([
        supabase.from('status_components').select('*').order('sort_order'),
        supabase.from('status_incidents').select('*').order('created_at', { ascending: false }).limit(10),
      ])
      if (cancelled) return
      if (compRes.error || incRes.error) {
        setErr(compRes.error?.message || incRes.error?.message || 'Could not load status.')
        return
      }
      setComponents(compRes.data as StatusComponent[])
      setIncidents(incRes.data as StatusIncident[])
    }
    load()
    return () => { cancelled = true }
  }, [])

  const worst: ComponentStatus =
    components?.some(c => c.status === 'down') ? 'down' :
    components?.some(c => c.status === 'degraded') ? 'degraded' : 'operational'

  const bannerCopy = {
    operational: 'All systems operational',
    degraded: 'Some systems are experiencing issues',
    down: 'A system is down',
  }[worst]

  const byId = new Map((components || []).map(c => [c.id, c.name]))

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: "'Inter',sans-serif" }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px 80px' }}>
        <Link to="/" style={{ fontSize: 13, color: '#9b9b9b', textDecoration: 'none' }}>← Back to Home</Link>

        <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 32,
          color: '#0f0f0f', margin: '20px 0 6px' }}>ApplyMate Status</h1>
        <p style={{ fontSize: 13, color: '#9b9b9b', marginBottom: 28 }}>
          Live status of ApplyMate's website, database, application engine, and payments.
        </p>

        {err && (
          <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 20 }}>{err}</p>
        )}

        {!err && !components && (
          <p style={{ fontSize: 13, color: '#9b9b9b' }}>Loading…</p>
        )}

        {!err && components && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '16px 20px', borderRadius: 12,
              background: worst === 'operational' ? '#f0fdf4' : worst === 'degraded' ? '#fffbeb' : '#fef2f2',
              border: `1px solid ${worst === 'operational' ? '#bbf7d0' : worst === 'degraded' ? '#fde68a' : '#fecaca'}`,
              marginBottom: 28,
            }}>
              <Dot color={STATUS_COLOR[worst]} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0f0f0f' }}>{bannerCopy}</span>
            </div>

            <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden', marginBottom: 36 }}>
              {components.map((c, i) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderTop: i === 0 ? 'none' : '1px solid #f5f5f5',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>{c.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Dot color={STATUS_COLOR[c.status]} />
                    <span style={{ fontSize: 13, color: STATUS_COLOR[c.status], fontWeight: 600 }}>
                      {STATUS_COPY[c.status]}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f0f0f', marginBottom: 14 }}>
              Recent incidents
            </h2>
            {incidents && incidents.length === 0 && (
              <p style={{ fontSize: 13, color: '#9b9b9b' }}>No incidents reported.</p>
            )}
            {incidents && incidents.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {incidents.map(inc => (
                  <div key={inc.id} style={{ borderLeft: `2px solid ${inc.status === 'resolved' ? '#d4d4d4' : '#f59e0b'}`, paddingLeft: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f0f0f' }}>{inc.title}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: inc.status === 'resolved' ? '#6b6b6b' : '#f59e0b',
                      }}>
                        {inc.status}
                      </span>
                    </div>
                    {inc.component_id && byId.get(inc.component_id) && (
                      <p style={{ fontSize: 12, color: '#9b9b9b', marginBottom: 4 }}>{byId.get(inc.component_id)}</p>
                    )}
                    <p style={{ fontSize: 13, color: '#3b3b3b', lineHeight: 1.6, marginBottom: 4 }}>{inc.message}</p>
                    <p style={{ fontSize: 12, color: '#b5b5b5' }}>{fmtDate(inc.created_at)}</p>
                  </div>
                ))}
     </div>
 )}
 </>
 )}

 <div style={{
 marginTop: 44, padding: '22px 24px', borderRadius: 12,
 background: '#f7f7f7', textAlign: 'center',
 }}>
 <p style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f', marginBottom: 16 }}>
 Have any other queries?
 </p>
 <a href="mailto:support@applymate.in" style={{
 display: 'inline-block', padding: '12px 28px', background: '#0f0f0f', color: '#fff',
 borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
 fontFamily: "'Inter',sans-serif",
 }}>
 Ask your query
 </a>
 </div>
 </div>
 </div>
 )
}
