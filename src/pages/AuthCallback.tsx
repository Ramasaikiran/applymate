import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { routePostAuth } from '../lib/routing'

export default function AuthCallback() {
 const navigate = useNavigate()
 const [state, setState] = useState<'verifying' | 'error'>('verifying')
 const [message, setMessage] = useState('')

 useEffect(() => {
 let cancelled = false

 async function run() {
 try {
 const { data, error } = await supabase.auth.getSession()
 if (cancelled) return

 if (error || !data.session) {
 setState('error')
 setMessage('This link has expired or already been used. Request a new one to continue.')
 return
 }

 const userId = data.session.user.id

 // Ensure profile exists (OAuth users)
 let { data: profile, error: profileErr } = await supabase
 .from('profiles')
 .select('id, account_status, user_type, is_admin')
 .eq('id', userId)
 .maybeSingle()
 if (profileErr) throw profileErr

 if (!profile) {
 const { error: upsertErr } = await supabase.from('profiles').upsert({
 id: userId,
 full_name: data.session.user.user_metadata?.full_name ?? data.session.user.email?.split('@')[0] ?? 'New member',
 email: data.session.user.email,
 avatar_url: data.session.user.user_metadata?.avatar_url ?? null,
 account_status: 'active',
 })
 if (upsertErr) throw upsertErr
 // Re-fetch after insert
 const { data: refetched, error: refetchErr } = await supabase
 .from('profiles').select('id, account_status, user_type, is_admin')
 .eq('id', userId).maybeSingle()
 if (refetchErr) throw refetchErr
 profile = refetched
 }

 // ── Routing (admin / onboarding / subscription / dashboard) ──
 // Shared with SignIn so every entry point makes the same decision.
 await routePostAuth(userId, navigate)
 } catch {
 if (cancelled) return
 setState('error')
 setMessage('Something went wrong finishing sign in. Please try again, if it keeps happening, contact support@applymate.in.')
 }
 }

 run()
 return () => { cancelled = true }
 }, [navigate])

 return (
 <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
 justifyContent: 'center', background: '#fff', fontFamily: "'Inter',sans-serif" }}>
 <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 24px' }}>
 {state === 'verifying' ? (
 <>
 <div style={{ width: 40, height: 40, borderRadius: '50%',
 border: '3px solid #f0f0f0', borderTopColor: '#0f0f0f',
 animation: 'spin 0.8s linear infinite', margin: '0 auto 24px' }} />
 <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 24,
 fontWeight: 400, color: '#0f0f0f', marginBottom: 8 }}>Verifying your account</h1>
 <p style={{ fontSize: 14, color: '#9b9b9b' }}>One moment, almost in.</p>
 </>
 ) : (
 <>
 <div style={{ fontSize: 40, marginBottom: 20 }}></div>
 <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 24,
 fontWeight: 400, color: '#0f0f0f', marginBottom: 8 }}>We hit a snag</h1>
 <p style={{ fontSize: 14, color: '#9b9b9b', marginBottom: 28 }}>{message}</p>
 <a href="/sign-up" style={{ display: 'inline-block', padding: '12px 24px',
 background: '#0f0f0f', color: '#fff', borderRadius: 10,
 fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Back to sign up</a>
 </>
 )}
 </div>
 <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
 </div>
 )
}
