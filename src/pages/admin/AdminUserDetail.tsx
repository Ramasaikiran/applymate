import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
 supabase, type Profile, type StudentDetails, type ProfessionalDetails,
 type Job, type JobApplication, type Subscription, type UserAppStats, PLANS,
} from '../../lib/supabase'

type TabType = 'profile' | 'subscription' | 'jobs' | 'applications'

const STATUS_OPTS: JobApplication['status'][] = ['applied','assessment','interview','hr_round','rejected','offer','joined']
const STATUS_COLOR: Record<string, string> = {
 applied: '#6b6b6b', assessment: '#0891b2', interview: '#7c3aed', hr_round: '#9333ea',
 rejected: '#dc2626', offer: '#16a34a', joined: '#15803d',
 shortlisted: '#0891b2', hired: '#16a34a', // legacy
}

const BLANK_APPLY = { company: '', role: '', jobUrl: '', date: new Date().toISOString().slice(0,10), notes: '' }

export default function AdminUserDetail() {
 const { id } = useParams<{ id: string }>()
 const { profile: adminProfile } = useAuth()

 const [profile, setProfile] = useState<Profile | null>(null)
 const [details, setDetails] = useState<StudentDetails | ProfessionalDetails | null>(null)
 const [sub, setSub] = useState<Subscription | null>(null)
 const [stats, setStats] = useState<UserAppStats | null>(null)
 const [jobs, setJobs] = useState<Job[]>([])
 const [apps, setApps] = useState<JobApplication[]>([])
 const [matched, setMatched] = useState<Job[]>([])
 const [tab, setTab] = useState<TabType>('profile')
 const [loading, setLoading] = useState(true)
 const [applying, setApplying] = useState<string | null>(null)
 const [applyErr, setApplyErr] = useState<string | null>(null)
 const [skipJob, setSkipJob] = useState<Job | null>(null)
 const [skipMissing, setSkipMissing] = useState<string[]>([])

 // Manual "Apply Job" modal
 const [showModal, setShowModal] = useState(false)
 const [form, setForm] = useState(BLANK_APPLY)
 const [submitting, setSubmitting] = useState(false)
 const [modalErr, setModalErr] = useState<string | null>(null)
 const [deletionReq, setDeletionReq] = useState<{ id: string; reason: string | null; requested_at: string } | null>(null)
 const [resolvingDeletion, setResolvingDeletion] = useState(false)
 const [deletionResolveErr, setDeletionResolveErr] = useState<string | null>(null)

 useEffect(() => { if (id) load(id) }, [id])

 async function load(uid: string) {
 setLoading(true)
 const [pRes, appRes, subRes, statsRes, delReqRes] = await Promise.all([
 supabase.from('profiles').select('*').eq('id', uid).single(),
 supabase.from('job_applications').select('*').eq('user_id', uid).order('applied_at', { ascending: false }),
 supabase.from('subscriptions').select('*').eq('user_id', uid).order('ends_at', { ascending: false }).limit(1).maybeSingle(),
 supabase.rpc('get_user_app_stats', { p_user_id: uid }),
 supabase.from('profile_deletion_requests').select('id,reason,requested_at')
 .eq('user_id', uid).eq('status', 'pending').maybeSingle(),
 ])
 const p = pRes.data as Profile | null
 setProfile(p)
 setApps((appRes.data as JobApplication[]) ?? [])
 setSub((subRes.data as Subscription) ?? null)
 if (!statsRes.error && statsRes.data) setStats(statsRes.data as UserAppStats)
 setDeletionReq((delReqRes.data as typeof deletionReq) ?? null)

 if (p?.user_type === 'student') {
 const { data } = await supabase.from('student_details').select('*').eq('id', uid).single()
 setDetails(data as StudentDetails)
 } else if (p?.user_type === 'professional') {
 const { data } = await supabase.from('professional_details').select('*').eq('id', uid).single()
 setDetails(data as ProfessionalDetails)
 }

 const { data: allJobs } = await supabase.from('jobs').select('*').eq('is_active', true)
 if (allJobs) {
 setJobs(allJobs as Job[])
 const skillsRes = p?.user_type === 'student'
 ? await supabase.from('student_details').select('technical_skills').eq('id', uid).single()
 : await supabase.from('professional_details').select('technical_skills').eq('id', uid).single()
 const userSkills: string[] = skillsRes.data?.technical_skills ?? []
 const matchedJobs = (allJobs as Job[]).filter(j =>
 j.required_skills.some(s => userSkills.map(u => u.toLowerCase()).includes(s.toLowerCase()))
 )
 setMatched(matchedJobs)
 }
 setLoading(false)
 }

 async function resolveDeletion(approve: boolean) {
 if (!deletionReq || !id) return
 setResolvingDeletion(true); setDeletionResolveErr(null)
 try {
 const { error } = await supabase.rpc('admin_resolve_deletion_request', {
 p_request_id: deletionReq.id, p_approve: approve,
 })
 if (error) throw error
 if (approve) {
 // The RPC above only removes the `profiles` row (and cascaded app
 // data). The actual auth.users record, and the email address,
 // still exists until this second step, which needs the service
 // role and can't run in the browser.
 const { data: { session } } = await supabase.auth.getSession()
 const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${session?.access_token}`,
 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
 },
 body: JSON.stringify({ user_id: id, deletion_request_id: deletionReq.id }),
 })
 if (!res.ok) {
 const data = await res.json().catch(() => ({}))
 throw new Error(data.error || 'Profile data was deleted, but the login/email could not be freed up. It may still block re-registration, contact support.')
 }
 window.location.href = '/admin/users'
 } else {
 setDeletionReq(null)
 }
 } catch (err) {
 setDeletionResolveErr((err as Error).message)
 } finally {
 setResolvingDeletion(false)
 }
 }

 async function refreshAppsAndStats() {
 if (!id) return
 const [appsData, statsRes] = await Promise.all([
 supabase.from('job_applications').select('*').eq('user_id', id).order('applied_at', { ascending: false }),
 supabase.rpc('get_user_app_stats', { p_user_id: id }),
 ])
 setApps((appsData.data as JobApplication[]) ?? [])
 if (!statsRes.error && statsRes.data) setStats(statsRes.data as UserAppStats)
 }

 // ── Apply from matched-jobs list ──────────────────────────────
 async function applyForUser(job: Job) {
 if (!id || !adminProfile) return
 setApplying(job.id); setApplyErr(null)
 try {
 const skillsRes = profile?.user_type === 'student'
 ? await supabase.from('student_details').select('technical_skills').eq('id', id).single()
 : await supabase.from('professional_details').select('technical_skills').eq('id', id).single()
 const userSkills: string[] = skillsRes.data?.technical_skills ?? []
 const matchedSkills = job.required_skills.filter(s =>
 userSkills.map(u => u.toLowerCase()).includes(s.toLowerCase())
 )

 const { data: existing } = await supabase.from('job_applications')
 .select('id').eq('user_id', id).eq('job_id', job.id).maybeSingle()
 if (existing) { setApplyErr(`Already applied to ${job.title}`); return }

 const { error } = await supabase.from('job_applications').insert({
 user_id: id, job_id: job.id, job_title: job.title, company: job.company,
 job_url: job.apply_url, admin_id: adminProfile.id, status: 'applied', matched_skills: matchedSkills,
 })
 if (error) throw error

 await supabase.from('job_screening_log').upsert({
 user_id: id, job_id: job.id, decision: 'applied',
 industry_matched: true, skills_matched: matchedSkills.length > 0, experience_matched: true,
 missing_metrics: [],
 }, { onConflict: 'user_id,job_id' })

 await refreshAppsAndStats()
 } catch (err) {
 setApplyErr((err as Error).message)
 } finally {
 setApplying(null)
 }
 }

 async function confirmSkip() {
 if (!id || !skipJob) return
 await supabase.from('job_screening_log').upsert({
 user_id: id, job_id: skipJob.id, decision: 'rejected',
 industry_matched: !skipMissing.includes('industry'),
 skills_matched: !skipMissing.includes('skills'),
 experience_matched: !skipMissing.includes('experience'),
 missing_metrics: skipMissing,
 }, { onConflict: 'user_id,job_id' })
 setSkipJob(null); setSkipMissing([])
 }

 // ── Manual "Apply Job" modal submit ────────────────────────────
 async function handleManualApply(e: FormEvent) {
 e.preventDefault()
 if (!id || !adminProfile) return
 if (!form.company.trim() || !form.role.trim()) { setModalErr('Company and role are required.'); return }
 setSubmitting(true); setModalErr(null)
 try {
 const { error } = await supabase.from('job_applications').insert({
 user_id: id,
 job_id: null,
 job_title: form.role.trim(),
 company: form.company.trim(),
 job_url: form.jobUrl.trim() || null,
 admin_id: adminProfile.id,
 status: 'applied',
 matched_skills: [],
 applied_at: new Date(form.date).toISOString(),
 notes: form.notes.trim() || null,
 })
 if (error) throw error
 await refreshAppsAndStats()
 setShowModal(false)
 setForm(BLANK_APPLY)
 } catch (err) {
 setModalErr((err as Error).message)
 } finally {
 setSubmitting(false)
 }
 }

 async function updateAppStatus(appId: string, status: JobApplication['status']) {
 await supabase.from('job_applications').update({ status }).eq('id', appId)
 setApps(prev => prev.map(a => a.id === appId ? { ...a, status } : a))
 }

 if (loading) return (
 <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontFamily: "'Inter',sans-serif", color: '#9b9b9b', fontSize: 14 }}>Loading…</div>
 )
 if (!profile) return (
 <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontFamily: "'Inter',sans-serif", color: '#9b9b9b', fontSize: 14 }}>User not found.</div>
 )

 const sd = profile.user_type === 'student' ? details as StudentDetails | null : null
 const pd = profile.user_type === 'professional' ? details as ProfessionalDetails | null : null
 const userSkills = (sd?.technical_skills ?? pd?.technical_skills ?? [])

 const tabStyle = (t: TabType): React.CSSProperties => ({
 padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500,
 background: tab === t ? '#0f0f0f' : 'transparent',
 color: tab === t ? '#fff' : '#9b9b9b',
 border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 })

 const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
 <div style={{ background: '#fff', border: '1.5px solid #f0f0f0', borderRadius: 12, padding: '16px 18px' }}>
 <p style={{ fontSize: 11, fontWeight: 600, color: '#b5b5b5', letterSpacing: '0.08em', marginBottom: 6 }}>
 {label.toUpperCase()}
 </p>
 <p style={{ fontSize: 14, color: value ? '#0f0f0f' : '#b5b5b5' }}>{value || 'N/A'}</p>
 </div>
 )

 const inp: React.CSSProperties = {
 height: 42, padding: '0 14px', fontSize: 14, color: '#0f0f0f',
 border: '1.5px solid #e5e5e5', borderRadius: 10, background: '#fff',
 fontFamily: "'Inter',sans-serif", outline: 'none', width: '100%',
 }

 return (
 <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
 {/* Nav */}
 <div style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 28px',
 background: '#0f0f0f', gap: 16 }}>
 <Link to="/admin/users" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>← Users</Link>
 <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{profile.full_name}</span>
 <button onClick={() => setShowModal(true)} style={{
 marginLeft: 'auto', padding: '9px 18px', background: '#fff', color: '#0f0f0f',
 border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
 fontFamily: "'Inter',sans-serif",
 }}>+ Apply Job</button>
 </div>

 <div style={{ maxWidth: 920, margin: '0 auto', padding: '36px 24px' }}>
 {/* Header */}
 <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
 {profile.photo_url || profile.avatar_url ? (
 <img src={profile.photo_url || profile.avatar_url!} alt=""
 style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
 ) : (
 <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#0f0f0f',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 22, fontWeight: 600, color: '#fff' }}>
 {profile.full_name[0]?.toUpperCase()}
 </div>
 )}
 <div>
 <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 26, fontWeight: 400,
 color: '#0f0f0f', marginBottom: 4 }}>{profile.full_name}</h1>
 <p style={{ fontSize: 14, color: '#9b9b9b' }}>{profile.email} ({profile.user_type || 'not set'})</p>
 </div>
 <div style={{ marginLeft: 'auto' }}>
 <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 99,
 background: profile.account_status === 'active' ? '#f0fdf4' : '#f5f5f5',
 color: profile.account_status === 'active' ? '#16a34a' : '#9b9b9b', fontWeight: 600 }}>
 {profile.account_status}
 </span>
 </div>
 </div>

 {/* Pending deletion request */}
 {deletionReq && (
 <div style={{ marginBottom: 24, padding: '16px 20px', background: '#fef2f2',
 border: '1px solid #fecaca', borderRadius: 12, display: 'flex',
 alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
 <div>
 <p style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 2 }}>
 Deletion request pending
 </p>
 <p style={{ fontSize: 12, color: '#b45309' }}>
 Requested {new Date(deletionReq.requested_at).toLocaleString()}
 {deletionReq.reason ? ` ("${deletionReq.reason}")` : ''}
 </p>
 {deletionResolveErr && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{deletionResolveErr}</p>}
 </div>
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <button onClick={() => resolveDeletion(false)} disabled={resolvingDeletion} style={{
 background: '#fff', color: '#0f0f0f', border: '1px solid #e5e5e5', padding: '9px 16px',
 borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: resolvingDeletion ? 'not-allowed' : 'pointer',
 fontFamily: "'Inter',sans-serif",
 }}>Reject</button>
 <button onClick={() => resolveDeletion(true)} disabled={resolvingDeletion} style={{
 background: '#dc2626', color: '#fff', border: 'none', padding: '9px 16px',
 borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: resolvingDeletion ? 'not-allowed' : 'pointer',
 opacity: resolvingDeletion ? 0.7 : 1, fontFamily: "'Inter',sans-serif",
 }}>{resolvingDeletion ? 'Deleting…' : 'Approve & delete'}</button>
 </div>
 </div>
 )}

 {/* Stats strip */}
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
 {[
 { v: stats?.total_applications ?? apps.length, l: 'Total applications', c: '#0f0f0f' },
 { v: stats?.interviews ?? 0, l: 'Interviews', c: '#7c3aed' },
 { v: stats?.rejections ?? 0, l: 'Rejections', c: '#dc2626' },
 { v: stats?.offers ?? 0, l: 'Offers', c: '#16a34a' },
 ].map(({ v, l, c }) => (
 <div key={l} style={{ background: '#fff', border: '1.5px solid #f0f0f0', borderRadius: 12, padding: '14px 16px' }}>
 <span style={{ fontSize: 24, fontWeight: 700, color: c }}>{v}</span>
 <p style={{ fontSize: 12, color: '#9b9b9b', marginTop: 2 }}>{l}</p>
 </div>
 ))}
 </div>

 {/* Tabs */}
 <div style={{ display: 'flex', gap: 6, marginBottom: 28, background: '#f0f0f0',
 padding: 4, borderRadius: 10, width: 'fit-content', flexWrap: 'wrap' }}>
 <button style={tabStyle('profile')} onClick={() => setTab('profile')}>Profile</button>
 <button style={tabStyle('subscription')} onClick={() => setTab('subscription')}>Subscription</button>
 <button style={tabStyle('jobs')} onClick={() => setTab('jobs')}>
 Match jobs ({matched.length})
 </button>
 <button style={tabStyle('applications')} onClick={() => setTab('applications')}>
 Applications ({apps.length})
 </button>
 </div>

 {applyErr && (
 <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2',
 border: '1px solid #fecaca', borderRadius: 10, fontSize: 14, color: '#dc2626' }}>
 {applyErr}
 </div>
 )}

 {/* ── PROFILE TAB ───────────────────────────────────── */}
 {tab === 'profile' && (
 <>
 <p style={{ fontSize: 12, fontWeight: 700, color: '#6b6b6b', letterSpacing: '0.06em',
 marginBottom: 10, marginTop: 4 }}>PERSONAL INFORMATION</p>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
 <Field label="Name" value={profile.full_name} />
 <Field label="Email" value={profile.email} />
 <Field label="Phone" value={profile.mobile_number} />
 <Field label="Experience" value={pd?.years_experience ? `${pd.years_experience} yrs` : sd ? 'Student' : null} />
 <Field label="Education" value={sd ? [sd.degree, sd.branch, sd.college_name].filter(Boolean).join(', ') : null} />
 <Field label="LinkedIn" value={profile.linkedin_url} />
 <Field label="GitHub" value={profile.github_url} />
 <Field label="Portfolio" value={profile.portfolio_url} />
 <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1.5px solid #f0f0f0',
 borderRadius: 12, padding: '16px 18px' }}>
 <p style={{ fontSize: 11, fontWeight: 600, color: '#b5b5b5', letterSpacing: '0.08em', marginBottom: 10 }}>SKILLS</p>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
 {userSkills.length > 0
 ? userSkills.map(s => (
 <span key={s} style={{ fontSize: 13, padding: '4px 12px', background: '#f0f0f0',
 color: '#0f0f0f', borderRadius: 99 }}>{s}</span>
 ))
 : <span style={{ fontSize: 14, color: '#b5b5b5' }}>No skills added yet.</span>}
 </div>
 </div>
 {(sd?.resume_url || pd?.resume_url) && (
 <div style={{ gridColumn: '1 / -1' }}>
 <a href="#" onClick={async e => {
 e.preventDefault()
 const url = sd?.resume_url || pd?.resume_url!
 const { data } = await supabase.storage.from('resumes').createSignedUrl(url, 3600)
 if (data?.signedUrl) window.open(data.signedUrl, '_blank')
 }} style={{ fontSize: 14, color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>
 Download resume
 </a>
 </div>
 )}
 </div>

 <p style={{ fontSize: 12, fontWeight: 700, color: '#6b6b6b', letterSpacing: '0.06em',
 marginBottom: 10 }}>JOB PREFERENCES</p>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
 <Field label="Preferred roles" value={profile.role_interests?.join(', ') || null} />
 <Field label="Preferred locations" value={profile.preferred_locations?.join(', ') || null} />
 <Field label="Salary expectation" value={profile.salary_expectation ? `₹${profile.salary_expectation.toLocaleString('en-IN')}` : null} />
 <Field label="Employment type" value={profile.employment_type} />
 <Field label="Work preference" value={profile.work_preference} />
 </div>
 </>
 )}

 {/* ── SUBSCRIPTION TAB ──────────────────────────────── */}
 {tab === 'subscription' && (
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
 {sub ? (<>
 <Field label="Plan" value={PLANS[sub.plan]?.label ?? sub.plan} />
 <Field label="Status" value={sub.status} />
 <Field label="Start date" value={sub.starts_at ? new Date(sub.starts_at).toLocaleDateString('en-IN') : null} />
 <Field label="Expiry date" value={sub.ends_at ? new Date(sub.ends_at).toLocaleDateString('en-IN') : null} />
 <div style={{ gridColumn: '1 / -1' }}>
 <Link to="/admin/subscriptions" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
 Manage in Subscriptions →
 </Link>
 </div>
 </>) : (
 <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', fontSize: 14, color: '#b5b5b5' }}>
 No subscription on record.
 </div>
 )}
 </div>
 )}

 {/* ── MATCH JOBS TAB ────────────────────────────────── */}
 {tab === 'jobs' && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
 <p style={{ fontSize: 13, color: '#9b9b9b', marginBottom: 8 }}>
 {matched.length} jobs match {profile.first_name || profile.full_name.split(' ')[0]}'s skills.
 </p>
 {matched.length === 0 ? (
 <div style={{ textAlign: 'center', padding: '48px 0', fontSize: 14, color: '#b5b5b5' }}>
 No matches yet. Add more jobs or wait for skills to be updated.
 </div>
 ) : matched.map(job => {
 const alreadyApplied = apps.some(a => a.job_id === job.id)
 const overlap = job.required_skills.filter(s =>
 userSkills.map(u => u.toLowerCase()).includes(s.toLowerCase())
 )
 return (
 <div key={job.id} style={{
 display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
 padding: '18px 20px', background: '#fff',
 border: '1.5px solid #f0f0f0', borderRadius: 12, gap: 16,
 }}>
 <div style={{ flex: 1 }}>
 <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f0f', marginBottom: 3 }}>{job.title}</p>
 <p style={{ fontSize: 13, color: '#9b9b9b', marginBottom: 8 }}>
 {job.company}, {job.job_type || 'full-time'}, {job.location || 'Remote'}
 </p>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
 {overlap.map(s => (
 <span key={s} style={{ fontSize: 11, padding: '3px 8px', background: '#eff6ff',
 color: '#2563eb', borderRadius: 99 }}>{s}</span>
 ))}
 </div>
 </div>
 {alreadyApplied ? (
 <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 500, flexShrink: 0 }}> Applied</span>
 ) : (
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <button onClick={() => setSkipJob(job)} style={{
 padding: '9px 14px', background: '#fff', color: '#6b6b6b',
 border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 13, fontWeight: 500,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>
 Skip
 </button>
 <button onClick={() => applyForUser(job)} disabled={applying === job.id} style={{
 padding: '9px 18px', background: applying === job.id ? '#f0f0f0' : '#0f0f0f',
 color: applying === job.id ? '#9b9b9b' : '#fff',
 border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
 cursor: applying === job.id ? 'not-allowed' : 'pointer',
 fontFamily: "'Inter',sans-serif",
 }}>
 {applying === job.id ? 'Applying…' : 'Apply →'}
 </button>
 </div>
 )}
 </div>
 )
 })}
 </div>
 )}

 {/* ── APPLICATIONS TAB ──────────────────────────────── */}
 {tab === 'applications' && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
 <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
 <button onClick={() => setShowModal(true)} style={{
 padding: '8px 16px', background: '#0f0f0f', color: '#fff', border: 'none',
 borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>+ Apply Job</button>
 </div>
 {apps.length === 0 ? (
 <div style={{ textAlign: 'center', padding: '48px 0', fontSize: 14, color: '#b5b5b5' }}>
 No applications yet.
 </div>
 ) : apps.map(app => (
 <div key={app.id} style={{
 display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 padding: '16px 20px', background: '#fff',
 border: '1.5px solid #f0f0f0', borderRadius: 12, gap: 12, flexWrap: 'wrap',
 }}>
 <div>
 <p style={{ fontSize: 15, fontWeight: 500, color: '#0f0f0f', marginBottom: 2 }}>
 {app.job_title || 'Role'}
 </p>
 <p style={{ fontSize: 13, color: '#9b9b9b' }}>
 {app.company || 'N/A'}, {new Date(app.applied_at).toLocaleDateString('en-IN')}
 {app.job_url && <>, <a href={app.job_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>job link</a></>}
 </p>
 {app.notes && <p style={{ fontSize: 12, color: '#b5b5b5', marginTop: 4 }}>{app.notes}</p>}
 </div>
 <select value={app.status}
 onChange={e => updateAppStatus(app.id, e.target.value as JobApplication['status'])}
 style={{
 fontSize: 13, fontWeight: 600, padding: '5px 10px', borderRadius: 8,
 border: '1.5px solid #e5e5e5', background: (STATUS_COLOR[app.status] ?? '#6b6b6b') + '18',
 color: STATUS_COLOR[app.status] ?? '#6b6b6b', fontFamily: "'Inter',sans-serif", cursor: 'pointer', outline: 'none',
 }}>
 {(STATUS_OPTS.includes(app.status) ? STATUS_OPTS : [app.status, ...STATUS_OPTS]).map(s =>
 <option key={s} value={s}>{s.replace('_',' ')}</option>)}
 </select>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* ── APPLY JOB MODAL ──────────────────────────────────── */}
 {showModal && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.5)', display: 'flex',
 alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
 onClick={() => !submitting && setShowModal(false)}>
 <form onClick={e => e.stopPropagation()} onSubmit={handleManualApply} style={{
 width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18, padding: '28px 26px',
 display: 'flex', flexDirection: 'column', gap: 14,
 }}>
 <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 22, fontWeight: 400, color: '#0f0f0f' }}>
 Apply for {profile.first_name || profile.full_name.split(' ')[0]}
 </h2>

 {modalErr && (
 <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
 borderRadius: 10, fontSize: 13, color: '#dc2626' }}> {modalErr}</div>
 )}

 <div>
 <label style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b' }}>Company name</label>
 <input style={{ ...inp, marginTop: 6 }} value={form.company}
 onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Microsoft" required />
 </div>
 <div>
 <label style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b' }}>Job role</label>
 <input style={{ ...inp, marginTop: 6 }} value={form.role}
 onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Software Engineer" required />
 </div>
 <div>
 <label style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b' }}>Job URL</label>
 <input style={{ ...inp, marginTop: 6 }} value={form.jobUrl}
 onChange={e => setForm(f => ({ ...f, jobUrl: e.target.value }))} placeholder="https://…" type="url" />
 </div>
 <div>
 <label style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b' }}>Date applied</label>
 <input style={{ ...inp, marginTop: 6 }} type="date" value={form.date}
 onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
 </div>
 <div>
 <label style={{ fontSize: 12, fontWeight: 600, color: '#6b6b6b' }}>Notes</label>
 <textarea style={{ ...inp, marginTop: 6, height: 70, padding: '10px 14px', resize: 'vertical' }}
 value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
 placeholder="Optional notes…" />
 </div>

 <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
 <button type="button" onClick={() => setShowModal(false)} disabled={submitting} style={{
 flex: 1, height: 44, background: '#f5f5f5', color: '#6b6b6b', border: 'none',
 borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>Cancel</button>
 <button type="submit" disabled={submitting} style={{
 flex: 2, height: 44, background: submitting ? '#3a3a3a' : '#0f0f0f', color: '#fff', border: 'none',
 borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
 fontFamily: "'Inter',sans-serif",
 }}>{submitting ? 'Saving…' : ' Mark as Applied'}</button>
 </div>
 </form>
 </div>
 )}

 {skipJob && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
 display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
 <div style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 380, width: '100%',
 fontFamily: "'Inter',sans-serif" }}>
 <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Skip {skipJob.title}?</h3>
 <p style={{ fontSize: 13, color: '#6b6b6b', marginBottom: 14 }}>What's missing</p>
 {['industry', 'skills', 'experience'].map(m => (
 <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8,
 padding: '8px 0', fontSize: 14, cursor: 'pointer', textTransform: 'capitalize' }}>
 <input type="checkbox" checked={skipMissing.includes(m)}
 onChange={e => setSkipMissing(prev =>
 e.target.checked ? [...prev, m] : prev.filter(x => x !== m))} />
 {m}
 </label>
 ))}
 <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
 <button onClick={() => { setSkipJob(null); setSkipMissing([]) }} style={{
 flex: 1, height: 40, background: '#f5f5f5', color: '#6b6b6b', border: 'none',
 borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>Cancel</button>
 <button onClick={confirmSkip} disabled={skipMissing.length === 0} style={{
 flex: 1, height: 40, background: skipMissing.length ? '#0f0f0f' : '#cfcfcf', color: '#fff',
 border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 600,
 cursor: skipMissing.length ? 'pointer' : 'not-allowed', fontFamily: "'Inter',sans-serif",
 }}>Confirm skip</button>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
