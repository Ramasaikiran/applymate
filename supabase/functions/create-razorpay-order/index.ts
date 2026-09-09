import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLANS: Record<string, { amount: number; days: number }> = {
  basic:  { amount: 39900,  days: 30 },
  pro:    { amount: 199900, days: 30 },
  maxpro: { amount: 299900, days: 30 },
}

// 7-day trial pricing. Same three plans, far lower price, far shorter
// duration_days -- everything else (features unlocked, plan_visibility
// on jobs) is identical to the full plan since it's still the same
// `plan` value under the hood.
const TRIAL_PLANS: Record<string, { amount: number; days: number }> = {
  basic:  { amount: 9900,  days: 7 },
  pro:    { amount: 50000, days: 7 },
  maxpro: { amount: 99900, days: 7 },
}

// Coupon codes are validated here only — never trust a discount amount
// sent from the client, since that's editable in the browser before
// the request is sent.
const COUPONS: Record<string, { pct: number }> = {
}

const ALLOWED_ORIGINS = new Set(['https://applymate.in'])
function corsFor(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://applymate.in',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { plan, coupon, trial } = await req.json()
    if (!PLANS[plan]) return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400, headers: cors })
    const wantsTrial = trial === true

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Auth
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token!)
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    // Rate limit: max 20 order attempts per user per hour
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_identifier:    user.id,
      p_action:        'payment_order',
      p_max_hits:      20,
      p_window_minutes: 60,
    })
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many payment attempts. Please wait and try again.' }), {
        status: 429, headers: cors,
      })
    }

    const { data: profile } = await supabase.from('profiles')
      .select('full_name, email, mobile_number').eq('id', user.id).single()

    // One trial ever, across any plan — checked server-side against
    // subscriptions.is_trial, never trusted from the client's `trial`
    // flag alone.
    if (wantsTrial) {
      const { data: priorTrial } = await supabase.from('subscriptions')
        .select('id').eq('user_id', user.id).eq('is_trial', true).limit(1).maybeSingle()
      if (priorTrial) {
        return new Response(JSON.stringify({ error: "You've already used your trial period." }), { status: 400, headers: cors })
      }
    }

    const { amount: originalAmount, days: planDays } = wantsTrial ? TRIAL_PLANS[plan] : PLANS[plan]
    const normalizedCoupon = typeof coupon === 'string' ? coupon.trim().toLowerCase() : ''
    // Coupons don't stack with trial pricing — trial is already a
    // steep discount off the real plan price.
    const matchedCoupon = !wantsTrial && normalizedCoupon && COUPONS[normalizedCoupon] ? normalizedCoupon : null
    const amount = matchedCoupon
      ? Math.round(originalAmount * (1 - COUPONS[matchedCoupon].pct / 100))
      : originalAmount

    const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!

    // Razorpay order receipts must be <= 40 chars.
    const receipt = `opc_${user.id.slice(0, 8)}_${Date.now()}`

    // Orders API: https://api.razorpay.com/v1/orders
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      },
      body: JSON.stringify({
        amount,               // paise
        currency: 'INR',
        receipt,
        notes: { user_id: user.id, plan, coupon: matchedCoupon || '' },
      }),
    })
    const order = await orderRes.json()
    if (!orderRes.ok || !order.id) {
      throw new Error(order?.error?.description || 'Failed to create Razorpay order')
    }

    const { error: insertErr } = await supabase.from('subscriptions').insert({
      user_id: user.id, plan,
      amount_paise: amount, status: 'pending',
      razorpay_order_id: order.id,
      coupon_code: matchedCoupon,
      duration_days: planDays,
      is_trial: wantsTrial,
    })
    if (insertErr) throw new Error(`Failed to record order: ${insertErr.message}`)

    return new Response(JSON.stringify({
      key: keyId,
      order_id: order.id,
      amount,
      original_amount: originalAmount,
      coupon_applied: matchedCoupon,
      currency: 'INR',
      name: 'ApplyMate',
      description: `ApplyMate ${plan} plan${wantsTrial ? ' (7-day trial)' : ''}${matchedCoupon ? ` (${COUPONS[matchedCoupon].pct}% off)` : ''}`,
      prefill: {
        name: profile?.full_name || '',
        email: profile?.email || user.email || '',
        contact: profile?.mobile_number || '',
      },
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors })
  }
})
