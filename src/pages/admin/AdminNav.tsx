import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const LINKS = [
 { to: '/admin', label: 'Overview' },
 { to: '/admin/users', label: 'Users' },
 { to: '/admin/jobs', label: 'Jobs' },
 { to: '/admin/hackathons', label: 'Hackathons' },
 { to: '/admin/subscriptions',label: 'Subscriptions' },
 { to: '/admin/analytics', label: 'Analytics' },
 { to: '/admin/activity', label: 'Activity log' },
]

export default function AdminNav({ title }: { title?: string }) {
 const { signOut } = useAuth()
 const { pathname } = useLocation()

 return (
 <div style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 24px',
 background: '#0f0f0f', gap: 8, overflowX: 'auto' }}>
 <Link to="/admin" style={{ fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none',
 marginRight: 16, flexShrink: 0 }}>
 {title || 'Admin'}
 </Link>
 {LINKS.map(l => (
 <Link key={l.to} to={l.to} style={{
 fontSize: 13, fontWeight: 500, textDecoration: 'none', flexShrink: 0,
 padding: '7px 13px', borderRadius: 8,
 background: pathname === l.to ? '#fff' : 'transparent',
 color: pathname === l.to ? '#0f0f0f' : 'rgba(255,255,255,0.65)',
 }}>{l.label}</Link>
 ))}
 <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
 <Link to="/dashboard" style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Exit admin</Link>
 <button onClick={signOut} style={{ background: 'none', border: 'none', cursor: 'pointer',
 fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter',sans-serif" }}>Sign out</button>
 </div>
 </div>
 )
}
