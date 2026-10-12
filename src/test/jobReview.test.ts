import { describe, it, expect } from 'vitest'
import { jobBadge } from '../lib/jobReview'

describe('jobBadge', () => {
  it('shows awaiting approval while pending, even if it was meant to be live', () => {
    expect(jobBadge({ status: 'draft', review_status: 'pending' })).toEqual({ label: 'Awaiting admin approval', tone: 'amber' })
  })
  it('shows rejected', () => {
    expect(jobBadge({ status: 'draft', review_status: 'rejected' }).label).toBe('Rejected')
  })
  it('shows live only when approved and published', () => {
    expect(jobBadge({ status: 'published', review_status: 'approved' }).label).toBe('Live')
    expect(jobBadge({ status: 'inactive', review_status: 'approved' }).label).toBe('Paused')
    expect(jobBadge({ status: 'draft', review_status: 'approved' }).label).toBe('Draft')
  })
  it('falls back to publish state when review info is missing', () => {
    expect(jobBadge({ status: 'published' }).label).toBe('Live')
  })
})
