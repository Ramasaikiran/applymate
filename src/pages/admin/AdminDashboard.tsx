import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type AdminDashboardStats, type ActivityLogEntry, type Profile } from '../../lib/supabase'
import AdminNav from './AdminNav'

type FeedItem = ActivityLogEntry

const ACTION_LABEL: Record<string, string> = {
 applied_job: 'applied for',
 updated_status: 'updated status for',
 subscription_change: 'updated subscription for',
}

const ACTION_ICON: Record<string, string> = {
 applied_job: '', updated_status: '', subscription_change: '',
}

export default function AdminDashboard() {
 const [stats, setStats] = useState<AdminDashboardStats | null>(null)
 const [feed, setFeed] = useState<FeedItem[]>([])
 const [loadingFeed, setLoadingFeed] = useState(true)

 useEffect(() => { loadStats(); loadFeed() }, [])

 async function loadStats() {
 const { data, error } = await supabase.rpc('get_admin_dashboard_stats')
 if (!error && data) setStats(data as AdminDashboardStats)
 }

 async function loadFeed() {
 setLoadingFeed(true)
 const { data: logs } = await supabase.from('admin_activity_log')
 .select('*').order('created_at', { ascending: false }).limit(20)

 if (!logs || logs.length === 0) { setFeed([]); setLoadingFeed(false); return }

 const ids = Array.from(new Set([
 ...logs.map(l => l.admin_id).filter(Boolean),
 ...logs.map(l => l.target_user_id).filter(Boolean),
 ])) as string[]

 const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', ids)
 const nameMap = new Map((people as Pick<Profile,'id'|'full_name'>[] ?? []).map(p => [p.id, p.full_name]))

 setFeed((logs as ActivityLogEntry[]).map(l => ({
 ...l,
 admin_name: l.admin_name ?? (l.admin_id ? nameMap.get(l.admin_id) ?? 'Admin' : 'System'),
 target_name: l.target_name ?? (l.target_user_id ? nameMap.get(l.target_user_id) ?? 'a user' : 'a deleted user'),
 })))
 setLoadingFeed(false)
 }

 const cards = stats ? [
 { v: stats.total_users, l: 'Total users', c: '#0f0f0f' },
 { v: stats.active_subscribers, l: 'Active subscribers', c: '#2563eb' },
 { v: stats.apps_today, l: 'Applications today', c: '#16a34a' },
 { v: stats.apps_week, l: 'Applications this week', c: '#7c3aed' },
 { v: stats.apps_month, l: 'Applications this month', c: '#7c3aed' },
 { v: stats.total_interviews, l: 'Total interviews', c: '#d97706' },
 { v: stats.total_offers, l: 'Total offers', c: '#16a34a' },
 { v: stats.expiring_subscriptions,l: 'Expiring subscriptions', c: '#dc2626' },
 ] : []

 return (
 <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
 <AdminNav title="Admin Panel" />

 <div style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 24px' }}>
 <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 32, fontWeight: 400,
 color: '#0f0f0f', marginBottom: 28 }}>Overview</h1>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 36 }}>
 {stats ? cards.map(({ v, l, c }) => (
 <div key={l} style={{ background: '#fff', border: '1.5px solid #f0f0f0', borderRadius: 16, padding: '20px 22px' }}>
 <span style={{ fontSize: 34, fontWeight: 700, color: c }}>{v}</span>
 <p style={{ fontSize: 13, color: '#9b9b9b', marginTop: 4 }}>{l}</p>
 </div>
 )) : (
 <div style={{ fontSize: 14, color: '#b5b5b5' }}>Loading…</div>
 )}
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 40 }}>
 <Link to="/admin/users" style={{
 display: 'block', padding: '24px 22px', background: '#fff',
 border: '1.5px solid #f0f0f0', borderRadius: 16, textDecoration: 'none',
 }}>
 <p style={{ fontSize: 18, marginBottom: 6 }}></p>
 <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f0f', marginBottom: 4 }}>Manage users</p>
 <p style={{ fontSize: 13, color: '#9b9b9b' }}>Profiles, applications, apply on their behalf.</p>
 </Link>
 <Link to="/admin/subscriptions" style={{
 display: 'block', padding: '24px 22px', background: '#fff',
 border: '1.5px solid #f0f0f0', borderRadius: 16, textDecoration: 'none',
 }}>
 <p style={{ fontSize: 18, marginBottom: 6 }}></p>
 <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f0f', marginBottom: 4 }}>Subscriptions</p>
 <p style={{ fontSize: 13, color: '#9b9b9b' }}>Active, expiring, renew or cancel.</p>
 </Link>
 <Link to="/admin/jobs" style={{
 display: 'block', padding: '24px 22px', background: '#fff',
 border: '1.5px solid #f0f0f0', borderRadius: 16, textDecoration: 'none',
 }}>
 <p style={{ fontSize: 18, marginBottom: 6 }}></p>
 <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f0f', marginBottom: 4 }}>Job listings</p>
 <p style={{ fontSize: 13, color: '#9b9b9b' }}>Add, edit, deactivate openings.</p>
 </Link>
 <Link to="/admin/analytics" style={{
 display: 'block', padding: '24px 22px', background: '#fff',
 border: '1.5px solid #f0f0f0', borderRadius: 16, textDecoration: 'none',
 }}>
 <p style={{ fontSize: 18, marginBottom: 6 }}></p>
 <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f0f', marginBottom: 4 }}>Analytics</p>
 <p style={{ fontSize: 13, color: '#9b9b9b' }}>Conversion rates, top companies & roles.</p>
 </Link>
 </div>

 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
 <h2 style={{ fontSize: 17, fontWeight: 600, color: '#0f0f0f' }}>Recent activity</h2>
 <Link to="/admin/activity" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>View all →</Link>
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 {loadingFeed ? (
 <div style={{ fontSize: 14, color: '#b5b5b5', padding: '20px 0' }}>Loading…</div>
 ) : feed.length === 0 ? (
 <div style={{ fontSize: 14, color: '#b5b5b5', padding: '20px 0' }}>No activity yet.</div>
 ) : feed.slice(0, 8).map(item => (
 <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
 padding: '14px 18px', background: '#fff', border: '1.5px solid #f0f0f0', borderRadius: 12 }}>
 <span style={{ fontSize: 16 }}>{ACTION_ICON[item.action] ?? '•'}</span>
 <p style={{ fontSize: 14, color: '#0f0f0f', flex: 1 }}>
 <strong>{item.admin_name}</strong> {ACTION_LABEL[item.action] ?? item.action}{' '}
 {item.target_user_id && <Link to={`/admin/users/${item.target_user_id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{item.target_name}</Link>}
 {item.details && <span style={{ color: '#9b9b9b' }}> ({item.details})</span>}
 </p>
 <span style={{ fontSize: 12, color: '#b5b5b5', flexShrink: 0 }}>
 {new Date(item.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )
}
