import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const base = {
  id: 'r1', company_name: 'Nestack', company_website: 'https://nestack.com', designation: 'HR',
  linkedin_url: 'https://linkedin.com/in/x', gstin: null, cin: null, work_email: 'hr@nestack.com',
  review_note: null, reviewed_at: null, created_at: '2026-10-11T10:00:00Z',
}
let current: any = { ...base, status: 'pending' }

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ recruiter: current, refreshProfile: vi.fn(), signOut: vi.fn() }),
}))
vi.mock('../components/NotificationBell', () => ({ default: () => null }))

import RecruiterPending from '../pages/recruiter/RecruiterPending'

const show = () => render(<MemoryRouter><RecruiterPending /></MemoryRouter>)

describe('<RecruiterPending />', () => {
  it('shows submitted + in review with a Check status button while pending', () => {
    current = { ...base, status: 'pending' }
    show()
    expect(screen.getByText('Application submitted')).toBeTruthy()
    expect(screen.getByText('In review')).toBeTruthy()
    expect(screen.getByRole('button', { name: /check status/i })).toBeTruthy()
  })

  it('shows the rejection reason and a resubmit link when rejected', () => {
    current = { ...base, status: 'rejected', review_note: 'Website does not match company name' }
    show()
    expect(screen.getByText('Application rejected')).toBeTruthy()
    expect(screen.getByText('Website does not match company name')).toBeTruthy()
    expect(screen.getByRole('link', { name: /edit and resubmit/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /check status/i })).toBeNull()
  })

  it('shows a fallback when a rejection has no reason', () => {
    current = { ...base, status: 'rejected', review_note: null }
    show()
    expect(screen.getByText(/no reason was added/i)).toBeTruthy()
  })
})
