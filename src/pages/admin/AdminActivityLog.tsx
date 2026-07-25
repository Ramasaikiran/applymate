import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type ActivityLogEntry, type Profile } from '../../lib/supabase'
import AdminNav from './AdminNav'

interface FeedItem extends ActivityLogEntry {
 admin_name?: string
 target_name?: string
}

const ACTION_LABEL: Record<string, string> = {
 applied_job: 'applied for',
 updated_status: 'updated status for',
 subscription_change: 'updated subscription for',
}

const ACTION_ICON: Record<string, string> = {
 applied_job: '', updated_status: '', subscription_change: '',
}

export default function AdminActivityLog() {
 const [feed, setFeed] = useState<FeedItem[]>([])
 const [loading, setLoading] = useState(true)
 const [filter, setFilter] = useState<'all' | keyof typeof ACTION_LABEL>('all')
 const [search, setSearch] = useState('')
 const [loadErr, setLoadErr] = useState<string | null>(null)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true); setLoadErr(null)
 const { data: logs, error } = await supabase.from('admin_activity_log')
 .select('*').order('created_at', { ascending: false }).limit(200)

 if (error) { console.error('Activity log load error:', error); setLoadErr(error.message); setLoading(false); return }
 if (!logs || logs.length === 0) { setFeed([]); setLoading(false); return }

 const ids = Array.from(new Set([
 ...logs.map(l => l.admin_id).filter(Boolean),
 ...logs.map(l => l.target_user_id).filter(Boolean),
 ])) as string[]

 const { data: people } = await supabase.from('profiles').select('id, full_name, email').in('id', ids)
 const nameMap = new Map((people as Pick<Profile,'id'|'full_name'>[] ?? []).map(p => [p.id, p.full_name]))

 setFeed((logs as ActivityLogEntry[]).map(l => ({
 ...l,
 admin_name: l.admin_name ?? (l.admin_id ? nameMap.get(l.admin_id) ?? 'Admin' : 'System'),
 target_name: l.target_name ?? (l.target_user_id ? nameMap.get(l.target_user_id) ?? 'a user' : 'a deleted user'),
 })))
 setLoading(false)
 }

 const filtered = feed.filter(item => {
 if (filter !== 'all' && item.action !== filter) return false
 if (!search.trim()) return true
 const q = search.toLowerCase()
 return item.admin_name?.toLowerCase().includes(q)
 || item.target_name?.toLowerCase().includes(q)
 || item.details?.toLowerCase().includes(q)
 })

 const inp: React.CSSProperties = {
 height: 42, padding: '0 14px', fontSize: 14, color: '#0f0f0f',
 border: '1.5px solid #e5e5e5', borderRadius: 10, background: '#fff',
 fontFamily: "'Inter',sans-serif", outline: 'none',
 }

 return (
 <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
 <AdminNav title="Activity log" />

 <div style={{ maxWidth: 920, margin: '0 auto', padding: '36px 24px' }}>
 <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 28, fontWeight: 400,
 color: '#0f0f0f', marginBottom: 20 }}>Activity log</h1>

 {loadErr && (
 <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fef2f2',
 border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
 Couldn't load activity log: {loadErr}
 </div>
 )}

 <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
 <input style={{ ...inp, width: 260 }} placeholder="Search admin, user, details…"
 value={search} onChange={e => setSearch(e.target.value)} />
 <select style={inp} value={filter} onChange={e => setFilter(e.target.value as never)}>
 <option value="all">All actions</option>
 <option value="applied_job">Applications</option>
 <option value="updated_status">Status updates</option>
 <option value="subscription_change">Subscription changes</option>
 </select>
 </div>

 {loading ? (
 <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 14, color: '#b5b5b5' }}>Loading…</div>
 ) : filtered.length === 0 ? (
 <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 14, color: '#b5b5b5' }}>No matching activity.</div>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 {filtered.map(item => (
 <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12,
 padding: '14px 18px', background: '#fff', border: '1.5px solid #f0f0f0', borderRadius: 12 }}>
 <span style={{ fontSize: 16, marginTop: 1 }}>{ACTION_ICON[item.action] ?? '•'}</span>
 <div style={{ flex: 1 }}>
 <p style={{ fontSize: 14, color: '#0f0f0f' }}>
 <strong>{item.admin_name}</strong> {ACTION_LABEL[item.action] ?? item.action}{' '}
 {item.target_user_id ? (
 <Link to={`/admin/users/${item.target_user_id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{item.target_name}</Link>
 ) : item.target_name}
 </p>
 {item.details && <p style={{ fontSize: 13, color: '#9b9b9b', marginTop: 2 }}>{item.details}</p>}
 </div>
 <span style={{ fontSize: 12, color: '#b5b5b5', flexShrink: 0, whiteSpace: 'nowrap' }}>
 {new Date(item.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 )
}
