import type { CSSProperties, ReactNode } from 'react'
import SkillsInput from './SkillsInput'
import type { UserType } from '../lib/supabase'

const FONT = "'Inter',-apple-system,sans-serif"

export interface CandidateDetails {
  skills: string[]
  // students
  college: string; degree: string; branch: string; cgpa: string; projects: string
  // professionals
  yearsExp: string; jobTitle: string; company: string; noticeDays: string
}

export const EMPTY_DETAILS: CandidateDetails = {
  skills: [], college: '', degree: '', branch: '', cgpa: '', projects: '',
  yearsExp: '', jobTitle: '', company: '', noticeDays: '',
}

/** Fields recruiters search and filter on. Returns an error message per field. */
export function validateDetails(role: UserType | null, d: CandidateDetails): Record<string, string> {
  const e: Record<string, string> = {}
  if (d.skills.length === 0) e.skills = 'Add at least one skill so recruiters can find you.'
  if (role === 'student') {
    if (!d.college.trim()) e.college = 'Enter your college.'
    if (!d.branch.trim()) e.branch = 'Enter your branch.'
    if (d.cgpa && (isNaN(Number(d.cgpa)) || Number(d.cgpa) < 0 || Number(d.cgpa) > 10)) e.cgpa = 'Enter a CGPA between 0 and 10.'
  }
  if (role === 'professional') {
    if (d.yearsExp === '' || isNaN(Number(d.yearsExp)) || Number(d.yearsExp) < 0 || Number(d.yearsExp) > 60) e.yearsExp = 'Enter your years of experience.'
    if (!d.jobTitle.trim()) e.jobTitle = 'Enter your current or last job title.'
  }
  return e
}

/** Columns to write to student_details / professional_details. */
export function detailsToRow(role: UserType | null, d: CandidateDetails) {
  if (role === 'student') {
    return {
      technical_skills: d.skills,
      college_name: d.college.trim() || null,
      degree: d.degree.trim() || null,
      branch: d.branch.trim() || null,
      cgpa: d.cgpa ? Number(d.cgpa) : null,
      projects: d.projects.trim() || null,
    }
  }
  const days = d.noticeDays === '' ? null : parseInt(d.noticeDays)
  return {
    technical_skills: d.skills,
    years_experience: d.yearsExp === '' ? null : Number(d.yearsExp),
    previous_job_title: d.jobTitle.trim() || null,
    previous_company: d.company.trim() || null,
    notice_period: days != null && days > 0,
    notice_period_days: days,
  }
}

const lbl: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#4b4b4b', marginBottom: 6, fontFamily: FONT }
const inp = (err?: string): CSSProperties => ({
  width: '100%', height: 48, padding: '0 14px', fontSize: 14, fontFamily: FONT, borderRadius: 10, boxSizing: 'border-box',
  border: `1.5px solid ${err ? '#ef4444' : '#e5e5e5'}`, outline: 'none', background: '#fff', color: '#0f0f0f',
})
function F({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {children}
      {error && <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444' }}>{error}</p>}
    </div>
  )
}

export default function CandidateDetailsFields({ role, value, onChange, errors }: {
  role: UserType | null; value: CandidateDetails; onChange: (v: CandidateDetails) => void; errors: Record<string, string>
}) {
  const set = (k: keyof CandidateDetails) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <F label="Skills (recruiters search by these)" error={errors.skills}>
        <SkillsInput value={value.skills} onChange={skills => onChange({ ...value, skills })} error={errors.skills ? ' ' : undefined} />
      </F>

      {role === 'student' && (<>
        <F label="College" error={errors.college}><input style={inp(errors.college)} value={value.college} onChange={set('college')} placeholder="e.g. ACE Engineering College" /></F>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F label="Degree"><input style={inp()} value={value.degree} onChange={set('degree')} placeholder="B.Tech" /></F>
          <F label="Branch" error={errors.branch}><input style={inp(errors.branch)} value={value.branch} onChange={set('branch')} placeholder="CSE" /></F>
        </div>
        <F label="CGPA (optional, out of 10)" error={errors.cgpa}><input style={inp(errors.cgpa)} type="number" step="0.01" min="0" max="10" value={value.cgpa} onChange={set('cgpa')} placeholder="8.45" /></F>
        <F label="Projects (optional)">
          <textarea rows={3} value={value.projects} onChange={set('projects')} placeholder="One or two lines about your best projects"
            style={{ ...inp(), height: 'auto', padding: 12, resize: 'vertical' }} />
        </F>
      </>)}

      {role === 'professional' && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F label="Years of experience" error={errors.yearsExp}><input style={inp(errors.yearsExp)} type="number" step="0.5" min="0" value={value.yearsExp} onChange={set('yearsExp')} placeholder="3" /></F>
          <F label="Notice period (days)"><input style={inp()} type="number" min="0" step="15" value={value.noticeDays} onChange={set('noticeDays')} placeholder="30" /></F>
        </div>
        <F label="Current or last job title" error={errors.jobTitle}><input style={inp(errors.jobTitle)} value={value.jobTitle} onChange={set('jobTitle')} placeholder="Software Engineer" /></F>
        <F label="Current or last company (optional)"><input style={inp()} value={value.company} onChange={set('company')} placeholder="Company name" /></F>
      </>)}
    </div>
  )
}
