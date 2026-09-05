import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, PLANS, type AppStats, type JobApplication, type Job, type Hackathon } from '../lib/supabase'
import RefundModal from '../components/RefundModal'
import { pickFile } from '../lib/filePicker'
import { uploadResumeWithProgress } from '../lib/uploadResume'

type Period = '7' | '30' | '90' | '365'

const PERIOD_MAP: Record<Period, string> = {
 '7': 'Last 7 days',
 '30': 'Last 30 days',
 '90': 'Last 90 days',
 '365': 'Last 365 days',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
 applied: { label: 'Applied', color: '#6b6b6b', bg: '#f5f5f5' },
 shortlisted: { label: 'Shortlisted', color: '#2563eb', bg: '#eff6ff' },
 interview: { label: 'Interview', color: '#7c3aed', bg: '#f5f3ff' },
 rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2' },
 hired: { label: 'Hired', color: '#16a34a', bg: '#f0fdf4' },
}

function StatCard({ value, label, sub, accent }: { value: number | string; label: string; sub?: string; accent?: string }) {
 return (
 <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12,
 padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 4 }}>
 <span style={{ fontSize: 36, fontWeight: 700, color: accent || '#0f0f0f',
 lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</span>
 <span style={{ fontSize: 13, fontWeight: 500, color: '#3f3f3f' }}>{label}</span>
 {sub && <span style={{ fontSize: 12, color: '#b5b5b5' }}>{sub}</span>}
 </div>
 )
}

export default function Dashboard() {
 const { profile, subscription, signOut } = useAuth()
 const navigate = useNavigate()
 const [showRefund, setShowRefund] = useState(false)

 const [stats, setStats] = useState<AppStats | null>(null)
 const [matched, setMatched] = useState(0)
 const [matchStats, setMatchStats] = useState<{ jobs_in_domain: number; jobs_matched_skills: number; jobs_applied: number } | null>(null)
 const [skipped, setSkipped] = useState<any[]>([])
 const [apps, setApps] = useState<JobApplication[]>([])
 const [period, setPeriod] = useState<Period>('30')
 const [loading, setLoading] = useState(true)
 const [resumeUrl, setResumeUrl] = useState<string | null>(null)
 const [resumeUploading, setResumeUploading] = useState(false)
 const [resumeUploadPct, setResumeUploadPct] = useState(0)
 const [resumeUploadAttempt, setResumeUploadAttempt] = useState(1)
 const [resumeError, setResumeError] = useState<string | null>(null)
 const profileRef = useRef(profile)
 useEffect(() => { profileRef.current = profile }, [profile])
 const [availableJobs, setAvailableJobs] = useState<Job[]>([])
 const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
 const [jobTab, setJobTab] = useState<'available' | 'saved'>('available')
 const [workModeFilter, setWorkModeFilter] = useState<'all' | 'remote' | 'hybrid' | 'onsite'>('all')
 const [jobsLoading, setJobsLoading] = useState(true)
 const [usage, setUsage] = useState<{ plan: string; used: number; limit: number | null } | null>(null)
 const [applying, setApplying] = useState<string | null>(null)
 const [applyError, setApplyError] = useState<string | null>(null)

 const [availableHackathons, setAvailableHackathons] = useState<Hackathon[]>([])
 const [savedHackathonIds, setSavedHackathonIds] = useState<Set<string>>(new Set())
 const [hackathonTab, setHackathonTab] = useState<'available' | 'saved'>('available')
 const [hackathonModeFilter, setHackathonModeFilter] = useState<'all' | 'online' | 'offline' | 'hybrid'>('all')
 const [hackathonsLoading, setHackathonsLoading] = useState(true)

 useEffect(() => { if (profile) load() }, [profile])
 useEffect(() => {
   if (!profile) return
   supabase.rpc('get_my_application_usage').then(({ data }) => { if (data) setUsage(data) })
 }, [profile, apps.length])

 async function handleApply(job: Job) {
   if (usage?.limit != null && usage.used >= usage.limit) {
     setApplyError(`Free plan limit reached (${usage.limit}/month). Upgrade to apply to more jobs.`)
     return
   }
   setApplying(job.id); setApplyError(null)
   try {
     const { data, error } = await supabase.rpc('record_self_application', { p_job_id: job.id })
     if (error) throw error
     if (!data?.ok) { setApplyError(data?.error ?? 'Could not record application'); return }
     setUsage(u => u ? { ...u, used: u.used + 1 } : u)
     if (job.apply_url) window.open(job.apply_url, '_blank', 'noreferrer')
   } catch (err) {
     setApplyError((err as Error).message)
   } finally {
     setApplying(null)
   }
 }
 useEffect(() => { if (profile) loadResume() }, [profile])
 useEffect(() => { if (profile) loadJobs() }, [profile, subscription])
 useEffect(() => { if (profile) loadHackathons() }, [profile])

 async function loadHackathons() {
 if (!profile) return
 setHackathonsLoading(true)
 const [hackathonsRes, savedRes] = await Promise.all([
 supabase.rpc('get_published_hackathons'),
 supabase.from('saved_hackathons').select('hackathon_id').eq('user_id', profile.id),
 ])
 setAvailableHackathons((hackathonsRes.data as Hackathon[]) ?? [])
 setSavedHackathonIds(new Set((savedRes.data ?? []).map(r => r.hackathon_id as string)))
 setHackathonsLoading(false)
 }

 async function toggleSaveHackathon(hackathonId: string) {
 if (!profile) return
 if (savedHackathonIds.has(hackathonId)) {
 await supabase.from('saved_hackathons').delete().eq('user_id', profile.id).eq('hackathon_id', hackathonId)
 setSavedHackathonIds(prev => { const next = new Set(prev); next.delete(hackathonId); return next })
 } else {
 await supabase.from('saved_hackathons').insert({ user_id: profile.id, hackathon_id: hackathonId })
 setSavedHackathonIds(prev => new Set(prev).add(hackathonId))
 }
 }

 async function loadJobs() {
 if (!profile) return
 setJobsLoading(true)
 const [jobsRes, savedRes] = await Promise.all([
 supabase.rpc('get_eligible_jobs'),
 supabase.from('saved_jobs').select('job_id').eq('user_id', profile.id),
 ])
 setAvailableJobs((jobsRes.data as Job[]) ?? [])
 setSavedIds(new Set((savedRes.data ?? []).map(r => r.job_id as string)))
 setJobsLoading(false)
 }

 async function toggleSave(jobId: string) {
 if (!profile) return
 if (savedIds.has(jobId)) {
 await supabase.from('saved_jobs').delete().eq('user_id', profile.id).eq('job_id', jobId)
 setSavedIds(prev => { const next = new Set(prev); next.delete(jobId); return next })
 } else {
 await supabase.from('saved_jobs').insert({ user_id: profile.id, job_id: jobId })
 setSavedIds(prev => new Set(prev).add(jobId))
 }
 }

 async function loadResume() {
 if (!profile) return
 const table = profile.user_type === 'professional' ? 'professional_details' : 'student_details'
 const { data } = await supabase.from(table).select('resume_url').eq('id', profile.id).maybeSingle()
 setResumeUrl(data?.resume_url ?? null)
 }

 async function handleResumeUpload(file: File) {
 // profile can still be loading right after a mobile file-picker remount,
 // poll briefly instead of silently doing nothing.
 let p = profileRef.current
 for (let attempt = 0; attempt < 15 && !p; attempt++) {
 await new Promise(r => setTimeout(r, 400))
 p = profileRef.current
 }
 if (!p) {
 console.error('Resume upload aborted: profile still not loaded after 6s')
 setResumeError('Still loading your profile, please try again in a moment.')
 return
 }
 const nameIsPdf = file.name.toLowerCase().endsWith('.pdf')
 const mimeOk = file.type === '' || file.type === 'application/pdf' || file.type === 'application/octet-stream'
 if (!nameIsPdf || !mimeOk) { setResumeError('PDF only.'); return }
 if (file.size > 5 * 1024 * 1024) { setResumeError('Max 5MB.'); return }
 setResumeUploading(true); setResumeError(null)
 try {
 const path = `${p.id}/${Date.now()}-${file.name}`
 setResumeUploadPct(0); setResumeUploadAttempt(1)
 await uploadResumeWithProgress(file, path, (pr) => {
 setResumeUploadPct(pr.percent)
 setResumeUploadAttempt(pr.attempt)
 })
 const table = p.user_type === 'professional' ? 'professional_details' : 'student_details'
 const { error: dbErr } = await supabase.from(table).update({ resume_url: path }).eq('id', p.id)
 if (dbErr) throw dbErr
 setResumeUrl(path)
 } catch (err) {
 setResumeError((err as Error).message)
 } finally {
 setResumeUploading(false)
 }
 }

 async function viewResume() {
 if (!resumeUrl) return
 const { data } = await supabase.storage.from('resumes').createSignedUrl(resumeUrl, 3600)
 if (data?.signedUrl) window.open(data.signedUrl, '_blank')
 }


 async function load() {
 if (!profile) return
 setLoading(true)
 const [s, m, a, ms, sk] = await Promise.all([
 supabase.rpc('get_application_stats', { p_user_id: profile.id }),
 supabase.rpc('get_matched_jobs_count', { p_user_id: profile.id }),
 supabase.from('job_applications').select('*')
 .eq('user_id', profile.id).order('applied_at', { ascending: false }).limit(20),
 supabase.rpc('get_user_match_stats', { p_user_id: profile.id }),
 supabase.from('job_screening_log')
 .select('*, jobs(title, company)')
 .eq('user_id', profile.id).eq('decision', 'rejected')
 .order('created_at', { ascending: false }).limit(10),
 ])
 if (s.data) setStats(s.data as AppStats)
 if (m.data !== null) setMatched(m.data as number)
 if (a.data) setApps(a.data as JobApplication[])
 if (ms.data) setMatchStats(ms.data as any)
 if (sk.data) setSkipped(sk.data)
 setLoading(false)
 }

 const periodVal = stats
 ? period === '7' ? stats.last_7_days
 : period === '30' ? stats.last_30_days
 : period === '90' ? stats.last_90_days
 : stats.last_365_days
 : 0

 // Subscription renewal info
 let daysLeft = 0
 let renewDate = ''
 let isUrgent = false
 if (subscription?.ends_at) {
 const end = new Date(subscription.ends_at)
 daysLeft = Math.ceil((end.getTime() - Date.now()) / 86400000)
 isUrgent = daysLeft <= 7
 renewDate = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
 }

 // Profile completion
 const completionItems = [
 { done: !!profile?.first_name, label: 'Name' },
 { done: !!profile?.mobile_number, label: 'Mobile' },
 { done: !!profile?.linkedin_url, label: 'LinkedIn' },
 { done: !!profile?.github_url, label: 'GitHub' },
 { done: !!profile?.role_interests?.length, label: 'Roles' },
 { done: !!profile?.user_type, label: 'Profile type'},
 ]
 const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100)

 return (
 <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',-apple-system,sans-serif" }}>

 {/* NAV */}
 <nav style={{ background: '#fff', borderBottom: '1px solid #f0f0f0',
 position: 'sticky', top: 0, zIndex: 50 }}>
 <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px',
 height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f7f7f5',
 border: '1px solid #ececec', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <img src="/logo-mark.png" alt="ApplyMate" style={{ width: 24, height: 24, objectFit: 'contain' }} />
 </div>
 <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>ApplyMate</span>
 </div>
 <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
 {profile?.is_admin && (
 <Link to="/admin" style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f',
 background: '#f5f5f5', padding: '6px 12px', borderRadius: 7, textDecoration: 'none' }}>
 Admin
 </Link>
 )}
 <Link to="/profile" style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f',
 background: '#f5f5f5', padding: '6px 12px', borderRadius: 7, textDecoration: 'none' }}>
 My Profile
 </Link>
 <button onClick={signOut} style={{ background: 'none', border: 'none',
 fontSize: 13, color: '#9b9b9b', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 padding: '6px 10px' }}>Sign out</button>
 </div>
 </div>
 </nav>

 <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 80px' }}>

 {/* Header row */}
 <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
 marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
 <div>
 <p style={{ fontSize: 11, fontWeight: 600, color: '#b5b5b5',
 letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>DASHBOARD</p>
 <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 28,
 fontWeight: 400, color: '#0f0f0f', letterSpacing: '-0.02em' }}>
 {profile?.first_name ? `Welcome back, ${profile.first_name}.` : 'Your dashboard'}
 </h1>
 </div>
 {/* Subscription pill */}
 {subscription && (
 <div onClick={() => navigate('/subscription')} style={{
 padding: '10px 16px', background: isUrgent ? '#fff7ed' : '#f7f7f7',
 border: `1px solid ${isUrgent ? '#fed7aa' : '#e8e8e8'}`,
 borderRadius: 10, cursor: 'pointer',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
 <span style={{ width: 7, height: 7, borderRadius: '50%',
 background: isUrgent ? '#f97316' : '#22c55e', display: 'block' }} />
 <span style={{ fontSize: 12, fontWeight: 600,
 color: isUrgent ? '#ea580c' : '#15803d' }}>
 {isUrgent ? `${daysLeft} days left` : 'Active'}
 </span>
 </div>
 <p style={{ fontSize: 12, color: '#9b9b9b' }}>
 Next due: <strong style={{ color: isUrgent ? '#dc2626' : '#0f0f0f' }}>{renewDate}</strong>
 </p>
 {subscription?.plan !== 'free' && (
 <p onClick={(e) => { e.stopPropagation(); setShowRefund(true) }}
 style={{ fontSize: 11, color: '#9b9b9b', textDecoration: 'underline', marginTop: 4 }}>
 Request refund
 </p>
 )}
 </div>
 )}
 </div>

 {showRefund && subscription && (
 <RefundModal
 subscriptionId={subscription.id}
 onClose={() => setShowRefund(false)}
 onDone={() => { setShowRefund(false); window.location.reload() }}
 />
 )}

 {/* No subscription alert */}
 {!subscription && (
 <div style={{ marginBottom: 24, padding: '16px 20px',
 background: '#0f0f0f', borderRadius: 12,
 display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
 <p style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>
 Subscribe to apply for more applications.
 </p>
 <button onClick={() => navigate('/subscription')} style={{
 background: '#fff', color: '#0f0f0f', border: 'none',
 padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif", flexShrink: 0,
 }}>Subscribe →</button>
 </div>
 )}

 {/* Profile completion bar */}
 {completionPct < 100 && (
 <div style={{ marginBottom: 24, padding: '16px 20px', background: '#fff',
 border: '1px solid #f0f0f0', borderRadius: 12 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between',
 alignItems: 'center', marginBottom: 10 }}>
 <p style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f' }}>
 Profile {completionPct}% complete
 </p>
 <p style={{ fontSize: 12, color: '#9b9b9b' }}>
 Missing: {completionItems.filter(i => !i.done).map(i => i.label).join(', ')}
 </p>
 </div>
 <div style={{ height: 6, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden' }}>
 <div style={{ height: '100%', width: `${completionPct}%`,
 background: completionPct < 50 ? '#ef4444' : completionPct < 80 ? '#f59e0b' : '#22c55e',
 borderRadius: 99, transition: 'width 0.6s ease' }} />
 </div>
 </div>
 )}

 {/* Resume: update directly, no full onboarding flow needed */}
 <div style={{ marginBottom: 24, padding: '16px 20px', background: '#fff',
 border: '1px solid #f0f0f0', borderRadius: 12, display: 'flex',
 alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
 <div>
 <p style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f', marginBottom: 2 }}>
 {resumeUrl ? ' Resume on file' : ' No resume uploaded'}
 </p>
 <p style={{ fontSize: 12, color: '#9b9b9b' }}>
 {resumeUrl ? 'We use this for every application we submit on your behalf.' : 'Upload a PDF so we can start applying for you.'}
 </p>
 {resumeError && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}> {resumeError}</p>}
 </div>
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 {resumeUrl && (
 <button onClick={viewResume} style={{ background: '#f5f5f5', color: '#0f0f0f', border: 'none',
 padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
 fontFamily: "'Inter',sans-serif" }}>View</button>
 )}
 <button onClick={async () => {
 const f = await pickFile('application/pdf,.pdf')
 if (f) handleResumeUpload(f)
 }} disabled={resumeUploading} style={{
 background: resumeUploading ? '#e5e5e5' : '#0f0f0f',
 color: resumeUploading ? '#9b9b9b' : '#fff', padding: '9px 16px', borderRadius: 8,
 border: 'none', fontSize: 13, fontWeight: 600, cursor: resumeUploading ? 'not-allowed' : 'pointer',
 fontFamily: "'Inter',sans-serif" }}>
 {resumeUploading
 ? (resumeUploadAttempt > 1 ? `Retrying ${resumeUploadPct}%…` : `Uploading ${resumeUploadPct}%…`)
 : resumeUrl ? 'Replace' : 'Upload'}
 </button>
 </div>
 </div>

 {applyError && (
 <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2',
 border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626',
 display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
 <span>{applyError}</span>
 <button onClick={() => setApplyError(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700 }}>×</button>
 </div>
 )}
 {usage?.limit != null && (
 <div style={{ marginBottom: 16, padding: '10px 16px', background: usage.used >= usage.limit ? '#fef2f2' : '#f8f8f8',
 border: `1px solid ${usage.used >= usage.limit ? '#fecaca' : '#eee'}`, borderRadius: 10, fontSize: 12.5,
 color: usage.used >= usage.limit ? '#dc2626' : '#6b6b6b' }}>
 {usage.used >= usage.limit
 ? `You've used all ${usage.limit} free applications this month. Upgrade to Basic/Pro for unlimited applications.`
 : `${usage.used}/${usage.limit} applications used this month (Free plan)`}
 </div>
 )}
 {/* Available Jobs: browsable feed with work-mode filter, all plans */}
 {true && (
 <div style={{ marginBottom: 24 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
 <p style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f' }}>Jobs</p>
 <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 8, padding: 3 }}>
 {(['available', 'saved'] as const).map(t => (
 <button key={t} onClick={() => setJobTab(t)} style={{
 padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
 border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 background: jobTab === t ? '#fff' : 'transparent',
 color: jobTab === t ? '#0f0f0f' : '#9b9b9b',
 }}>{t === 'available' ? 'Available' : 'Saved'}</button>
 ))}
 </div>
 <select value={workModeFilter} onChange={e => setWorkModeFilter(e.target.value as typeof workModeFilter)}
 style={{ fontSize: 12.5, fontWeight: 600, border: '1px solid #e5e5e5', borderRadius: 7,
 padding: '6px 10px', background: '#fff', color: '#0f0f0f',
 fontFamily: "'Inter',sans-serif", cursor: 'pointer', outline: 'none' }}>
 <option value="all">All work modes</option>
 <option value="remote">Remote</option>
 <option value="hybrid">Hybrid</option>
 <option value="onsite">Onsite</option>
 </select>
 </div>

 {jobsLoading ? (
 <div style={{ fontSize: 13, color: '#b5b5b5', textAlign: 'center', padding: '32px 0' }}>Loading…</div>
 ) : (() => {
 const base = jobTab === 'available' ? availableJobs : availableJobs.filter(j => savedIds.has(j.id))
 const shown = workModeFilter === 'all' ? base : base.filter(j => j.work_mode === workModeFilter)
 if (shown.length === 0) {
 return (
 <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12,
 padding: '32px 24px', textAlign: 'center', fontSize: 13, color: '#9b9b9b' }}>
 {jobTab === 'available'
 ? (workModeFilter === 'all' ? 'No jobs published for your plan yet. Check back soon.' : `No ${workModeFilter} jobs right now. Try a different filter.`)
 : 'No saved jobs yet.'}
 </div>
 )
 }
 return (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 {shown.map(job => (
 <div key={job.id} style={{
 display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
 padding: '14px 16px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10,
 }}>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ fontSize: 14, fontWeight: 500, color: '#0f0f0f', marginBottom: 2 }}>{job.title}</p>
 <p style={{ fontSize: 12, color: '#9b9b9b', marginBottom: 6 }}>
 {job.company}, {job.location || 'Remote'}, {new Date(job.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
 {job.work_mode && (
 <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, padding: '1px 7px',
 background: '#f0f0f0', color: '#6b6b6b', borderRadius: 99, textTransform: 'capitalize' }}>
 {job.work_mode}
 </span>
 )}
 {job.graduation_years?.length > 0 && (
 <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, padding: '1px 7px',
 background: '#fef3c7', color: '#92400e', borderRadius: 99 }}>
 Only {job.graduation_years.join('/')} Batch
 </span>
 )}
 </p>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
 {job.required_skills.slice(0, 4).map(s => (
 <span key={s} style={{ fontSize: 11, padding: '2px 7px', background: '#f0f0f0',
 color: '#6b6b6b', borderRadius: 99 }}>{s}</span>
 ))}
 </div>
 </div>
 <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
 <button onClick={() => toggleSave(job.id)} style={{
 padding: '7px 12px', background: savedIds.has(job.id) ? '#fef3c7' : '#f5f5f5',
 color: savedIds.has(job.id) ? '#92400e' : '#6b6b6b',
 border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
 fontFamily: "'Inter',sans-serif",
 }}>{savedIds.has(job.id) ? 'Saved' : 'Save'}</button>
 {job.apply_url && (
 <button onClick={() => handleApply(job)} disabled={applying === job.id} style={{
 padding: '7px 14px', background: '#0f0f0f', color: '#fff', borderRadius: 7, border: 'none', cursor: 'pointer',
 fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif",
 opacity: applying === job.id ? 0.6 : 1,
 }}>{applying === job.id ? 'Applying…' : 'Apply →'}</button>
 )}
 </div>
 </div>
 ))}
 </div>
 )
 })()}
 </div>
 )}

 {/* Hackathons: browsable feed with mode filter */}
 <div style={{ marginBottom: 24 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
 <p style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f' }}>Hackathons</p>
 <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 8, padding: 3 }}>
 {(['available', 'saved'] as const).map(t => (
 <button key={t} onClick={() => setHackathonTab(t)} style={{
 padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
 border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 background: hackathonTab === t ? '#fff' : 'transparent',
 color: hackathonTab === t ? '#0f0f0f' : '#9b9b9b',
 }}>{t === 'available' ? 'Available' : 'Saved'}</button>
 ))}
 </div>
 <select value={hackathonModeFilter} onChange={e => setHackathonModeFilter(e.target.value as typeof hackathonModeFilter)}
 style={{ fontSize: 12.5, fontWeight: 600, border: '1px solid #e5e5e5', borderRadius: 7,
 padding: '6px 10px', background: '#fff', color: '#0f0f0f',
 fontFamily: "'Inter',sans-serif", cursor: 'pointer', outline: 'none' }}>
 <option value="all">All modes</option>
 <option value="online">Online</option>
 <option value="offline">Offline</option>
 <option value="hybrid">Hybrid</option>
 </select>
 </div>

 {hackathonsLoading ? (
 <div style={{ fontSize: 13, color: '#b5b5b5', textAlign: 'center', padding: '32px 0' }}>Loading…</div>
 ) : (() => {
 const base = hackathonTab === 'available' ? availableHackathons : availableHackathons.filter(h => savedHackathonIds.has(h.id))
 const shown = hackathonModeFilter === 'all' ? base : base.filter(h => h.mode === hackathonModeFilter)
 if (shown.length === 0) {
 return (
 <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12,
 padding: '32px 24px', textAlign: 'center', fontSize: 13, color: '#9b9b9b' }}>
 {hackathonTab === 'available'
 ? (hackathonModeFilter === 'all' ? 'No hackathons published yet. Check back soon.' : `No ${hackathonModeFilter} hackathons right now. Try a different filter.`)
 : 'No saved hackathons yet.'}
 </div>
 )
 }
 return (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 {shown.map(h => (
 <div key={h.id} style={{
 display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
 padding: '14px 16px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10,
 }}>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ fontSize: 14, fontWeight: 500, color: '#0f0f0f', marginBottom: 2 }}>{h.title}</p>
 <p style={{ fontSize: 12, color: '#9b9b9b', marginBottom: 6 }}>
 {h.organizer}, {h.location || 'Online'}
 {h.last_date && `, register by ${new Date(h.last_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
 {h.mode && (
 <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, padding: '1px 7px',
 background: '#f0f0f0', color: '#6b6b6b', borderRadius: 99, textTransform: 'capitalize' }}>
 {h.mode}
 </span>
 )}
 {h.prize_pool && (
 <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, padding: '1px 7px',
 background: '#fef3c7', color: '#92400e', borderRadius: 99 }}>
 {h.prize_pool}
 </span>
 )}
 </p>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
 {h.tags.slice(0, 4).map(t => (
 <span key={t} style={{ fontSize: 11, padding: '2px 7px', background: '#f0f0f0',
 color: '#6b6b6b', borderRadius: 99 }}>{t}</span>
 ))}
 </div>
 </div>
 <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
 <button onClick={() => toggleSaveHackathon(h.id)} style={{
 padding: '7px 12px', background: savedHackathonIds.has(h.id) ? '#fef3c7' : '#f5f5f5',
 color: savedHackathonIds.has(h.id) ? '#92400e' : '#6b6b6b',
 border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
 fontFamily: "'Inter',sans-serif",
 }}>{savedHackathonIds.has(h.id) ? 'Saved' : 'Save'}</button>
 {h.register_url && (
 <a href={h.register_url} target="_blank" rel="noreferrer" style={{
 padding: '7px 14px', background: '#0f0f0f', color: '#fff', borderRadius: 7, border: 'none', cursor: 'pointer',
 fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif", textDecoration: 'none',
 display: 'inline-flex', alignItems: 'center',
 }}>Register →</a>
 )}
 </div>
 </div>
 ))}
 </div>
 )
 })()}
 </div>

 {/* Stats: period dropdown */}
 <div style={{ marginBottom: 20 }}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
 <p style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f' }}>Applications sent</p>
 <select value={period} onChange={e => setPeriod(e.target.value as Period)}
 style={{ fontSize: 13, border: '1px solid #e5e5e5', borderRadius: 7,
 padding: '6px 10px', background: '#fff', color: '#0f0f0f',
 fontFamily: "'Inter',sans-serif", cursor: 'pointer', outline: 'none' }}>
 {(Object.keys(PERIOD_MAP) as Period[]).map(p => (
 <option key={p} value={p}>{PERIOD_MAP[p]}</option>
 ))}
 </select>
 </div>
 {loading ? (
 <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 13, color: '#b5b5b5' }}>Loading…</div>
 ) : (
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
 <StatCard value={periodVal} label={PERIOD_MAP[period]} sub="applications sent" />
 <StatCard value={stats?.shortlisted ?? 0} label="Shortlisted" accent="#7c3aed" />
 <StatCard value={stats?.hired ?? 0} label="Offers received" accent="#16a34a" />
 {subscription?.plan !== 'free' && (
 <>
 <StatCard value={matchStats?.jobs_in_domain ?? 0} label="Jobs in your domain" accent="#0891b2" />
 <StatCard value={matchStats?.jobs_matched_skills ?? 0} label="Jobs matched to skills" accent="#2563eb" />
 {subscription && (
 <StatCard value={matchStats?.jobs_applied ?? 0} label="Jobs we applied to" accent="#16a34a" />
 )}
 </>
 )}
 </div>
 )}
 </div>

 {/* Urgent renewal banner */}
 {subscription && isUrgent && (
 <div style={{ marginBottom: 20, padding: '14px 18px',
 background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10,
 display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
 <p style={{ fontSize: 14, color: '#92400e', fontWeight: 500 }}>
 Subscription expires in {daysLeft} day{daysLeft === 1 ? '' : 's'} on {renewDate}.
 Account will be paused automatically.
 </p>
 <button onClick={() => navigate('/subscription')} style={{
 background: '#dc2626', color: '#fff', border: 'none',
 padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif", flexShrink: 0,
 }}>Renew now</button>
 </div>
 )}

 {/* Recent applications */}
 <div>
 <p style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f', marginBottom: 14 }}>
 Recent applications
 </p>
 {loading ? (
 <div style={{ fontSize: 13, color: '#b5b5b5', textAlign: 'center', padding: '48px 0' }}>Loading…</div>
 ) : apps.length === 0 ? (
 <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12,
 padding: '48px 24px', textAlign: 'center' }}>
 <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f0f', marginBottom: 6 }}>
 No applications yet
 </p>
 <p style={{ fontSize: 13, color: '#9b9b9b' }}>
 {subscription
 ? 'Our team is matching jobs to your profile. Usually starts within 24 hours.'
 : 'Subscribe to let our team start applying on your behalf.'}
 </p>
 {!subscription && (
 <button onClick={() => navigate('/subscription')} style={{
 marginTop: 16, padding: '10px 22px', background: '#0f0f0f', color: '#fff',
 border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>View plans →</button>
 )}
 </div>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
 {/* Table header */}
 <div style={{ display: 'grid',
 gridTemplateColumns: '1fr 160px 120px 100px',
 padding: '8px 16px', gap: 12 }}>
 {['Role & Company','Applied','Skills matched','Status'].map(h => (
 <p key={h} style={{ fontSize: 11, fontWeight: 600, color: '#b5b5b5',
 textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</p>
 ))}
 </div>
 {apps.map(app => {
 const st = STATUS_META[app.status] || STATUS_META.applied
 return (
 <div key={app.id} style={{
 display: 'grid', gridTemplateColumns: '1fr 160px 120px 100px',
 padding: '14px 16px', gap: 12, background: '#fff',
 border: '1px solid #f0f0f0', borderLeft: `3px solid ${st.color}`, borderRadius: 10,
 alignItems: 'center',
 }}>
 <div>
 <p style={{ fontSize: 14, fontWeight: 500, color: '#0f0f0f', marginBottom: 2 }}>
 {app.job_title || 'Role'}
 </p>
 <p style={{ fontSize: 12, color: '#9b9b9b' }}>{app.company || 'N/A'}</p>
 </div>
 <p style={{ fontSize: 13, color: '#6b6b6b' }}>
 {new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
 </p>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
 {(app.matched_skills ?? []).slice(0, 2).map(s => (
 <span key={s} style={{ fontSize: 11, padding: '2px 7px',
 background: '#f0f0f0', color: '#6b6b6b', borderRadius: 99 }}>{s}</span>
 ))}
 </div>
 <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px',
 background: st.bg, color: st.color, borderRadius: 99,
 textAlign: 'center', display: 'inline-flex', alignItems: 'center',
 justifyContent: 'center', gap: 5 }}>
 <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />
 {st.label}
 </span>
 </div>
 )
 })}
 </div>
 )}

 {skipped.length > 0 && (
 <div style={{ marginTop: 12 }}>
 <p style={{ fontSize: 12, fontWeight: 600, color: '#b5b5b5',
 textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
 Jobs we skipped
 </p>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
 {skipped.map(row => (
 <div key={row.id} style={{ padding: '12px 16px', background: '#fff',
 border: '1px solid #f0f0f0', borderLeft: '3px solid #d97706', borderRadius: 10 }}>
 <p style={{ fontSize: 13.5, fontWeight: 500, color: '#0f0f0f' }}>
 {row.jobs?.title || 'Role'} <span style={{ color: '#9b9b9b', fontWeight: 400 }}>({row.jobs?.company})</span>
 </p>
 <p style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>
 {(row.missing_metrics ?? []).map((m: string) =>
 m.charAt(0).toUpperCase() + m.slice(1) + ' is missing').join(', ') || 'Did not meet criteria'}
 </p>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Subscription plan info footer */}
 {subscription && (
 <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 40px' }}>
 <div style={{ padding: '16px 20px', background: '#fff',
 border: '1px solid #f0f0f0', borderRadius: 10,
 display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
 <div style={{ display: 'flex', gap: 24 }}>
 <div>
 <p style={{ fontSize: 11, color: '#b5b5b5', marginBottom: 3 }}>CURRENT PLAN</p>
 <p style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>
 {PLANS[subscription.plan].label}
 </p>
 </div>
 <div>
 <p style={{ fontSize: 11, color: '#b5b5b5', marginBottom: 3 }}>NEXT PAYMENT DUE</p>
 <p style={{ fontSize: 14, fontWeight: 600, color: isUrgent ? '#dc2626' : '#0f0f0f' }}>
 {renewDate}
 </p>
 </div>
 <div>
 <p style={{ fontSize: 11, color: '#b5b5b5', marginBottom: 3 }}>DAYS REMAINING</p>
 <p style={{ fontSize: 14, fontWeight: 700, color: isUrgent ? '#dc2626' : '#16a34a' }}>
 {daysLeft} days
 </p>
 </div>
 </div>
 <button onClick={() => navigate('/subscription')} style={{
 background: isUrgent ? '#dc2626' : 'none',
 border: isUrgent ? 'none' : '1px solid #e5e5e5',
 color: isUrgent ? '#fff' : '#0f0f0f',
 padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: isUrgent ? 600 : 400,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>{isUrgent ? 'Renew now →' : 'Manage plan'}</button>
 </div>
 </div>
 )}
 </div>
 )
}
