import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

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

async function sha512(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
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
    const key  = Deno.env.get('PAYU_MERCHANT_KEY')!
    const salt = Deno.env.get('PAYU_MERCHANT_SALT')!
    const payuBase = Deno.env.get('PAYU_ENV') === 'production' ? 'https://secure.payu.in' : 'https://test.payu.in'

    const txnid = `opc_${user.id.slice(0, 8)}_${Date.now()}`
    const amountRupees = (amount / 100).toFixed(2)
    const productinfo = `ApplyMate ${plan} plan`
    const firstname = (profile?.full_name || 'ApplyMate User').slice(0, 60)
    const email = profile?.email || user.email || ''
    const phone = profile?.mobile_number || ''

    // PayU forward hash sequence:
    // key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
    const hashString = `${key}|${txnid}|${amountRupees}|${productinfo}|${firstname}|${email}|||||||||||${salt}`
    const hash = await sha512(hashString)

    const { error: insertErr } = await supabase.from('subscriptions').insert({
      user_id: user.id, plan,
      amount_paise: amount, status: 'pending',
      payu_txnid: txnid,
    })
    if (insertErr) throw new Error(`Failed to record order: ${insertErr.message}`)

    const functionsBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1`
    // PayU's callback POST is made by their server, not our frontend — it
    // can't carry an Authorization or apikey header, so the anon key has
    // to travel as a query param for the gateway to route the request.
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const callbackUrl = `${functionsBase}/verify-payu-payment?apikey=${encodeURIComponent(anonKey)}`

    return new Response(JSON.stringify({
      action: `${payuBase}/_payment`,
      key, txnid, amount: amountRupees, productinfo, firstname, email, phone, hash,
      surl: callbackUrl,
      furl: callbackUrl,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors })
  }
})
