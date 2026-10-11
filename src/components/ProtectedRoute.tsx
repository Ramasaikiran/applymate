import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { recruiterHome } from '../lib/routing'

const Spinner = () => (
  <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 36, height: 36, borderRadius: '50%',
      border: '3px solid #f0f0f0', borderTopColor: '#0f0f0f',
      animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

export default function ProtectedRoute({ children, requireSub = false }: {
  children: ReactNode; requireSub?: boolean
}) {
  const { session, loading, profileLoaded, profile, isRecruiter, recruiter } = useAuth()
  const location = useLocation()

  if (loading || (session && !profileLoaded)) return <Spinner />
  if (!session) return <Navigate to="/sign-in" replace />

  // ── ADMIN: always go to admin panel, never user flows ──────────
  if (profile?.is_admin) return <Navigate to="/admin" replace />

  // ── RECRUITER: never use candidate flows ───────────────────────
  if (isRecruiter) return <Navigate to={recruiterHome(recruiter?.status ?? null)} replace />

  // ── Already onboarded → block access to /onboarding ───────────
  // Exception: allow edit mode (e.g. ?edit=resume from Subscription's Back button)
  const isEditMode = new URLSearchParams(location.search).has('edit')
  if (location.pathname === '/onboarding' && profile?.user_type && !isEditMode) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
