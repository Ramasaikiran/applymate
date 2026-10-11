import { supabase } from './supabase'
import type { NavigateFunction } from 'react-router-dom'
import type { RecruiterStatus } from './supabase'

// Where a recruiter belongs, given their application status (null = not applied yet).
export function recruiterHome(status: RecruiterStatus | null): string {
  if (!status) return '/recruiter/apply'
  return status === 'approved' ? '/recruiter' : '/recruiter/pending'
}

// Where should a signed-in user land? Checked in this order:
// admin → recruiter → needs onboarding → needs to pay → dashboard.
// Used right after any sign-in/auth-callback event. Landing.tsx has its own
// reactive version of this (driven by AuthContext state rather than a fresh
// one-shot query) — if you change the ordering here, check that one too.
//
// Throws on any failed lookup rather than treating a fetch error as "no
// profile" / "no subscription" — silently misrouting a paid, onboarded user
// back to onboarding (or a free user into a paywall loop) because of a
// transient network blip is worse than showing an error and letting them
// retry. Callers are expected to catch and show a friendly message.
export async function routePostAuth(userId: string, navigate: NavigateFunction) {
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('is_admin, user_type')
    .eq('id', userId)
    .maybeSingle()
  if (profileErr) throw new Error('Could not load your profile. Please try again.')

  if (profile?.is_admin) { navigate('/admin', { replace: true }); return }

  // Recruiters have no user_type. Check them before sending anyone to onboarding.
  if (!profile?.user_type) {
    const { data: rec, error: recErr } = await supabase
      .from('recruiters').select('status').eq('id', userId).maybeSingle()
    if (recErr) throw new Error('Could not load your account. Please try again.')
    const { data: { session } } = await supabase.auth.getSession()
    const signedUpAsRecruiter = session?.user?.user_metadata?.account_type === 'recruiter'
    if (rec || signedUpAsRecruiter) {
      navigate(recruiterHome((rec?.status as RecruiterStatus | undefined) ?? null), { replace: true })
      return
    }
    navigate('/onboarding', { replace: true })
    return
  }

  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('ends_at', new Date().toISOString())
    .maybeSingle()
  if (subErr) throw new Error('Could not load your subscription. Please try again.')

  if (!sub) { navigate('/subscription', { replace: true }); return }

  navigate('/dashboard', { replace: true })
}
