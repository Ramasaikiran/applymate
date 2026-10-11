import type { CSSProperties, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import NotificationBell from '../../components/NotificationBell'

export const FONT = "'Inter',-apple-system,sans-serif"

export const inp: CSSProperties = {
  width: '100%', height: 46, padding: '0 14px', fontFamily: FONT, fontSize: 14,
  color: '#0f0f0f', background: '#fff', border: '1.5px solid #e5e5e5',
  borderRadius: 10, outline: 'none', boxSizing: 'border-box',
}
export const lbl: CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#6b6b6b', marginBottom: 6,
}
export const card: CSSProperties = {
  background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: 20,
}
export const btnDark = (disabled = false): CSSProperties => ({
  background: '#0f0f0f', color: '#fff', border: 'none', padding: '11px 20px',
  borderRadius: 10, fontSize: 13.5, fontWeight: 600, fontFamily: FONT,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
})
export const btnGhost: CSSProperties = {
  background: '#fff', color: '#0f0f0f', border: '1.5px solid #e5e5e5', padding: '9px 16px',
  borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 500, padding: '3px 9px', borderRadius: 99,
      background: '#f3f3f1', color: '#4b4b4b', whiteSpace: 'nowrap' }}>{children}</span>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10,
      padding: '12px 14px', fontSize: 13.5, color: '#dc2626', marginBottom: 14 }}>{children}</div>
  )
}

const TABS = [
  { to: '/recruiter', label: 'Find candidates' },
  { to: '/recruiter/jobs', label: 'My jobs' },
]

// Page shell for the approved recruiter area.
export function RecruiterShell({ children }: { children: ReactNode }) {
  const { recruiter, signOut } = useAuth()
  const { pathname } = useLocation()
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: FONT }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px', height: 56,
          display: 'flex', alignItems: 'center', gap: 14, overflowX: 'auto' }}>
          <Link to="/recruiter" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
            <img src="/logo-mark.png" alt="ApplyMate" style={{ width: 26, height: 26, objectFit: 'contain' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f', letterSpacing: '-0.02em' }}>ApplyMate Recruiter</span>
          </Link>
          {TABS.map(t => {
            const on = t.to === '/recruiter' ? pathname === '/recruiter' || pathname.startsWith('/recruiter/candidates') : pathname === t.to
            return (
              <Link key={t.to} to={t.to} style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
                padding: '6px 12px', borderRadius: 7, background: on ? '#0f0f0f' : 'transparent',
                color: on ? '#fff' : '#6b6b6b' }}>{t.label}</Link>
            )
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <NotificationBell />
            <span style={{ fontSize: 12.5, color: '#9b9b9b' }}>{recruiter?.company_name}</span>
            <button onClick={signOut} style={{ background: 'none', border: 'none', fontSize: 13,
              color: '#9b9b9b', cursor: 'pointer', fontFamily: FONT }}>Sign out</button>
          </div>
        </div>
      </nav>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px 80px' }}>{children}</div>
    </div>
  )
}

// Centered single-card layout for sign up / apply / pending.
export function CenterCard({ children, width = 520 }: { children: ReactNode; width?: number }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f7f7f5', fontFamily: FONT, padding: 24 }}>
      <div style={{ width: '100%', maxWidth: width, background: '#fff', borderRadius: 24, padding: '44px 40px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}>{children}</div>
    </div>
  )
}

export const H1: CSSProperties = {
  fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 32, fontWeight: 400,
  color: '#0f0f0f', letterSpacing: '-0.02em', margin: '0 0 10px',
}
