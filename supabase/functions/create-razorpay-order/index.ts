import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLANS: Record<string, { amount: number; days: number }> = {
  basic:  { amount: 39900,  days: 30 },
  pro:    { amount: 199900, days: 30 },
  maxpro: { amount: 359900, days: 30 },
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
    const { plan } = await req.json()
    if (!PLANS[plan]) return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400, headers: cors })

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

    const { amount } = PLANS[plan]
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
        notes: { user_id: user.id, plan },
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
    })
    if (insertErr) throw new Error(`Failed to record order: ${insertErr.message}`)

    return new Response(JSON.stringify({
      key: keyId,
      order_id: order.id,
      amount,
      currency: 'INR',
      name: 'ApplyMate',
      description: `ApplyMate ${plan} plan`,
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
