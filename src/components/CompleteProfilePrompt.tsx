import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Shows to candidates who registered before skills were collected.
// Disappears once they have at least one skill saved.
export default function CompleteProfilePrompt() {
  const { profile } = useAuth()
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!profile?.user_type) return
    const table = profile.user_type === 'student' ? 'student_details' : 'professional_details'
    supabase.from(table).select('technical_skills').eq('id', profile.id).maybeSingle()
      .then(({ data }) => setMissing(!data?.technical_skills?.length))
  }, [profile?.id, profile?.user_type])

  if (!missing) return null
  return (
    <div style={{ marginBottom: 20, padding: '16px 18px', background: '#fffbeb', border: '1px solid #fde68a',
      borderRadius: 12, fontFamily: "'Inter',sans-serif" }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#92400e', margin: '0 0 4px' }}>Add your skills to get found</p>
      <p style={{ fontSize: 12.5, color: '#92400e', lineHeight: 1.6, margin: '0 0 12px' }}>
        Recruiters search by skills, college, experience and graduation year. Your profile is missing them.
      </p>
      <Link to="/profile" style={{ display: 'inline-block', background: '#0f0f0f', color: '#fff', textDecoration: 'none',
        padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Complete my profile</Link>
    </div>
  )
}
