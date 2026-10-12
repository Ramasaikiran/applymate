import { describe, it, expect } from 'vitest'
import { addSkills, normalizeSkill, MAX_SKILLS } from '../lib/skills'
import { validateDetails, detailsToRow, EMPTY_DETAILS } from '../components/CandidateDetailsFields'

describe('skills helpers', () => {
  it('uses canonical casing for known skills', () => {
    expect(normalizeSkill('  react ')).toBe('React')
    expect(normalizeSkill('node.js')).toBe('Node.js')
  })
  it('keeps unknown skills as typed', () => {
    expect(normalizeSkill('Rust   Embedded')).toBe('Rust Embedded')
  })
  it('splits commas and de-duplicates case-insensitively', () => {
    expect(addSkills(['Java'], 'java, python, PYTHON, sql')).toEqual(['Java', 'Python', 'SQL'])
  })
  it('caps the number of skills', () => {
    const many = Array.from({ length: 40 }, (_, i) => `Skill${i}`).join(',')
    expect(addSkills([], many)).toHaveLength(MAX_SKILLS)
  })
})

describe('candidate details validation', () => {
  it('requires skills for everyone', () => {
    expect(validateDetails('student', { ...EMPTY_DETAILS, college: 'X', branch: 'CSE' }).skills).toBeTruthy()
    expect(validateDetails('professional', { ...EMPTY_DETAILS, yearsExp: '2', jobTitle: 'SDE' }).skills).toBeTruthy()
  })
  it('requires college and branch for students', () => {
    const e = validateDetails('student', { ...EMPTY_DETAILS, skills: ['Java'] })
    expect(e.college && e.branch).toBeTruthy()
  })
  it('requires experience and job title for professionals', () => {
    const e = validateDetails('professional', { ...EMPTY_DETAILS, skills: ['Java'] })
    expect(e.yearsExp && e.jobTitle).toBeTruthy()
  })
  it('accepts a complete student and rejects an out-of-range CGPA', () => {
    const ok = { ...EMPTY_DETAILS, skills: ['Java'], college: 'ACE', branch: 'CSE', cgpa: '8.45' }
    expect(validateDetails('student', ok)).toEqual({})
    expect(validateDetails('student', { ...ok, cgpa: '11' }).cgpa).toBeTruthy()
  })
  it('maps to database columns', () => {
    const row = detailsToRow('professional', { ...EMPTY_DETAILS, skills: ['Java'], yearsExp: '3', jobTitle: 'SDE', noticeDays: '30' })
    expect(row).toMatchObject({ technical_skills: ['Java'], years_experience: 3, previous_job_title: 'SDE', notice_period: true, notice_period_days: 30 })
  })
})
