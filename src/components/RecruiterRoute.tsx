import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
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

// require="approved"  → full recruiter app (dashboard, jobs, candidates)
// require="applicant" → apply / pending pages (any recruiter account)
// The database enforces every permission; this only decides which screen to show.
export default function RecruiterRoute({ children, require = 'approved' }: {
  children: ReactNode; require?: 'approved' | 'applicant'
}) {
  const { loading, profileLoaded, session, profile, isRecruiter, recruiter } = useAuth()

  if (loading || !profileLoaded) return <Spinner />
  if (!session) return <Navigate to="/sign-in" replace />
  if (profile?.is_admin) return <Navigate to="/admin" replace />
  // A user who chose "I'm a recruiter" in onboarding has no recruiters row yet.
  const chosePathNotYetPicked = require === 'applicant' && !profile?.user_type
  if (!isRecruiter && !chosePathNotYetPicked) return <Navigate to="/dashboard" replace />

  const status = recruiter?.status ?? null
  if (require === 'approved' && status !== 'approved') {
    return <Navigate to={recruiterHome(status)} replace />
  }
  if (require === 'applicant' && status === 'approved') {
    return <Navigate to="/recruiter" replace />
  }
  return <>{children}</>
}
