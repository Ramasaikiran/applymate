import { describe, it, expect, vi, beforeEach } from 'vitest'
import { routePostAuth } from '../lib/routing'
import { supabase } from '../lib/supabase'

// FAILURE MODE 1: a transient network/RLS error on the post-login profile
// or subscription lookup used to be silently swallowed (only `data` was
// destructured, `error` was dropped) — an onboarded, paying user could get
// misrouted to /onboarding or /subscription just because a query blipped.
// It should now throw so the caller can show an error instead of
// silently misrouting a real user.
describe('routePostAuth', () => {
  const navigate = vi.fn()

  beforeEach(() => {
    navigate.mockReset()
  })

  function mockFrom(responses: Record<string, any>) {
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      const response = responses[table]
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        gt: () => builder,
        maybeSingle: () => Promise.resolve(response),
      }
      return builder
    })
  }

  it('throws instead of misrouting when the profile lookup errors', async () => {
    mockFrom({
      profiles: { data: null, error: { message: 'network error' } },
    })

    await expect(routePostAuth('user-1', navigate)).rejects.toThrow()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('throws instead of misrouting when the subscription lookup errors', async () => {
    mockFrom({
      profiles: { data: { is_admin: false, user_type: 'student' }, error: null },
      subscriptions: { data: null, error: { message: 'network error' } },
    })

    await expect(routePostAuth('user-1', navigate)).rejects.toThrow()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('still routes normally when both lookups succeed', async () => {
    mockFrom({
      profiles: { data: { is_admin: false, user_type: 'student' }, error: null },
      subscriptions: { data: { id: 'sub-1' }, error: null },
    })

    await routePostAuth('user-1', navigate)
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })
})

// Recruiters have no user_type. They must never be sent to candidate onboarding.
describe('routePostAuth: recruiters', () => {
  const navigate = vi.fn()
  beforeEach(() => navigate.mockReset())

  function mockFrom(responses: Record<string, any>) {
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      const response = responses[table]
      const builder: any = { select: () => builder, eq: () => builder, gt: () => builder, maybeSingle: () => Promise.resolve(response) }
      return builder
    })
  }

  it.each([
    ['approved', '/recruiter'],
    ['pending', '/recruiter/pending'],
    ['rejected', '/recruiter/pending'],
    ['suspended', '/recruiter/pending'],
  ])('routes a %s recruiter to %s', async (status, path) => {
    mockFrom({
      profiles: { data: { is_admin: false, user_type: null }, error: null },
      recruiters: { data: { status }, error: null },
    })
    await routePostAuth('user-1', navigate)
    expect(navigate).toHaveBeenCalledWith(path, { replace: true })
  })

  it('sends a verified recruiter with no application yet to /recruiter/apply', async () => {
    mockFrom({
      profiles: { data: { is_admin: false, user_type: null }, error: null },
      recruiters: { data: null, error: null },
    })
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { user: { user_metadata: { account_type: 'recruiter' } } } },
    } as any)
    await routePostAuth('user-1', navigate)
    expect(navigate).toHaveBeenCalledWith('/recruiter/apply', { replace: true })
  })

  it('still sends a plain new candidate to onboarding', async () => {
    mockFrom({
      profiles: { data: { is_admin: false, user_type: null }, error: null },
      recruiters: { data: null, error: null },
    })
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: { user: { user_metadata: {} } } } } as any)
    await routePostAuth('user-1', navigate)
    expect(navigate).toHaveBeenCalledWith('/onboarding', { replace: true })
  })

  it('throws instead of misrouting when the recruiter lookup errors', async () => {
    mockFrom({
      profiles: { data: { is_admin: false, user_type: null }, error: null },
      recruiters: { data: null, error: { message: 'network error' } },
    })
    await expect(routePostAuth('user-1', navigate)).rejects.toThrow()
    expect(navigate).not.toHaveBeenCalled()
  })
})
