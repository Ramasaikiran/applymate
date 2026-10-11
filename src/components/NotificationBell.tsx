import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, type AppNotification } from '../lib/supabase'

const POLL_MS = 60_000

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// Reads the signed-in user's own notifications (RLS: select/update own only).
export default function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*')
      .order('created_at', { ascending: false }).limit(20)
    if (data) setItems(data as AppNotification[])
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const unread = items.filter(n => !n.is_read).length

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      await load()
      const ids = items.filter(n => !n.is_read).map(n => n.id)
      if (ids.length) {
        await supabase.from('notifications').update({ is_read: true }).in('id', ids)
        // keep the dots visible for this open, clear on next load
        setTimeout(load, 4000)
      }
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={toggle} aria-label="Notifications" style={{
        position: 'relative', background: '#f5f5f5', border: 'none', borderRadius: 7,
        width: 34, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f0f0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 99, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 42, width: 320, maxHeight: 420, overflowY: 'auto',
          background: '#fff', border: '1px solid #ececec', borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 100, fontFamily: "'Inter',sans-serif" }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, padding: '12px 14px', borderBottom: '1px solid #f3f3f3' }}>Notifications</p>
          {items.length === 0 && <p style={{ fontSize: 13, color: '#9b9b9b', padding: 16, margin: 0 }}>Nothing yet.</p>}
          {items.map(n => (
            <div key={n.id} style={{ padding: '12px 14px', borderBottom: '1px solid #f7f7f7',
              background: n.is_read ? '#fff' : '#fafaf7' }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: '#0f0f0f' }}>
                {n.type === 'profile_view' ? '👁 ' : ''}{n.title}
              </p>
              {n.message && <p style={{ fontSize: 12.5, color: '#6b6b6b', margin: '0 0 4px', lineHeight: 1.5 }}>{n.message}</p>}
              <p style={{ fontSize: 11, color: '#b5b5b5', margin: 0 }}>{ago(n.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
