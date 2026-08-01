import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLAN_DAYS: Record<string, number> = {
  basic: 30, pro: 30, maxpro: 30,
}

const ALLOWED_ORIGINS = new Set(['https://applymate.in'])
function corsFor(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://applymate.in',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Razorpay Checkout's success handler runs client-side and POSTs its
// result here — the browser has no way to sign this call, so the
// razorpay_order_id/payment_id/signature triple is re-validated purely
// via the HMAC signature, never trusted as-is.
serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Missing payment fields' }), { status: 400, headers: cors })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token!)
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    // Rate limit by user — this is called once per real checkout, so
    // repeated calls are either retries or abuse, not normal traffic.
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_identifier:    user.id,
      p_action:        'razorpay_verify',
      p_max_hits:      30,
      p_window_minutes: 10,
    })
    if (!allowed) return new Response(JSON.stringify({ error: 'Too many attempts. Please wait and try again.' }), { status: 429, headers: cors })

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const expectedSignature = await hmacSha256Hex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`)
    if (expectedSignature !== razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: cors })
    }

    const { data: sub } = await supabase.from('subscriptions')
      .select('*').eq('razorpay_order_id', razorpay_order_id).single()
    if (!sub) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: cors })
    if (sub.user_id !== user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: cors })

    if (sub.status === 'active') {
      // Already processed — don't let a replayed call extend it again.
      return new Response(JSON.stringify({ success: true, plan: sub.plan, ends_at: sub.ends_at }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const ends = new Date(now)
    ends.setDate(ends.getDate() + (PLAN_DAYS[sub.plan] || 30))

    await supabase.from('subscriptions').update({
      status: 'active',
      razorpay_payment_id,
      razorpay_signature,
      starts_at: now.toISOString(),
      ends_at: ends.toISOString(),
    }).eq('id', sub.id)

    await supabase.from('profiles').update({ account_status: 'active' }).eq('id', sub.user_id)

    return new Response(JSON.stringify({ success: true, plan: sub.plan, ends_at: ends.toISOString() }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors })
  }
})
