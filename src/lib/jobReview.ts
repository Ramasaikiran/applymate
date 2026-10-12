import type { Job } from './supabase'

export type Tone = 'green' | 'amber' | 'red' | 'grey'

/** Label and colour for a recruiter's job. Review state wins over publish state. */
export function jobBadge(j: Pick<Job, 'status' | 'review_status'>): { label: string; tone: Tone } {
  if (j.review_status === 'pending') return { label: 'Awaiting admin approval', tone: 'amber' }
  if (j.review_status === 'rejected') return { label: 'Rejected', tone: 'red' }
  if (j.status === 'published') return { label: 'Live', tone: 'green' }
  if (j.status === 'inactive') return { label: 'Paused', tone: 'grey' }
  return { label: 'Draft', tone: 'grey' }
}

export const TONE_STYLE: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: '#f0fdf4', fg: '#16a34a' },
  amber: { bg: '#fffbeb', fg: '#b45309' },
  red:   { bg: '#fef2f2', fg: '#dc2626' },
  grey:  { bg: '#f3f3f1', fg: '#4b4b4b' },
}
