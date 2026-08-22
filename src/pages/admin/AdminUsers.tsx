import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Profile } from '../../lib/supabase'
import AdminNav from './AdminNav'

interface UserRow extends Profile {
 sub_plan?: string | null
 sub_active?: boolean
 apps_count?: number
 skills?: string[]
 deletion_pending?: boolean
}

type SubFilter = 'all' | 'active' | 'expired' | 'none'

export default function AdminUsers() {
 const [users, setUsers] = useState<UserRow[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'professional'>('all')
 const [subFilter, setSubFilter] = useState<SubFilter>('active')
 const [loadErr, setLoadErr] = useState<string | null>(null)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true); setLoadErr(null)
 const { data: profiles, error } = await supabase
 .from('profiles').select('*').eq('is_admin', false)
 .order('created_at', { ascending: false })

 if (error) { console.error('Users load error:', error); setLoadErr(error.message); setLoading(false); return }
 if (!profiles) { setLoading(false); return }

 const { data: pendingReqs } = await supabase
 .from('profile_deletion_requests').select('user_id').eq('status', 'pending')
 const pendingIds = new Set((pendingReqs ?? []).map(r => r.user_id))

 const enriched: UserRow[] = await Promise.all(profiles.map(async (p) => {
 const [subRes, appRes, sdRes, pdRes] = await Promise.all([
 supabase.from('subscriptions').select('plan,status,ends_at')
 .eq('user_id', p.id).order('ends_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
 supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('user_id', p.id),
 supabase.from('student_details').select('technical_skills').eq('id', p.id).maybeSingle(),
 supabase.from('professional_details').select('technical_skills').eq('id', p.id).maybeSingle(),
 ])
 const active = !!subRes.data && subRes.data.status === 'active'
 && subRes.data.ends_at && new Date(subRes.data.ends_at) > new Date()
 return {
 ...p,
 sub_plan: subRes.data?.plan ?? null,
 sub_active: active,
 apps_count: appRes.count ?? 0,
 skills: sdRes.data?.technical_skills ?? pdRes.data?.technical_skills ?? [],
 deletion_pending: pendingIds.has(p.id),
 }
 }))
 setUsers(enriched)
 setLoading(false)
 }

 const filtered = users.filter(u => {
 const q = search.toLowerCase().trim()
 const matchesSearch = !q
 || u.full_name.toLowerCase().includes(q)
 || u.email.toLowerCase().includes(q)
 || (u.skills ?? []).some(s => s.toLowerCase().includes(q))
 || (u.role_interests ?? []).some(r => r.toLowerCase().includes(q))

 const matchesRole = roleFilter === 'all' || u.user_type === roleFilter
 const matchesSub = subFilter === 'all'
 || (subFilter === 'active' && u.sub_active)
 || (subFilter === 'expired' && !u.sub_active && u.sub_plan)
 || (subFilter === 'none' && !u.sub_plan)

 return matchesSearch && matchesRole && matchesSub
 })

 const inp: React.CSSProperties = {
 height: 42, padding: '0 14px', fontSize: 14, color: '#0f0f0f',
 border: '1.5px solid #e5e5e5', borderRadius: 10, background: '#fff',
 fontFamily: "'Inter',sans-serif", outline: 'none',
 }

 return (
 <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
 <AdminNav title="Users" />

 <div style={{ maxWidth: 1000, margin: '0 auto', padding: '36px 24px' }}>
 <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 28, fontWeight: 400,
 color: '#0f0f0f', marginBottom: 20 }}>
 All users ({filtered.length}{filtered.length !== users.length ? ` / ${users.length}` : ''})
 </h1>

 {loadErr && (
 <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fef2f2',
 border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
 Couldn't load users: {loadErr}
 </div>
 )}

 <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
 <input style={{ ...inp, width: 280 }} placeholder="Search name, email, skill, role…"
 value={search} onChange={e => setSearch(e.target.value)} />
 <select style={inp} value={roleFilter} onChange={e => setRoleFilter(e.target.value as never)}>
 <option value="all">All types</option>
 <option value="student">Students</option>
 <option value="professional">Professionals</option>
 </select>
 <select style={inp} value={subFilter} onChange={e => setSubFilter(e.target.value as never)}>
 <option value="all">All subscriptions</option>
 <option value="active">Active</option>
 <option value="expired">Expired</option>
 <option value="none">No subscription</option>
 </select>
 </div>

 {loading ? (
 <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 14, color: '#b5b5b5' }}>Loading…</div>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 {filtered.map(u => (
 <Link key={u.id} to={`/admin/users/${u.id}`} style={{
 display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 padding: '16px 20px', background: '#fff',
 border: '1.5px solid #f0f0f0', borderRadius: 12, textDecoration: 'none',
 transition: 'border-color 0.15s', gap: 12, flexWrap: 'wrap',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
 {u.photo_url || u.avatar_url ? (
 <img src={u.photo_url || u.avatar_url!} alt=""
 style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
 ) : (
 <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0f0f0',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 15, fontWeight: 600, color: '#9b9b9b', flexShrink: 0 }}>
 {u.full_name[0]?.toUpperCase()}
 </div>
 )}
 <div>
 <p style={{ fontSize: 15, fontWeight: 500, color: '#0f0f0f', marginBottom: 2 }}>{u.full_name}</p>
 <p style={{ fontSize: 13, color: '#9b9b9b' }}>{u.email}</p>
 </div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
 <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99,
 background: '#f5f5f5', color: '#6b6b6b' }}>
 {u.user_type || 'not set'}
 </span>
 <span style={{
 fontSize: 12, padding: '3px 10px', borderRadius: 99,
 background: u.sub_active ? '#f0fdf4' : '#f5f5f5',
 color: u.sub_active ? '#16a34a' : '#9b9b9b', fontWeight: u.sub_active ? 600 : 400,
 }}>
 {u.sub_active ? ` ${u.sub_plan}` : u.sub_plan ? 'Expired' : 'No sub'}
 </span>
 <span style={{ fontSize: 12, color: '#9b9b9b' }}>{u.apps_count} apps</span>
 {u.deletion_pending && (
 <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
 background: '#fef2f2', color: '#dc2626' }}>Deletion pending</span>
 )}
 <span style={{ fontSize: 12, color: '#b5b5b5' }}>→</span>
 </div>
 </Link>
 ))}
 {filtered.length === 0 && (
 <div style={{ textAlign: 'center', padding: '48px 0', fontSize: 14, color: '#b5b5b5' }}>
 No users found.
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 )
}
