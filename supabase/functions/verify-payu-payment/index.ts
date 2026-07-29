import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const PLAN_DAYS: Record<string, number> = {
  basic: 30, pro: 30, maxpro: 30,
}

const FRONTEND_URL = 'https://applymate.in'

async function sha512(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function redirect(status: 'success' | 'failure', extra: Record<string, string> = {}) {
  const url = new URL(`${FRONTEND_URL}/subscription`)
  url.searchParams.set('payu_status', status)
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v)
  return new Response(null, { status: 302, headers: { Location: url.toString() } })
}

// PayU posts this endpoint as application/x-www-form-urlencoded from the
// hosted checkout page (surl on success, furl on failure) — there is no
// Authorization header here, so the transaction is identified by txnid
// and re-validated purely via the reverse hash, never trusted as-is.
serve(async (req) => {
  try {
    let fields: Record<string, string> = {}
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      fields = await req.json()
    } else {
      const form = await req.formData()
      for (const [k, v] of form.entries()) fields[k] = String(v)
    }

    const { txnid, amount, productinfo, firstname, email, status, hash: receivedHash, mihpayid } = fields
    if (!txnid) return redirect('failure', { reason: 'missing_txnid' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // This endpoint is public (PayU's hosted page redirects the buyer's
    // own browser here — no way to require auth). Rate limit by IP so it
    // can't be flooded; the real callback is a one-time POST per
    // transaction from a real customer, not repeated traffic.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('cf-connecting-ip')
      ?? 'unknown'
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_identifier:    ip,
      p_action:        'payu_callback',
      p_max_hits:      30,
      p_window_minutes: 10,
    })
    if (!allowed) return redirect('failure', { reason: 'rate_limited' })

    const key  = Deno.env.get('PAYU_MERCHANT_KEY')!
    const salt = Deno.env.get('PAYU_MERCHANT_SALT')!

    // PayU reverse hash sequence:
    // salt|status|||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
    const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`
    const expectedHash = await sha512(hashString)

    if (expectedHash !== receivedHash) {
      return redirect('failure', { reason: 'invalid_hash' })
    }

    const { data: sub } = await supabase.from('subscriptions')
      .select('*').eq('payu_txnid', txnid).single()
    if (!sub) return redirect('failure', { reason: 'order_not_found' })

    if (sub.status === 'active') {
      // Already processed — don't let a replayed callback extend it again.
      return redirect('success', { plan: sub.plan, ends_at: sub.ends_at })
    }

    if (status !== 'success') {
      await supabase.from('subscriptions').update({ status: 'failed', payu_mihpayid: mihpayid || null })
        .eq('id', sub.id)
      return redirect('failure', { reason: 'payment_not_successful' })
    }

    const now = new Date()
    const ends = new Date(now)
    ends.setDate(ends.getDate() + (PLAN_DAYS[sub.plan] || 30))

    await supabase.from('subscriptions').update({
      status: 'active',
      payu_mihpayid: mihpayid,
      payu_hash: receivedHash,
      starts_at: now.toISOString(),
      ends_at: ends.toISOString(),
    }).eq('id', sub.id)

    await supabase.from('profiles').update({ account_status: 'active' }).eq('id', sub.user_id)

    return redirect('success', { plan: sub.plan, ends_at: ends.toISOString() })
  } catch (err) {
    return redirect('failure', { reason: 'server_error' })
  }
})
