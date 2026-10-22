import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLAN_DAYS: Record<string, number> = {
  basic: 30, pro: 30, maxpro: 30,
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Razorpay calls this server-to-server after a payment, independent of
// whether the customer's browser is still open. This is the source of
// truth for activating a subscription — verify-razorpay-payment is only
// a fast-path for the success screen, not what the dashboard should
// ultimately rely on.
//
// Configure in Razorpay Dashboard > Webhooks:
//   URL: <SUPABASE_URL>/functions/v1/razorpay-webhook
//   Events: payment.captured, payment.failed
//   Secret: set the same value as RAZORPAY_WEBHOOK_SECRET below
serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    // Must read the raw body — signature is computed over the exact
    // bytes Razorpay sent, not a re-serialized JSON.parse() of it.
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature')
    if (!signature) return new Response('Missing signature', { status: 400 })

    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    if (!webhookSecret) {
      // Misconfiguration: fail loudly (Razorpay will retry) instead of
      // verifying against an empty key.
      console.error('RAZORPAY_WEBHOOK_SECRET is not set')
      return new Response('Webhook not configured', { status: 500 })
    }
    const expected = await hmacSha256Hex(webhookSecret, rawBody)
    if (!timingSafeEqual(expected, signature)) {
      return new Response('Invalid signature', { status: 400 })
    }

    const event = JSON.parse(rawBody)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Log every verified event before acting on it — gives us an audit
    // trail independent of subscription state, useful when a payment
    // comes in for an order_id we don't recognize yet or arrives out
    // of order relative to the client-side verify call.
    await supabase.from('razorpay_webhook_events').insert({
      event_type: event.event,
      payload: event,
    })

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity
      const orderId = payment?.order_id
      if (!orderId) return new Response('ok', { status: 200 })

      const { data: sub } = await supabase.from('subscriptions')
        .select('*').eq('razorpay_order_id', orderId).maybeSingle()

      // Razorpay redelivers events (retries, manual replays). Only an order that
      // is still unpaid may be activated: re-running a captured event must not
      // revive an expired, cancelled or refunded subscription.
      if (sub && (sub.status === 'pending' || sub.status === 'failed')) {
        const now = new Date()
        const ends = new Date(now)
        ends.setDate(ends.getDate() + (sub.duration_days || PLAN_DAYS[sub.plan] || 30))

        const { error: subErr } = await supabase.from('subscriptions').update({
          status: 'active',
          razorpay_payment_id: payment.id,
          starts_at: now.toISOString(),
          ends_at: ends.toISOString(),
        }).eq('id', sub.id).in('status', ['pending', 'failed'])
        // Non-2xx makes Razorpay retry. Swallowing this left a paid customer
        // unactivated whenever the browser-side verify call never happened.
        if (subErr) {
          console.error('webhook: failed to activate subscription', subErr.message)
          return new Response(JSON.stringify({ error: subErr.message }), { status: 500 })
        }

        const { error: profErr } = await supabase.from('profiles').update({ account_status: 'active' }).eq('id', sub.user_id)
        if (profErr) console.error('webhook: failed to update profile status', profErr.message)
      }
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload?.payment?.entity
      const orderId = payment?.order_id
      if (orderId) {
        await supabase.from('subscriptions').update({
          status: 'failed',
        }).eq('razorpay_order_id', orderId).neq('status', 'active')
      }
    }

    // Always 200 on a processed (even if no-op) event — Razorpay retries
    // on non-2xx, and retrying a captured payment we already handled is
    // just wasted calls since the update above is already idempotent.
    return new Response('ok', { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
})
