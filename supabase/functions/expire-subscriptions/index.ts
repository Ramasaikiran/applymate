/**
 * expire-subscriptions
 * Runs daily (via Supabase cron or external cron) to:
 *  1. Mark subscriptions as expired when ends_at < now()
 *  2. Suspend the user's account
 *
 * Schedule in Supabase Dashboard → Edge Functions → Schedules
 * Cron: 0 0 * * *  (daily midnight IST)
 *
 * Or call manually: supabase functions invoke expire-subscriptions
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Require cron secret to prevent public triggering
  const secret = req.headers.get('x-cron-secret')
  if (secret !== Deno.env.get('CRON_SECRET')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Find all active subscriptions that have expired
  const { data: expired, error } = await supabase
    .from('subscriptions')
    .select('id, user_id')
    .eq('status', 'active')
    .lt('ends_at', new Date().toISOString())

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!expired || expired.length === 0) {
    return new Response(JSON.stringify({ message: 'No expired subscriptions found.', count: 0 }))
  }

  const expiredIds = expired.map(s => s.id)
  const userIds    = [...new Set(expired.map(s => s.user_id))]

  // 2. Mark subscriptions as expired
  await supabase.from('subscriptions')
    .update({ status: 'expired' })
    .in('id', expiredIds)

  // 3. Suspend user accounts (only if they have no OTHER active subscription)
  for (const userId of userIds) {
    const { data: otherActive } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString())
      .limit(1)
      .maybeSingle()

    if (!otherActive) {
      await supabase.from('profiles')
        .update({ account_status: 'suspended' })
        .eq('id', userId)
    }
  }

  return new Response(JSON.stringify({
    message: `Expired ${expired.length} subscription(s), suspended ${userIds.length} account(s).`,
    count: expired.length,
  }))
})
