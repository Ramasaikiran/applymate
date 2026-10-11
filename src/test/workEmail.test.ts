import { describe, it, expect } from 'vitest'
import { isWorkEmail, workEmailError } from '../lib/workEmail'

describe('isWorkEmail', () => {
  it.each(['a@gmail.com', 'a@GMAIL.com', 'a@yahoo.in', 'a@outlook.com', 'a@mailinator.com'])('blocks %s', e => {
    expect(isWorkEmail(e)).toBe(false)
  })
  it.each(['hr@acme.com', 'jane.doe@startup.io', 'x@mail.acme.co.in'])('allows %s', e => {
    expect(isWorkEmail(e)).toBe(true)
  })
  it('rejects malformed addresses', () => {
    expect(isWorkEmail('not-an-email')).toBe(false)
    expect(workEmailError('not-an-email')).toMatch(/valid email/i)
  })
  it('explains free providers', () => {
    expect(workEmailError('a@gmail.com')).toMatch(/company email/i)
    expect(workEmailError('hr@acme.com')).toBeNull()
  })
})
