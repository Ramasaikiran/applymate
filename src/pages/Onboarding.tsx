import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, type UserType } from '../lib/supabase'
import { pickFile } from '../lib/filePicker'
import { uploadResumeWithProgress } from '../lib/uploadResume'
import { routePostAuth } from '../lib/routing'

/* ── Shared style helpers ──────────────────────────────────── */
const inp = (err?: string): React.CSSProperties => ({
 width: '100%', height: 48, padding: '0 16px',
 fontFamily: "'Inter',sans-serif", fontSize: 15, color: '#0f0f0f',
 background: '#fff',
 border: `1.5px solid ${err ? '#ef4444' : '#e5e5e5'}`,
 borderRadius: 12, outline: 'none', boxSizing: 'border-box',
 boxShadow: err ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
})
const btn: React.CSSProperties = {
 width: '100%', height: 50,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 600,
 color: '#fff', background: '#0f0f0f', border: 'none',
 borderRadius: 12, cursor: 'pointer',
}
const ghostBtn: React.CSSProperties = {
 width: '100%', height: 44, background: 'none',
 border: '1.5px solid #e5e5e5', borderRadius: 12,
 fontSize: 14, color: '#9b9b9b', cursor: 'pointer',
 fontFamily: "'Inter',sans-serif",
}
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
const sectionLabel: React.CSSProperties = {
 fontSize: 11, fontWeight: 600, color: '#b5b5b5',
 letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10,
}
const serif: React.CSSProperties = {
 fontFamily: "'Instrument Serif',Georgia,serif",
 fontSize: 32, fontWeight: 400, color: '#0f0f0f',
 lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 28,
}

function Field({ label, error, children, half }: {
 label: string; error?: string; children: React.ReactNode; half?: boolean
}) {
 return (
 <div style={half ? {} : {}}>
 <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6b6b6b', marginBottom: 7 }}>
 {label}
 </label>
 {children}
 {error && <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444' }}>{error}</p>}
 </div>
 )
}

const STEP_LABELS = ['Basics', 'Education', 'Skills', 'Resume']

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#b5b5b5', letterSpacing: '0.06em' }}>
          STEP {step} OF {total}: {STEP_LABELS[step - 1]?.toUpperCase()}
        </span>
        <span style={{ fontSize: 12, color: '#b5b5b5' }}>{Math.round((step / total) * 100)}% complete</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 99, overflow: 'hidden', background: '#f0f0f0',
          }}>
            <div style={{
              height: '100%', borderRadius: 99,
              background: i < step ? '#0f0f0f' : 'transparent',
              width: i < step ? '100%' : '0%',
              transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
        ))}
      </div>
    </div>
  )
}

const ROLES = ['SDE / Software Engineer','Frontend Engineer','Backend Engineer','Full Stack Engineer',
 'ML / AI Engineer','Data Scientist','Data Analyst','Other']

const COUNTRIES = ['India','United States','United Kingdom','Canada','Australia','Singapore','UAE','Germany','Other']
const DEGREES = ['B.Tech / B.E.','B.Sc','BCA','M.Tech / M.E.','M.Sc','MCA','MBA','Diploma','Other']
const BRANCHES = ['Computer Science','Information Technology','Electronics & Communication',
 'Electrical Engineering','Mechanical Engineering','Civil Engineering','Data Science','Artificial Intelligence','Other']
const YEARS = ['1st Year','2nd Year','3rd Year','4th Year','Graduated']
const NOTICE = ['Immediately','15 Days','30 Days','45 Days','60 Days','90 Days']

// Degree total duration map (years)
const DEGREE_DURATION: Record<string, number> = {
 'B.Tech / B.E.': 4, 'B.Sc': 3, 'BCA': 3,
 'M.Tech / M.E.': 2, 'M.Sc': 2, 'MCA': 3, 'MBA': 2, 'Diploma': 3, 'Other': 4,
}

// Year label → years remaining until graduation
const YEAR_REMAINING: Record<string, number> = {
 '1st Year': 3, '2nd Year': 2, '3rd Year': 1, '4th Year': 0, 'Graduated': -1,
}

function calcPassoutYear(currentYear: string, degree: string): number | null {
 if (!currentYear || !degree) return null
 const rem = YEAR_REMAINING[currentYear]
 if (rem === undefined) return null
 if (rem === -1) return null // Graduated, user enters manually
 const dur = DEGREE_DURATION[degree] || 4
 const yrIndex = dur - rem // which year number they're in
 const yearsLeft = dur - yrIndex
 return new Date().getFullYear() + yearsLeft
}

function isValidLinkedIn(url: string) {
 return /linkedin\.com\/(in|pub)\//i.test(url.trim())
}

function isValidGitHub(url: string) {
 return /github\.com\/[a-zA-Z0-9_-]+/i.test(url.trim())
}

// ── Draft persistence ───────────────────────────────────────────
// Mobile browsers can fully reload a backgrounded tab (e.g. after the OS
// file picker opens for resume upload), wiping all React state. Persisting
// the serializable fields means a reload mid-flow restores exactly where
// the user left off instead of bouncing them back to step 1.
const DRAFT_KEY = 'oc_onboarding_draft_v1'
const RESUME_INFLIGHT_KEY = 'oc_onboarding_resume_inflight_v1'

interface OnboardingDraft {
 step: number; role: UserType | null
 firstName: string; lastName: string; mobile: string; linkedin: string; github: string
 country: string; address: string; roleInts: string[]; otherRole: string
 college: string; degree: string; branch: string; currentYear: string; passoutYear: string
 cgpa: string; cgpaScale: '10' | '5'; internDone: boolean | null; internDetail: string; skills: string; projects: string
 yearsExp: string; prevTitle: string; prevCompany: string; prevSalary: string; noticeStr: string
 resumePath: string | null; resumeName: string | null
 expectedSalary: string; reasonChange: string; prevProjects: string
}

function loadDraft(): Partial<OnboardingDraft> {
 try {
 const raw = sessionStorage.getItem(DRAFT_KEY)
 return raw ? JSON.parse(raw) : {}
 } catch { return {} }
}

function clearDraft() {
 try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
}

export default function Onboarding() {
 const { user, profile, refreshProfile, signOut } = useAuth()
 const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editMode = searchParams.get('edit') === 'resume'
 const draft = useRef(loadDraft()).current

 // ── Guard: block re-registration ──────────────────────────────
 useEffect(() => {
 if (!profile) return
 // Admin should never be in onboarding
 if (profile.is_admin) { navigate('/admin', { replace: true }); return }
 // Already onboarded → skip to next step
    if (editMode) return
 if (profile.user_type) { navigate('/dashboard', { replace: true }); return }
 }, [profile, navigate])

  const [step, setStep] = useState(editMode ? 1 : (draft.step ?? 1))
 const [role, setRole] = useState<UserType | null>(draft.role ?? (editMode ? (profile?.user_type as UserType ?? null) : null))
 const [errors, setErrors] = useState<Record<string, string>>({})
 const [loading, setLoading] = useState(false)
 const [error, setError] = useState<string | null>(null)

 // Resume-edit mode loads straight to step 1, where resume upload lives,
 // backfill role from the existing profile once it's fetched.
 useEffect(() => {
   if (editMode && !role && profile?.user_type) setRole(profile.user_type as UserType)
 }, [editMode, role, profile])

 // ── Step 2: Personal info ─────────────────────────────────────
 const [firstName, setFirstName] = useState(draft.firstName ?? '')
 const [lastName, setLastName] = useState(draft.lastName ?? '')
 const [mobile, setMobile] = useState(draft.mobile ?? '')
 const [linkedin, setLinkedin] = useState(draft.linkedin ?? '')
 const [github, setGithub] = useState(draft.github ?? '')
 const [country, setCountry] = useState(draft.country ?? 'India')
 const [address, setAddress] = useState(draft.address ?? '')
 const [roleInts, setRoleInts] = useState<string[]>(draft.roleInts ?? [])
 const [otherRole, setOtherRole] = useState(draft.otherRole ?? '')
 const [photoFile, setPhotoFile] = useState<File | null>(null)
 const [photoPreview, setPhotoPreview] = useState<string | null>(null)

 // ── Step 3: Academic / professional ─────────────────────────
 // Student
 const [college, setCollege] = useState(draft.college ?? '')
 const [degree, setDegree] = useState(draft.degree ?? '')
 const [branch, setBranch] = useState(draft.branch ?? '')
 const [currentYear, setCurrentYear] = useState(draft.currentYear ?? '')
 const [passoutYear, setPassoutYear] = useState(draft.passoutYear ?? '')
 const [cgpa, setCgpa] = useState(draft.cgpa ?? '')
 const [cgpaScale, setCgpaScale] = useState<'10' | '5'>(draft.cgpaScale ?? '10')
 const [expectedSalary, setExpectedSalary] = useState(draft.expectedSalary ?? '')
 const [internDone, setInternDone] = useState<boolean | null>(draft.internDone ?? null)
 const [internDetail, setInternDetail] = useState(draft.internDetail ?? '')
 const [skills, setSkills] = useState(draft.skills ?? '')
 const [projects, setProjects] = useState(draft.projects ?? '')

 // Professional
 const [yearsExp, setYearsExp] = useState(draft.yearsExp ?? '')
 const [prevTitle, setPrevTitle] = useState(draft.prevTitle ?? '')
 const [prevCompany, setPrevCompany] = useState(draft.prevCompany ?? '')
 const [prevSalary, setPrevSalary] = useState(draft.prevSalary ?? '')
 const [reasonChange, setReasonChange] = useState(draft.reasonChange ?? '')
 const [prevProjects, setPrevProjects] = useState(draft.prevProjects ?? '')
 const [noticeStr, setNoticeStr] = useState(draft.noticeStr ?? '')

 // ── Step 4: Resume ─────────────────────────────────────────
 // Uploaded immediately on selection (not deferred to final submit) so the
 // file itself survives even if the tab fully reloads afterward, only the
 // resulting storage path (a string) needs to be remembered, and strings
 // persist fine in sessionStorage.
 const [resumePath, setResumePath] = useState<string | null>(draft.resumePath ?? null)
 const [resumeName, setResumeName] = useState<string | null>(draft.resumeName ?? null)
 const [resumeUploading, setResumeUploading] = useState(false)
 const [resumeUploadPct, setResumeUploadPct] = useState(0)
 const [resumeUploadAttempt, setResumeUploadAttempt] = useState(1)
 const [resumeParsing, setResumeParsing] = useState(false)
 const [resumeParsed, setResumeParsed] = useState(false)
 const [resumeParseErr, setResumeParseErr] = useState<string | null>(null)
 const [resumeUploadErr, setResumeUploadErr] = useState<string | null>(
 (() => {
 try {
 if (sessionStorage.getItem(RESUME_INFLIGHT_KEY)) {
 sessionStorage.removeItem(RESUME_INFLIGHT_KEY)
 return 'Your last upload didn\'t finish, likely a slow or dropped connection. Try again on a stronger connection, or switch to Wi-Fi if possible.'
 }
 } catch { /* noop */ }
 return null
 })()
 )
 const photoRef = useRef<HTMLInputElement>(null)

 // ── Persist draft on every relevant change ──────────────────────
 useEffect(() => {
 const d: OnboardingDraft = {
 step, role, firstName, lastName, mobile, linkedin, github, country, address,
 roleInts, otherRole, college, degree, branch, currentYear, passoutYear, cgpa, cgpaScale,
 internDone, internDetail, skills, projects, yearsExp, prevTitle, prevCompany,
 prevSalary, noticeStr, resumePath, resumeName, expectedSalary, reasonChange, prevProjects,
 }
 try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* noop */ }
 }, [step, role, firstName, lastName, mobile, linkedin, github, country, address,
 roleInts, otherRole, college, degree, branch, currentYear, passoutYear, cgpa, cgpaScale,
 internDone, internDetail, skills, projects, yearsExp, prevTitle, prevCompany,
 prevSalary, noticeStr, resumePath, resumeName, expectedSalary, reasonChange, prevProjects])

 async function handleResumeSelect(file: File | null) {
 if (!file) return
 // Mobile file providers (Google Drive, Files app, some Android pickers)
 // frequently report a blank or generic MIME type ('', 'application/octet-stream')
 // for a real PDF instead of 'application/pdf'. Extension is the reliable signal;
 // only reject when the browser reports a MIME type that clearly isn't a PDF.
 const nameIsPdf = file.name.toLowerCase().endsWith('.pdf')
 const mimeOk = file.type === '' || file.type === 'application/pdf' || file.type === 'application/octet-stream'
 if (!nameIsPdf || !mimeOk) { setResumeUploadErr('PDF only. Please upload a .pdf file.'); return }
 if (file.size > 5 * 1024 * 1024) { setResumeUploadErr('Max 5MB.'); return }
 setResumeUploadErr(null); setResumeUploading(true)
 try { sessionStorage.setItem(RESUME_INFLIGHT_KEY, '1') } catch { /* noop */ }
 try {
 // Auth can lag a beat after an OS file-picker remount, especially on
 // mobile where backgrounding the tab can delay session rehydration.
 // Poll briefly instead of failing on the first empty read.
 let uid = user?.id ?? null
 for (let attempt = 0; attempt < 15 && !uid; attempt++) {
 const { data: { session } } = await supabase.auth.getSession()
 uid = session?.user?.id ?? null
 if (!uid) await new Promise(r => setTimeout(r, 400))
 }
 if (!uid) throw new Error('Session expired. Please sign in again.')
 const path = `${uid}/${Date.now()}-${file.name}`
 setResumeUploadPct(0); setResumeUploadAttempt(1)
 await uploadResumeWithProgress(file, path, (p) => {
 setResumeUploadPct(p.percent)
 setResumeUploadAttempt(p.attempt)
 })
 setResumePath(path)
 setResumeName(file.name)
 parseResume(path)
 } catch (err) {
 console.error('Resume upload error:', err)
 setResumeUploadErr(`Upload failed: ${(err as Error).message}. You can retry or skip and add it later.`)
 } finally {
 setResumeUploading(false)
 try { sessionStorage.removeItem(RESUME_INFLIGHT_KEY) } catch { /* noop */ }
 }
 }

 async function parseResume(path: string) {
 setResumeParsing(true)
 setResumeParseErr(null)
 setResumeParsed(false)
 try {
 const { data, error: fnErr } = await supabase.functions.invoke('parse-resume', { body: { resume_path: path } })
 if (fnErr) throw fnErr
 const p = data?.data as Record<string, string | null> | undefined
 if (!p) throw new Error('No data returned')

 // Only fill fields we don't already have a better answer for — never
 // clobber something the user has already typed in this session.
 if ((p.role_suggestion === 'student' || p.role_suggestion === 'professional') && !role) setRole(p.role_suggestion as UserType)
 if (p.first_name && !firstName) setFirstName(p.first_name)
 if (p.last_name && !lastName) setLastName(p.last_name)
 if (p.mobile && !mobile) setMobile(p.mobile)
 if (p.linkedin && !linkedin) setLinkedin(p.linkedin)
 if (p.github && !github) setGithub(p.github)
 if (p.address && !address) setAddress(p.address)
 if (p.college && !college) setCollege(p.college)
 if (p.degree && !degree) setDegree(p.degree)
 if (p.branch && !branch) setBranch(p.branch)
 if (p.current_year && !currentYear) setCurrentYear(p.current_year)
 if (p.passout_year && !passoutYear) setPassoutYear(p.passout_year)
 if (p.cgpa && !cgpa) setCgpa(p.cgpa)
 if (p.skills && !skills) setSkills(p.skills)
 if (p.projects && !projects) setProjects(p.projects)
 if (p.years_exp && !yearsExp) setYearsExp(p.years_exp)
 if (p.prev_title && !prevTitle) setPrevTitle(p.prev_title)
 if (p.prev_company && !prevCompany) setPrevCompany(p.prev_company)
 setResumeParsed(true)
 } catch (err) {
 console.error('Resume parse error:', err)
 setResumeParseErr('Could not auto-fill from your resume. No problem — just fill the next steps in yourself.')
 } finally {
 setResumeParsing(false)
 }
 }

 const totalSteps = 4
 const isExperienced = role === 'professional' && Number(yearsExp) >= 2

 function toggleRole(r: string) {
 setRoleInts(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
 }

 function onPhotoChange(e: ChangeEvent<HTMLInputElement>) {
 const f = e.target.files?.[0] ?? null
 setPhotoFile(f)
 if (f) setPhotoPreview(URL.createObjectURL(f))
 }

 function validate2() {
 const errs: Record<string, string> = {}
 if (!firstName.trim()) errs.firstName = 'Required'
 if (!lastName.trim()) errs.lastName = 'Required'
 if (!mobile.trim() || !/^\+?[\d\s-]{10,15}$/.test(mobile.trim())) errs.mobile = 'Enter valid mobile number'
 if (!linkedin.trim()) errs.linkedin = 'LinkedIn profile is required'
 else if (!isValidLinkedIn(linkedin)) errs.linkedin = 'Enter a valid LinkedIn URL (linkedin.com/in/yourname)'
 if (!github.trim()) errs.github = 'GitHub profile is required'
 else if (!isValidGitHub(github)) errs.github = 'Enter a valid GitHub URL (github.com/yourname)'
 if (roleInts.length === 0) errs.roleInts = 'Select at least one role'
 setErrors(errs)
 return Object.keys(errs).length === 0
 }

 function validate3() {
 const errs: Record<string, string> = {}
 if (!skills.trim()) errs.skills = 'Add at least one skill'
 if (!expectedSalary.trim()) errs.expectedSalary = 'Required'
 if (role === 'student') {
 if (!college.trim()) errs.college = 'Required'
 if (!degree) errs.degree = 'Required'
 if (!currentYear) errs.currentYear = 'Required'
 if (!cgpa.trim()) errs.cgpa = 'Required'
 if (internDone === null) errs.internDone = 'Required'
 if (!projects.trim()) errs.projects = 'Required'
 }
 if (role === 'professional') {
 if (!yearsExp) errs.yearsExp = 'Required'
 if (!prevTitle.trim()) errs.prevTitle = 'Required'
 if (!prevProjects.trim()) errs.prevProjects = 'Required'
 if (!reasonChange.trim()) errs.reasonChange = 'Required'
 }
 setErrors(errs)
 return Object.keys(errs).length === 0
 }

 async function handleFinish(e: FormEvent) {
 e.preventDefault()
 if (!user || !role) {
 setError(!user
 ? 'Your session expired, please refresh the page and log in again.'
 : 'Something went wrong loading your role. Please refresh and try again.')
 window.scrollTo({ top: 0, behavior: 'smooth' })
 return
 }
 setError(null); setLoading(true)

 const skillsArr = skills.split(',').map(s => s.trim()).filter(Boolean)
 const noticeDays = noticeStr === 'Immediately' ? 0 : noticeStr ? parseInt(noticeStr) : null
 const resumeUrl: string | null = resumePath // already uploaded the moment it was selected
 let photoUrl: string | null = null

 // ── Upload photo (never block on failure) ─────────────────────
 if (photoFile) {
 try {
 const path = `${user.id}/${Date.now()}-${photoFile.name}`
 const { error: upErr } = await supabase.storage.from('photos').upload(path, photoFile, { upsert: true })
 if (!upErr) {
 photoUrl = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
 } else {
 console.warn('Photo upload skipped:', upErr.message)
 }
 } catch (e) { console.warn('Photo upload error:', e) }
 }

 // ── Update profile ─────────────────────────────────────────────
 let profileSaveFailed = false
 try {
 const { error: profErr } = await supabase.from('profiles').upsert({
 id: user.id,
 email: user.email,
 first_name: firstName.trim(),
 last_name: lastName.trim(),
 full_name: `${firstName.trim()} ${lastName.trim()}`,
 mobile_number: mobile.trim(),
 linkedin_url: linkedin.trim() || null,
 github_url: github.trim() || null,
 country,
 address: address.trim() || null,
 role_interests: roleInts.includes('Other') && otherRole.trim()
 ? roleInts.filter(r => r !== 'Other').concat(otherRole.trim())
 : roleInts,
 user_type: role,
 account_status: 'active',
 photo_url: photoUrl,
 })
 if (profErr) { console.error('Profile save error:', profErr); profileSaveFailed = true
 setError(`Couldn't save your profile: ${profErr.message}. Please try again, your details weren't lost.`) }
 } catch (e) {
 console.error('Profile upsert error:', e); profileSaveFailed = true
 setError(`Couldn't save your profile: ${(e as Error).message}. Please try again, your details weren't lost.`)
 }

 if (profileSaveFailed) { setLoading(false); window.scrollTo({ top: 0, behavior: 'smooth' }); return }

 // ── Save detail table ─────────────────────────────────────────
 let detailSaveFailed = false
 try {
 if (role === 'student') {
 const { error: dErr } = await supabase.from('student_details').upsert({
 id: user.id,
 college_name: college.trim() || null,
 degree: degree || null,
 branch: branch || null,
 current_year: currentYear || null,
 passout_year: passoutYear ? parseInt(passoutYear) : null,
 cgpa: cgpa ? parseFloat(cgpa) : null,
 cgpa_scale: cgpaScale,
 internship_done: internDone === true,
 internship_details: internDone ? internDetail.trim() || null : 'NA',
 technical_skills: skillsArr,
 projects: projects.trim() || null,
 expected_salary: expectedSalary.trim() || null,
 resume_url: resumeUrl,
 })
 if (dErr) { console.error('Student details error:', dErr); detailSaveFailed = true
 setError(`Couldn't save your details: ${dErr.message}. Please try again.`) }
 } else {
 const { error: dErr } = await supabase.from('professional_details').upsert({
 id: user.id,
 years_experience: yearsExp ? parseFloat(yearsExp) : null,
 previous_job_title: prevTitle.trim() || null,
 previous_company: prevCompany.trim() || null,
 previous_salary: prevSalary ? parseFloat(prevSalary) : null,
 previous_projects: prevProjects.trim() || null,
 reason_for_change: reasonChange.trim() || null,
 expected_salary: expectedSalary.trim() || null,
 notice_period: noticeStr !== '',
 notice_period_days: noticeDays,
 technical_skills: skillsArr,
 resume_url: resumeUrl,
 })
 if (dErr) { console.error('Professional details error:', dErr); detailSaveFailed = true
 setError(`Couldn't save your details: ${dErr.message}. Please try again.`) }
 }
 } catch (e) {
 console.error('Detail table error:', e); detailSaveFailed = true
 setError(`Couldn't save your details: ${(e as Error).message}. Please try again.`)
 }

 if (detailSaveFailed) { setLoading(false); window.scrollTo({ top: 0, behavior: 'smooth' }); return }

 // ── Only navigate once everything actually saved ────────────────
 setLoading(false)
 clearDraft()
 await refreshProfile()
 // Route by subscription status, not a hardcoded dashboard redirect —
 // a freshly onboarded user with no active plan should land on
 // /subscription to pay, not skip straight to the dashboard.
 try {
 await routePostAuth(user.id, navigate)
 } catch {
 navigate('/subscription')
 }
 }

 /* ── Render ─────────────────────────────────────────────────── */
 return (
 <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "'Inter',-apple-system,sans-serif" }}>

 {/* Navbar */}
 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 60,
 display: 'flex', alignItems: 'center', padding: '0 28px',
 background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)',
 borderBottom: '1px solid #f0f0f0', zIndex: 50 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f7f7f5',
 border: '1px solid #ececec', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <img src="/logo-mark.png" alt="ApplyMate" style={{ width: 26, height: 26, objectFit: 'contain' }} />
 </div>
 <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>ApplyMate</span>
 </div>
 <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
 <span style={{ fontSize: 13, color: '#b5b5b5' }}>
 Need help? <a href="mailto:support@applymate.in"
 style={{ color: '#6b6b6b', textDecoration: 'none', fontWeight: 500 }}>Contact us</a>
 </span>
 <button onClick={() => signOut()} style={{ background: 'none', border: 'none',
 fontSize: 13, color: '#666', cursor: 'pointer', fontWeight: 500 }}>
 Logout
 </button>
 </div>
 </div>

 <div style={{ paddingTop: 100, paddingBottom: 80, maxWidth: 620, margin: '0 auto', padding: '100px 24px 80px' }}>
 <ProgressBar step={step} total={totalSteps} />

 {error && (
 <div style={{ marginBottom: 24, padding: '14px 16px', background: '#fef2f2',
 border: '1px solid #fecaca', borderRadius: 12, fontSize: 14, color: '#dc2626' }}>
 {error}
 </div>
 )}

 {/* ── STEP 1: Resume + Role ─────────────────────────────── */}
 {step === 1 && (
 <div className="anim-slide-up">
 <p style={sectionLabel}>LET'S SET UP YOUR PROFILE</p>
 <h1 style={{ ...serif, fontSize: 36, marginBottom: 10 }}>Start with your resume</h1>
 <p style={{ fontSize: 15, color: '#9b9b9b', marginBottom: 28 }}>
 Upload it and we'll fill in the next steps for you. Nothing here is shared until you choose to apply.
 </p>

 <button type="button" disabled={resumeUploading || resumeParsing} onClick={async () => {
 const f = await pickFile('application/pdf,.pdf')
 if (f) handleResumeSelect(f)
 }} style={{
 width: '100%', textAlign: 'inherit', font: 'inherit', appearance: 'none',
 display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
 gap: 12, padding: '32px 24px', marginBottom: 24,
 background: resumePath ? '#f0fdf4' : '#f7f7f7',
 border: `2px dashed ${resumePath ? '#22c55e' : '#e5e5e5'}`,
 borderRadius: 16, cursor: (resumeUploading || resumeParsing) ? 'wait' : 'pointer', transition: 'all 0.2s',
 }}>
 {resumeUploading ? (
 <>
 <div style={{ width: 28, height: 28, borderRadius: '50%',
 border: '3px solid #e5e5e5', borderTopColor: '#0f0f0f',
 animation: 'spin 0.8s linear infinite' }} />
 <p style={{ fontSize: 14, color: '#6b6b6b' }}>
 {resumeUploadAttempt > 1
 ? `Connection dropped, retrying (attempt ${resumeUploadAttempt}) ${resumeUploadPct}%`
 : `Uploading… ${resumeUploadPct}%`}
 </p>
 <div style={{ width: '80%', maxWidth: 240, height: 4, background: '#e5e5e5', borderRadius: 2, overflow: 'hidden' }}>
 <div style={{ width: `${resumeUploadPct}%`, height: '100%', background: '#0f0f0f', transition: 'width 0.2s' }} />
 </div>
 </>
 ) : resumeParsing ? (
 <>
 <div style={{ width: 28, height: 28, borderRadius: '50%',
 border: '3px solid #e5e5e5', borderTopColor: '#0f0f0f',
 animation: 'spin 0.8s linear infinite' }} />
 <p style={{ fontSize: 14, color: '#6b6b6b' }}>Reading your resume…</p>
 </>
 ) : resumePath ? (
 <>
 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
 <polyline points="20 6 9 17 4 12"/>
 </svg>
 <p style={{ fontSize: 15, fontWeight: 600, color: '#16a34a' }}>{resumeName}</p>
 <p style={{ fontSize: 13, color: '#9b9b9b' }}>
 {resumeParsed ? 'Details filled in below — click to replace' : 'Uploaded, click to replace'}
 </p>
 </>
 ) : (
 <>
 <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fff',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" strokeWidth="1.8">
 <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
 <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
 </svg>
 </div>
 <div style={{ textAlign: 'center' }}>
 <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f0f' }}>Upload resume</p>
 <p style={{ fontSize: 13, color: '#b5b5b5', marginTop: 4 }}>PDF only, Max 5MB — we'll auto-fill the rest</p>
 </div>
 </>
 )}
 </button>
 {resumeUploadErr && (
 <p style={{ fontSize: 13, color: '#dc2626', marginTop: -14, marginBottom: 20 }}>{resumeUploadErr}</p>
 )}
 {resumeParseErr && (
 <p style={{ fontSize: 13, color: '#c2410c', marginTop: -14, marginBottom: 20 }}>{resumeParseErr}</p>
 )}

 <p style={sectionLabel}>WHO ARE WE APPLYING FOR?</p>
 <p style={{ fontSize: 14, color: '#9b9b9b', marginBottom: 16 }}>
 This shapes which jobs we target and how we tailor each application.
 </p>
 <div style={grid2}>
 {([
 { type: 'student' as UserType, icon: '', title: "I'm a student", desc: 'Internships or first job after college.' },
 { type: 'professional' as UserType, icon: '', title: 'Working professional', desc: "I've worked before and I'm levelling up." },
 ]).map(r => (
 <button key={r.type} onClick={() => { setRole(r.type); setStep(2) }} style={{
 background: '#fff',
 border: role === r.type ? '1.5px solid #22c55e' : '1.5px solid #e8e8e8',
 borderRadius: 16, padding: '24px 20px', textAlign: 'left', cursor: 'pointer',
 boxShadow: role === r.type ? '0 0 0 3px rgba(34,197,94,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
 transition: 'all 0.15s', position: 'relative',
 }}>
 {role === r.type && resumeParsed && (
 <span style={{ position: 'absolute', top: -10, right: 14, fontSize: 10, fontWeight: 700,
 padding: '3px 10px', background: '#22c55e', color: '#fff', borderRadius: 99 }}>
 FROM YOUR RESUME
 </span>
 )}
 <span style={{ fontSize: 28, display: 'block', marginBottom: 14 }}>{r.icon}</span>
 <p style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 20, color: '#0f0f0f', marginBottom: 8 }}>{r.title}</p>
 <p style={{ fontSize: 13, color: '#9b9b9b', lineHeight: 1.5 }}>{r.desc}</p>
 <div style={{ marginTop: 16, fontSize: 13, fontWeight: 600, color: '#0f0f0f' }}>Choose this →</div>
 </button>
 ))}
 </div>
 </div>
 )}

 {/* ── STEP 2: Personal info ──────────────────────────────── */}
 {step === 2 && (
 <form className="anim-slide-up" onSubmit={e => { e.preventDefault(); if (validate2()) setStep(3) }}
 style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
 <button type="button" onClick={() => { setStep(1); setRole(null) }}
 style={{ background: 'none', border: 'none', cursor: 'pointer',
 fontSize: 13, color: '#9b9b9b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
 ← Change role
 </button>
 <p style={sectionLabel}>YOUR PROFILE</p>
 <h2 style={serif}>Tell us about yourself</h2>

 {/* Email: pre-filled from signup, read-only */}
 <Field label="Email">
 <div style={{
 ...inp(), display: 'flex', alignItems: 'center',
 background: '#f7f7f7', color: '#6b6b6b',
 }}>
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b5b5b5" strokeWidth="2"
 style={{ marginRight: 10, flexShrink: 0 }}>
 <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
 <polyline points="22,6 12,13 2,6"/>
 </svg>
 <span style={{ fontSize: 15 }}>{profile?.email || user?.email || ''}</span>
 </div>
 </Field>

 <div style={grid2}>
 <Field label="First name" error={errors.firstName}>
 <input style={inp(errors.firstName)} value={firstName}
 onChange={e => { setFirstName(e.target.value); setErrors(p => ({...p, firstName:''})) }}
 placeholder="Rahul" />
 </Field>
 <Field label="Last name" error={errors.lastName}>
 <input style={inp(errors.lastName)} value={lastName}
 onChange={e => { setLastName(e.target.value); setErrors(p => ({...p, lastName:''})) }}
 placeholder="Sharma" />
 </Field>
 </div>

 <Field label="Mobile number" error={errors.mobile}>
 <input style={inp(errors.mobile)} type="tel" value={mobile}
 onChange={e => { setMobile(e.target.value); setErrors(p => ({...p, mobile:''})) }}
 placeholder="+91 98765 43210" />
 </Field>

 <div style={grid2}>
 <Field label="LinkedIn profile" error={errors.linkedin}>
 <input style={inp(errors.linkedin)} value={linkedin}
 onChange={e => { setLinkedin(e.target.value); setErrors(p => ({ ...p, linkedin: '' })) }}
 placeholder="linkedin.com/in/yourname" />
 </Field>
 <Field label="GitHub profile" error={errors.github}>
 <input style={inp(errors.github)} value={github}
 onChange={e => { setGithub(e.target.value); setErrors(p => ({ ...p, github: '' })) }}
 placeholder="github.com/yourname" />
 </Field>
 </div>

 <div style={grid2}>
 <Field label="Country">
 <select value={country} onChange={e => setCountry(e.target.value)}
 style={{ ...inp(), appearance: 'none' as const }}>
 {COUNTRIES.map(c => <option key={c}>{c}</option>)}
 </select>
 </Field>
 <Field label="City / Address">
 <input style={inp()} value={address} onChange={e => setAddress(e.target.value)}
 placeholder="Hyderabad, Telangana" />
 </Field>
 </div>

 <Field label="Roles interested in" error={errors.roleInts}>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
 {ROLES.map(r => (
 <button key={r} type="button" onClick={() => { toggleRole(r); setErrors(p => ({...p, roleInts:''})) }}
 style={{
 padding: '7px 14px', borderRadius: 99, fontSize: 13, cursor: 'pointer',
 background: roleInts.includes(r) ? '#0f0f0f' : '#f5f5f5',
 color: roleInts.includes(r) ? '#fff' : '#4b4b4b',
 border: 'none', fontFamily: "'Inter',sans-serif", transition: 'all 0.15s',
 }}>
 {r}
 </button>
 ))}
 </div>
 {roleInts.includes('Other') && (
 <input style={{ ...inp(), marginTop: 10 }} value={otherRole}
 onChange={e => setOtherRole(e.target.value)}
 placeholder="Tell us which role, e.g. Solutions Architect" />
 )}
 {errors.roleInts && <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444' }}>{errors.roleInts}</p>}
 </Field>

 <button type="submit" style={btn}>Continue →</button>
 </form>
 )}

 {/* ── STEP 3: Academic / Professional ───────────────────── */}
 {step === 3 && (
 <form className="anim-slide-up" onSubmit={e => { e.preventDefault(); if (validate3()) setStep(4) }}
 style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
 <button type="button" onClick={() => setStep(2)}
 style={{ background: 'none', border: 'none', cursor: 'pointer',
 fontSize: 13, color: '#9b9b9b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
 ← Back
 </button>

 {role === 'student' ? (
 <>
 <p style={sectionLabel}>ACADEMIC DETAILS</p>
 <h2 style={serif}>Your education</h2>

 <Field label="College / University" error={errors.college}>
 <input style={inp(errors.college)} value={college}
 onChange={e => { setCollege(e.target.value); setErrors(p=>({...p,college:''})) }}
 placeholder="e.g. IIT Delhi, VIT Vellore" />
 </Field>

 <div style={grid2}>
 <Field label="Degree" error={errors.degree}>
 <select value={degree} onChange={e => {
 const d = e.target.value
 setDegree(d)
 setErrors(p=>({...p,degree:''}))
 // Recalculate passout year if year already selected
 if (currentYear) {
 const calc = calcPassoutYear(currentYear, d)
 if (calc) setPassoutYear(String(calc))
 }
 }}
 style={{ ...inp(errors.degree), appearance: 'none' as const }}>
 <option value="">Select degree</option>
 {DEGREES.map(d => <option key={d}>{d}</option>)}
 </select>
 </Field>
 <Field label="Branch / Specialisation">
 <select value={branch} onChange={e => setBranch(e.target.value)}
 style={{ ...inp(), appearance: 'none' as const }}>
 <option value="">Select branch</option>
 {BRANCHES.map(b => <option key={b}>{b}</option>)}
 </select>
 </Field>
 </div>

 <div style={grid2}>
 <Field label="Current year" error={errors.currentYear}>
 <select value={currentYear} onChange={e => {
 const y = e.target.value
 setCurrentYear(y)
 setErrors(p=>({...p,currentYear:''}))
 // Auto-calculate passout year
 const calc = calcPassoutYear(y, degree)
 if (calc) setPassoutYear(String(calc))
 else if (y === 'Graduated') setPassoutYear('') // let them enter manually
 }}
 style={{ ...inp(errors.currentYear), appearance: 'none' as const }}>
 <option value="">Select year</option>
 {YEARS.map(y => <option key={y}>{y}</option>)}
 </select>
 </Field>
 <Field label={currentYear === 'Graduated' ? 'Graduation year' : 'Expected graduation year'}>
 <div style={{ position: 'relative' }}>
 <input style={{
 ...inp(),
 background: currentYear && currentYear !== 'Graduated' ? '#f7f7f7' : '#fff',
 color: currentYear && currentYear !== 'Graduated' ? '#6b6b6b' : '#0f0f0f',
 }}
 type="number" value={passoutYear}
 onChange={e => setPassoutYear(e.target.value)}
 readOnly={!!(currentYear && currentYear !== 'Graduated')}
 placeholder="e.g. 2026" min="2020" max="2032" />
 {currentYear && currentYear !== 'Graduated' && passoutYear && (
 <span style={{ position: 'absolute', right: 12, top: '50%',
 transform: 'translateY(-50%)', fontSize: 11, color: '#22c55e',
 fontWeight: 600 }}>Auto</span>
 )}
 </div>
 {currentYear && currentYear !== 'Graduated' && passoutYear && (
 <p style={{ fontSize: 11, color: '#9b9b9b', marginTop: 4 }}>
 Calculated from your year of study
 </p>
 )}
 </Field>
 </div>

 <Field label="CGPA" error={errors.cgpa}>
 <div style={{ display: 'flex', gap: 10 }}>
 <input style={{ ...inp(errors.cgpa), flex: 1 }} type="number" step="0.01" min="0" max={cgpaScale}
 value={cgpa} onChange={e => { setCgpa(e.target.value); setErrors(p=>({...p,cgpa:''})) }}
 placeholder={cgpaScale === '10' ? 'e.g. 8.2' : 'e.g. 4.1'} />
 <select value={cgpaScale} onChange={e => setCgpaScale(e.target.value as '10' | '5')}
 style={{ ...inp(), width: 110, appearance: 'none' as const }}>
 <option value="10">Out of 10</option>
 <option value="5">Out of 5</option>
 </select>
 </div>
 </Field>

 <Field label="Any internship done?" error={errors.internDone}>
 <div style={{ display: 'flex', gap: 10 }}>
 {(['Yes','No'] as const).map(opt => (
 <button key={opt} type="button"
 onClick={() => { setInternDone(opt === 'Yes'); setErrors(p=>({...p,internDone:''})) }}
 style={{
 flex: 1, height: 44, borderRadius: 10, border: '1.5px solid',
 borderColor: internDone === (opt === 'Yes') ? '#0f0f0f' : '#e5e5e5',
 background: internDone === (opt === 'Yes') ? '#0f0f0f' : '#fff',
 color: internDone === (opt === 'Yes') ? '#fff' : '#6b6b6b',
 fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 500, cursor: 'pointer',
 }}>
 {opt}
 </button>
 ))}
 </div>
 {errors.internDone && <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444' }}>{errors.internDone}</p>}
 </Field>

 {internDone === true && (
 <Field label="Internship details">
 <textarea value={internDetail} onChange={e => setInternDetail(e.target.value)}
 rows={3} placeholder="Company, role, duration, key work done…"
 style={{ ...inp(), height: 'auto', padding: '12px 16px', resize: 'none', lineHeight: 1.6 }} />
 </Field>
 )}
 {internDone === false && (
 <div style={{ padding: '12px 14px', background: '#f5f5f5', borderRadius: 10, fontSize: 13, color: '#9b9b9b' }}>
 Will be marked as <strong>NA</strong> on your profile.
 </div>
 )}
 </>
 ) : (
 <>
 <p style={sectionLabel}>PROFESSIONAL DETAILS</p>
 <h2 style={serif}>Your work experience</h2>

 <Field label="Years of experience" error={errors.yearsExp}>
 <input style={inp(errors.yearsExp)} type="number" step="0.5" min="0"
 value={yearsExp} onChange={e => { setYearsExp(e.target.value); setErrors(p=>({...p,yearsExp:''})) }}
 placeholder="2.5" />
 </Field>

 <div style={grid2}>
 <Field label="Previous job title" error={errors.prevTitle}>
 <input style={inp(errors.prevTitle)} value={prevTitle}
 onChange={e => { setPrevTitle(e.target.value); setErrors(p=>({...p,prevTitle:''})) }}
 placeholder="Software Engineer" />
 </Field>
 <Field label="Previous company">
 <input style={inp()} value={prevCompany}
 onChange={e => setPrevCompany(e.target.value)} placeholder="Infosys" />
 </Field>
 </div>

 <Field label="Previous CTC (annual, ₹)">
 <input style={inp()} type="number" value={prevSalary}
 onChange={e => setPrevSalary(e.target.value)} placeholder="600000" />
 </Field>

 <Field label="Projects involved in previous work" error={errors.prevProjects}>
 <textarea value={prevProjects} onChange={e => { setPrevProjects(e.target.value); setErrors(p=>({...p,prevProjects:''})) }}
 rows={3} placeholder="Key projects, your role, impact…"
 style={{ ...inp(errors.prevProjects), height: 'auto', padding: '12px 16px', resize: 'none', lineHeight: 1.6 }} />
 </Field>

 <Field label="Why are you looking to change?" error={errors.reasonChange}>
 <textarea value={reasonChange} onChange={e => { setReasonChange(e.target.value); setErrors(p=>({...p,reasonChange:''})) }}
 rows={2} placeholder="Growth, compensation, relocation…"
 style={{ ...inp(errors.reasonChange), height: 'auto', padding: '12px 16px', resize: 'none', lineHeight: 1.6 }} />
 </Field>

 <Field label="Notice period">
 <select value={noticeStr} onChange={e => setNoticeStr(e.target.value)}
 style={{ ...inp(), appearance: 'none' as const }}>
 <option value="">Not applicable / Already serving</option>
 {NOTICE.map(n => <option key={n}>{n}</option>)}
 </select>
 </Field>

 {/* Only show college for < 2 years experience */}
 {!isExperienced && (
 <Field label="College name">
 <input style={inp()} value={college}
 onChange={e => setCollege(e.target.value)} placeholder="College name" />
 </Field>
 )}
 </>
 )}

 {/* Skills: common to both */}
 <Field label="Technical skills" error={errors.skills}>
 <input style={inp(errors.skills)} value={skills}
 onChange={e => { setSkills(e.target.value); setErrors(p=>({...p,skills:''})) }}
 placeholder="Java, React, Python, SQL, comma separated" />
 </Field>

 {role === 'student' && (
 <Field label="Projects" error={errors.projects}>
 <textarea value={projects} onChange={e => { setProjects(e.target.value); setErrors(p=>({...p,projects:''})) }} rows={3}
 placeholder="Briefly describe your top 2–3 projects…"
 style={{ ...inp(errors.projects), height: 'auto', padding: '12px 16px', resize: 'none', lineHeight: 1.6 }} />
 </Field>
 )}

 <Field label="Expected salary range (annual, ₹)" error={errors.expectedSalary}>
 <input style={inp(errors.expectedSalary)} value={expectedSalary}
 onChange={e => { setExpectedSalary(e.target.value); setErrors(p=>({...p,expectedSalary:''})) }}
 placeholder="e.g. 6,00,000 – 9,00,000" />
 </Field>

 <button type="submit" style={btn}>Continue →</button>
 </form>
 )}

 {/* ── STEP 4: Review + finish ────────────────────────────── */}
 {step === 4 && (
 <form className="anim-slide-up" onSubmit={handleFinish}
 style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
 <button type="button" onClick={() => setStep(3)}
 style={{ background: 'none', border: 'none', cursor: 'pointer',
 fontSize: 13, color: '#9b9b9b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
 ← Back
 </button>
 <p style={sectionLabel}>ALMOST DONE</p>
 <h2 style={serif}>You're all set</h2>

 <div style={{ background: '#f7f7f7', border: '1.5px solid #ececec', borderRadius: 14, padding: '18px 20px' }}>
 {resumePath ? (
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" style={{ flexShrink: 0 }}>
 <polyline points="20 6 9 17 4 12"/>
 </svg>
 <span style={{ fontSize: 14, color: '#0f0f0f' }}>
 <strong>{resumeName}</strong> — we'll tailor every application to it.
 </span>
 </div>
 ) : (
 <div>
 <p style={{ fontSize: 14, color: '#0f0f0f', marginBottom: 10 }}>
 No resume yet, no problem. You can add one anytime from your dashboard and we'll tailor applications to it from then on.
 </p>
 <button type="button" onClick={() => setStep(1)} style={{
 fontSize: 13, fontWeight: 600, color: '#0f0f0f', background: 'none',
 border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0,
 fontFamily: "'Inter',sans-serif",
 }}>
 Add resume now →
 </button>
 </div>
 )}
 </div>

 <button type="submit" disabled={loading || resumeUploading}
 style={{ ...btn, opacity: (loading || resumeUploading) ? 0.5 : 1,
 cursor: (loading || resumeUploading) ? 'not-allowed' : 'pointer' }}>
 {loading ? 'Setting up your account...' : "I'm ready, start applying "}
 </button>
 </form>
 )}
 </div>

 <style>{`
 .anim-slide-up { animation: slideUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
 @keyframes slideUp { from { opacity:0;transform:translateY(14px); } to { opacity:1;transform:none; } }
 input:focus,textarea:focus,select:focus {
 border-color: #0f0f0f !important;
 box-shadow: 0 0 0 3px rgba(15,15,15,0.08) !important;
 outline: none;
 }
 `}</style>
 </div>
 )
}
