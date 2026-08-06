import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY_FEE_PCT = 0.02
const PLAN_DAYS = 30

const ALLOWED_ORIGINS = new Set(['https://applymate.in'])
function corsFor(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://applymate.in',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve(async (req) => {
  const corsHeaders = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { subscription_id, reason } = await req.json()
    if (!subscription_id || reason !== 'withdrawal') {
      return new Response(JSON.stringify({ error: 'Only withdrawal refunds are supported' }),
        { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Auth: caller must be the subscription owner
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token!)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // Rate limit: max 5 refund attempts per user per hour — this hits
    // Razorpay's API and does DB writes on every call, so it's a request-
    // flooding target even though it's auth-gated.
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_identifier:    user.id,
      p_action:        'refund_request',
      p_max_hits:      5,
      p_window_minutes: 60,
    })
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many refund attempts. Please wait and try again.' }),
        { status: 429, headers: corsHeaders })
    }

    const { data: sub, error: subErr } = await supabase.from('subscriptions')
      .select('*').eq('id', subscription_id).single()
    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), { status: 404, headers: corsHeaders })
    }
    if (sub.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }
    if (sub.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Only active subscriptions are eligible' }), { status: 400, headers: corsHeaders })
    }
    if (!sub.razorpay_payment_id || !sub.starts_at) {
      return new Response(JSON.stringify({ error: 'No completed payment on this subscription' }), { status: 400, headers: corsHeaders })
    }
    if (sub.plan === 'free' || !sub.amount_paise) {
      return new Response(JSON.stringify({ error: 'The free plan is not eligible for refunds' }), { status: 400, headers: corsHeaders })
    }

    // ── Days used, capped to plan length ──────────────────────────
    const startsAt = new Date(sub.starts_at)
    const now = new Date()
    const daysUsed = Math.min(PLAN_DAYS, Math.max(0, Math.ceil((now.getTime() - startsAt.getTime()) / 86400000)))
    const daysRemaining = PLAN_DAYS - daysUsed

    if (daysRemaining <= 0) {
      return new Response(JSON.stringify({ error: 'No remaining days left to refund' }), { status: 400, headers: corsHeaders })
    }

    // ── Landed a job at any point on this plan? We keep applying for a
    // better offer instead of refunding — refund access is blocked for
    // the rest of the plan once an offer is on record, per Policy 3B. ──
    const { data: gotOffer } = await supabase.from('job_applications')
      .select('id').eq('user_id', user.id)
      .in('status', ['offer', 'joined', 'hired'])
      .gte('applied_at', startsAt.toISOString())
      .limit(1).maybeSingle()

    if (gotOffer) {
      return new Response(JSON.stringify({
        error: 'You\'ve landed a job offer on this plan. We\'ll keep applying to find you an even better one — refunds aren\'t available once an offer is on record.',
      }), { status: 400, headers: corsHeaders })
    }

    const totalPaise = sub.amount_paise
    // Unused portion, refunded gross
    const grossPaise = Math.round((totalPaise * daysRemaining) / PLAN_DAYS)
    // Razorpay's 2% gateway fee on the total paid amount is never refunded
    const feePaise = Math.round(totalPaise * RAZORPAY_FEE_PCT)
    const netPaise = Math.max(0, grossPaise - feePaise)

    // ── Atomic claim ────────────────────────────────────────────────
    // Flip active → refund_processing only if it's still 'active' right
    // now. If two requests race, only one of these conditional updates
    // can succeed — the loser gets 0 rows back and is rejected here,
    // before either one calls Razorpay. Prevents a double-refund from
    // a double-click or a retried request.
    const { data: claimed } = await supabase.from('subscriptions')
      .update({ status: 'refund_processing' })
      .eq('id', sub.id).eq('status', 'active')
      .select('id')
    if (!claimed || claimed.length === 0) {
      return new Response(JSON.stringify({ error: 'A refund is already being processed for this subscription' }),
        { status: 409, headers: corsHeaders })
    }

    // ── Issue refund via Razorpay's Refunds API ─────────────────────
    const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!

    const razorpayRes = await fetch(`https://api.razorpay.com/v1/payments/${sub.razorpay_payment_id}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      },
      body: JSON.stringify({
        amount: netPaise,
        notes: { subscription_id: sub.id, reason },
      }),
    })
    const razorpayData = await razorpayRes.json()

    if (!razorpayRes.ok || !razorpayData.id) {
      await supabase.from('subscriptions').update({
        status: 'active', // release the claim so the user can retry
        refund_requested_at: now.toISOString(),
        refund_reason: reason,
        refund_days_used: daysUsed,
        refund_gross_paise: grossPaise,
        refund_fee_paise: feePaise,
        refund_net_paise: netPaise,
        refund_status: 'failed',
      }).eq('id', sub.id)
      return new Response(JSON.stringify({ error: 'Razorpay refund failed', detail: razorpayData }),
        { status: 502, headers: corsHeaders })
    }

    await supabase.from('subscriptions').update({
      status: 'refunded',
      refund_requested_at: now.toISOString(),
      refund_reason: reason,
      refund_days_used: daysUsed,
      refund_gross_paise: grossPaise,
      refund_fee_paise: feePaise,
      refund_net_paise: netPaise,
      razorpay_refund_id: razorpayData.id,
      refund_status: 'processed',
    }).eq('id', sub.id)

    return new Response(JSON.stringify({
      success: true,
      days_used: daysUsed,
      days_remaining: daysRemaining,
      refund_gross_rupees: grossPaise / 100,
      razorpay_fee_rupees: feePaise / 100,
      refund_net_rupees: netPaise / 100,
      razorpay_refund_id: razorpayData.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
