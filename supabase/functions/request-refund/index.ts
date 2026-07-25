import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY_FEE_PCT = 0.02
const PLAN_DAYS = 30

const ALLOWED_ORIGINS = new Set(['https://www.applymate.in', 'https://applymate.in'])
function corsFor(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.applymate.in',
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

    // ── Days used, capped to plan length ──────────────────────────
    const startsAt = new Date(sub.starts_at)
    const now = new Date()
    const daysUsed = Math.min(PLAN_DAYS, Math.max(0, Math.ceil((now.getTime() - startsAt.getTime()) / 86400000)))
    const daysRemaining = PLAN_DAYS - daysUsed

    if (daysRemaining <= 0) {
      return new Response(JSON.stringify({ error: 'No remaining days left to refund' }), { status: 400, headers: corsHeaders })
    }

    // ── Got an offer within the first 15 days? We keep applying for a
    // better one instead of refunding. ────────────────────────────
    const fifteenDaysIn = new Date(startsAt.getTime() + 15 * 86400000)
    const { data: earlyOffer } = await supabase.from('job_applications')
      .select('id').eq('user_id', user.id)
      .in('status', ['offer', 'joined', 'hired'])
      .lte('applied_at', fifteenDaysIn.toISOString())
      .limit(1).maybeSingle()

    if (earlyOffer) {
      return new Response(JSON.stringify({
        error: 'You received a job offer within your first 15 days. We\'ll keep applying for 15 more days to find you a better offer — refunds aren\'t available in this case.',
      }), { status: 400, headers: corsHeaders })
    }

    const totalPaise = sub.amount_paise
    // Unused portion, refunded gross
    const grossPaise = Math.round((totalPaise * daysRemaining) / PLAN_DAYS)
    // Razorpay's 2% gateway fee on the total paid amount is never refunded
    const feePaise = Math.round(totalPaise * RAZORPAY_FEE_PCT)
    const netPaise = Math.max(0, grossPaise - feePaise)

    // ── Issue refund via Razorpay ──────────────────────────────────
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const auth = btoa(`${keyId}:${keySecret}`)

    const rpRes = await fetch(`https://api.razorpay.com/v1/payments/${sub.razorpay_payment_id}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: netPaise,
        speed: 'normal',
        notes: { reason, days_used: String(daysUsed), subscription_id },
      }),
    })
    const rpData = await rpRes.json()

    if (!rpRes.ok) {
      await supabase.from('subscriptions').update({
        refund_requested_at: now.toISOString(),
        refund_reason: reason,
        refund_days_used: daysUsed,
        refund_gross_paise: grossPaise,
        refund_fee_paise: feePaise,
        refund_net_paise: netPaise,
        refund_status: 'failed',
      }).eq('id', sub.id)
      return new Response(JSON.stringify({ error: 'Razorpay refund failed', detail: rpData }),
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
      razorpay_refund_id: rpData.id,
      refund_status: 'processed',
    }).eq('id', sub.id)

    return new Response(JSON.stringify({
      success: true,
      days_used: daysUsed,
      days_remaining: daysRemaining,
      refund_gross_rupees: grossPaise / 100,
      razorpay_fee_rupees: feePaise / 100,
      refund_net_rupees: netPaise / 100,
      razorpay_refund_id: rpData.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
