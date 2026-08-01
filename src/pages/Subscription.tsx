import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, type SubscriptionPlan } from '../lib/supabase'

// Razorpay Checkout is a JS modal, not a redirect: we load their script
// once, open the modal with the order the edge function created, and
// handle success/failure right here via callbacks — no round trip
// through query params like a redirect-based flow would need.
declare global {
  interface Window { Razorpay: any }
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Razorpay checkout.'))
    document.body.appendChild(script)
  })
}

async function openRazorpayCheckout(order: {
  key: string; order_id: string; amount: number; currency: string
  name: string; description: string
  prefill: { name: string; email: string; contact: string }
}, onSuccess: (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void,
   onDismiss: () => void) {
  await loadRazorpayScript()
  const rzp = new window.Razorpay({
    key: order.key,
    order_id: order.order_id,
    amount: order.amount,
    currency: order.currency,
    name: order.name,
    description: order.description,
    prefill: order.prefill,
    theme: { color: '#0f0f0f' },
    handler: (resp: any) => onSuccess({
      razorpay_order_id: resp.razorpay_order_id,
      razorpay_payment_id: resp.razorpay_payment_id,
      razorpay_signature: resp.razorpay_signature,
    }),
    modal: { ondismiss: onDismiss },
  })
  rzp.open()
}

/* ── Plan definitions ──────────────────────────────────────────── */
const PLANS: {
  id: SubscriptionPlan
  label: string
  price: number
  duration: string
  tagline: string
  whoApplies: string
  saving: string | null
  color: string
  features: string[]
}[] = [
  {
    id: 'free', label: 'Free', price: 0, duration: 'Always free',
    tagline: 'Get discovered. Apply yourself.', whoApplies: 'You apply yourself',
    saving: null, color: '#6b7280',
    features: ['Daily job feed matched to your skills', 'Save & track jobs yourself', 'Up to 30 applications / month'],
  },
  {
    id: 'basic', label: 'Basic', price: 399, duration: '30 days',
    tagline: 'You apply. We surface the jobs.', whoApplies: 'You apply yourself',
    saving: null, color: '#0f0f0f',
    features: ['Daily job feed matched to your skills', 'Save & track jobs yourself'],
  },
  {
    id: 'pro', label: 'Pro', price: 1999, duration: '30 days',
    tagline: 'We apply for you.', whoApplies: 'Admin applies for you',
    saving: null, color: '#1d4ed8',
    features: ['Everything in Basic', 'Admin applies on your behalf', 'Application tracker with live status', 'Priority job matching'],
  },
  {
    id: 'maxpro', label: 'Max Pro', price: 3599, duration: '30 days',
    tagline: 'We apply + get you interview-ready.', whoApplies: 'Admin applies + preps you',
    saving: null, color: '#7c3aed',
    features: ['Everything in Pro', 'Interview scheduling support', 'Career strategy call'],
  },
]

function fmt(date: string) {
 return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Subscription() {
 const { user, profile, subscription, refreshProfile, signOut } = useAuth()
 const navigate = useNavigate()
 const [params] = useSearchParams()
 const isExpired = params.get('reason') === 'expired'

 const [selected, setSelected] = useState<SubscriptionPlan>('basic')
 const [loading, setLoading] = useState(false)
 const [error, setError] = useState<string | null>(null)
 const [success, setSuccess] = useState<{ plan: typeof PLANS[0]; endsAt: string; amountPaid: number } | null>(null)
 const [couponInput, setCouponInput] = useState('')
 const [couponApplied, setCouponApplied] = useState<string | null>(null)
 const [couponError, setCouponError] = useState<string | null>(null)

 // Preview only — the real discount is validated and applied
 // server-side in create-razorpay-order, this just shows the user
 // what to expect before they pay.
 const COUPON_DISCOUNT_PCT = 10
 function applyCoupon() {
 const code = couponInput.trim().toLowerCase()
 if (code === 'applymate10') {
 setCouponApplied(code)
 setCouponError(null)
 } else {
 setCouponApplied(null)
 setCouponError('Invalid coupon code.')
 }
 }

 async function handlePay() {
 if (!user) return
 if (selected === 'free') { navigate('/dashboard'); return }
 setError(null); setLoading(true)
 try {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) throw new Error('Session expired. Please sign in again.')

 let res: Response
 try {
 res = await fetch(
 `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-razorpay-order`,
 {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${session.access_token}`,
 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
 },
 body: JSON.stringify({ plan: selected, coupon: couponApplied || undefined }),
 }
 )
 } catch {
 throw new Error('Payment server unreachable. Edge function not deployed or Razorpay keys missing.')
 }
 const order = await res.json()
 if (!res.ok) throw new Error(order.error || 'Could not create order.')

 // Opens Razorpay's checkout modal. On success we verify the payment
 // server-side, then show the success screen directly — no redirect
 // round trip needed.
 await openRazorpayCheckout(order, async (payment) => {
 try {
 // Re-fetch the session here rather than reusing the one from
 // checkout-open time — the user may have left the modal open
 // long enough for that token to expire.
 const { data: { session: verifySession } } = await supabase.auth.getSession()
 if (!verifySession) throw new Error('Session expired. Please sign in again and retry — your payment was not lost, contact support with your payment ID if unsure.')
 const verifyRes = await fetch(
 `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-razorpay-payment`,
 {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${verifySession.access_token}`,
 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
 },
 body: JSON.stringify(payment),
 }
 )
 const result = await verifyRes.json()
 if (!verifyRes.ok || !result.success) throw new Error(result.error || 'Payment verification failed.')

 const plan = PLANS.find(p => p.id === result.plan)
 if (plan) {
 refreshProfile()
 setSuccess({ plan, endsAt: result.ends_at, amountPaid: (result.amount_paise ?? plan.price * 100) / 100 })
 }
 } catch (err) {
 setError((err as Error).message)
 } finally {
 setLoading(false)
 }
 }, () => {
 // User closed the checkout modal without paying.
 setLoading(false)
 })
 } catch (err) {
 setError((err as Error).message)
 setLoading(false)
 }
 }

 /* ── Success ─────────────────────────────────────────────────── */
 if (success) {
 const { plan, endsAt, amountPaid } = success
 return (
 <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontFamily: "'Inter',sans-serif", background: '#fff', padding: '0 24px' }}>
 <div style={{ textAlign: 'center', maxWidth: 440 }}>
 <div style={{ fontSize: 64, marginBottom: 16 }}></div>
 <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 32, fontWeight: 400,
 color: '#0f0f0f', marginBottom: 8 }}>Payment successful!</h1>
 <p style={{ fontSize: 15, color: '#9b9b9b', marginBottom: 28 }}>
 Your <strong>{plan.label}</strong> plan is now active.
 </p>

 {/* Receipt card */}
 <div style={{ background: '#f7f7f7', borderRadius: 16, padding: '24px', marginBottom: 28, textAlign: 'left' }}>
 {[
 { label: 'Plan', value: plan.label },
 { label: 'Amount paid', value: `₹${amountPaid.toLocaleString('en-IN')}` },
 { label: 'Duration', value: plan.duration },
 ].map(({ label, value }) => (
 <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
 paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid #ebebeb' }}>
 <span style={{ fontSize: 14, color: '#9b9b9b' }}>{label}</span>
 <span style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>{value}</span>
 </div>
 ))}
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <span style={{ fontSize: 14, color: '#9b9b9b' }}>Next payment due</span>
 <span style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>{fmt(endsAt)}</span>
 </div>
 </div>

 <p style={{ fontSize: 13, color: '#b5b5b5', marginBottom: 24 }}>
 Your account will be paused on <strong>{fmt(endsAt)}</strong> if not renewed.
 </p>

 <button onClick={() => navigate('/dashboard')} style={{
 width: '100%', height: 52, background: '#0f0f0f', color: '#fff',
 border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>Go to dashboard →</button>
 </div>
 </div>
 )
 }

 /* ── Main ────────────────────────────────────────────────────── */
 const selectedPlan = PLANS.find(p => p.id === selected)!

 return (
 <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>

 {/* Navbar */}
 <div style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 28px',
 background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 50 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f7f7f5',
 border: '1px solid #ececec', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <img src="/logo-mark.png" alt="ApplyMate" style={{ width: 24, height: 24, objectFit: 'contain' }} />
 </div>
 <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>ApplyMate</span>
 </div>
 {/* Step indicator */}
 <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
 <button onClick={() => navigate('/onboarding?edit=resume')} style={{ background: 'none', border: 'none',
 fontSize: 13, color: '#666', cursor: 'pointer', fontWeight: 500,
 display: 'flex', alignItems: 'center', gap: 4 }}>
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
 Back
 </button>
 <button onClick={() => signOut()} style={{ background: 'none', border: 'none',
 fontSize: 13, color: '#666', cursor: 'pointer', fontWeight: 500 }}>
 Logout
 </button>
 {['Details','Payment'].map((s, i) => (
 <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
 {i > 0 && <div style={{ width: 24, height: 1, background: '#e5e5e5' }} />}
 <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
 <div style={{ width: 22, height: 22, borderRadius: '50%',
 background: i === 0 ? '#22c55e' : '#0f0f0f',
 display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 {i === 0
 ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
 : <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>2</span>
 }
 </div>
 <span style={{ fontSize: 13, fontWeight: i === 1 ? 600 : 400,
 color: i === 1 ? '#0f0f0f' : '#9b9b9b' }}>{s}</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 24px 80px' }}>

 {/* Expired banner */}
 {isExpired && (
 <div style={{ marginBottom: 32, padding: '18px 22px', background: '#fff1f2',
 border: '1.5px solid #fecaca', borderRadius: 14 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
 <span style={{ fontSize: 18 }}></span>
 <h2 style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>Account paused</h2>
 </div>
 <p style={{ fontSize: 14, color: '#b45309' }}>
 Your subscription expired. Renew below to reactivate instantly.
 </p>
 </div>
 )}

 {/* Header */}
 <p style={{ fontSize: 11, fontWeight: 600, color: '#b5b5b5', letterSpacing: '0.1em',
 textTransform: 'uppercase', marginBottom: 8 }}>
 {isExpired ? 'RENEW SUBSCRIPTION' : 'STEP 2 OF 2: PAYMENT'}
 </p>
 <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 36, fontWeight: 400,
 color: '#0f0f0f', letterSpacing: '-0.02em', marginBottom: 8, lineHeight: 1.2 }}>
 Choose your plan
 </h1>
 <p style={{ fontSize: 15, color: '#9b9b9b', marginBottom: 36 }}>
 All plans run 30 days. The difference is who does the applying.
 </p>

 <div style={{ marginBottom: 20 }}>
 <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 22,
 color: '#0f0f0f', lineHeight: 1.3, marginBottom: 6 }}>
 Pick your service level.
 </h2>
 <p style={{ fontSize: 14, color: '#6b6b6b', lineHeight: 1.5 }}>
 Basic: you apply, we surface the jobs. Pro: we apply for you.
 Max Pro: we apply and get you interview-ready.
 </p>
 </div>

 <div className="sub-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
 {PLANS.map(plan => {
 const isSelected = selected === plan.id
 return (
 <button key={plan.id} type="button" className="sub-pricing-card" onClick={() => { setSelected(plan.id); setCouponError(null) }} style={{
 background: isSelected ? plan.color : '#fff',
 border: `2px solid ${isSelected ? plan.color : '#e8e8e8'}`,
 borderRadius: 16, padding: '22px 20px', textAlign: 'left',
 cursor: 'pointer', transition: 'all 0.18s', position: 'relative',
 boxShadow: isSelected ? `0 8px 24px ${plan.color}22` : '0 1px 4px rgba(0,0,0,0.04)',
 }}>
 {plan.saving && (
 <span style={{
 position: 'absolute', top: 14, right: 14,
 fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
 background: isSelected ? 'rgba(255,255,255,0.2)' : '#fef9c3',
 color: isSelected ? '#fff' : '#92400e',
 }}>{plan.saving}</span>
 )}

 {/* Who applies */}
 <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
 color: isSelected ? 'rgba(255,255,255,0.6)' : '#b5b5b5',
 textTransform: 'uppercase', marginBottom: 6 }}>
 {plan.whoApplies}
 </p>

 {/* Plan name */}
 <p style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 24,
 color: isSelected ? '#fff' : '#0f0f0f', marginBottom: 4, lineHeight: 1 }}>
 {plan.label}
 </p>

 {/* Price */}
 <p style={{ fontSize: 28, fontWeight: 800,
 color: isSelected ? '#fff' : '#0f0f0f', marginBottom: 2, lineHeight: 1 }}>
 ₹{plan.price.toLocaleString('en-IN')}
 </p>
 <p style={{ fontSize: 12, color: isSelected ? 'rgba(255,255,255,0.55)' : '#9b9b9b', marginBottom: 18 }}>
 {plan.tagline}
 </p>

 {/* Features */}
 <ul style={{ listStyle: 'none', padding: 0, margin: 0,
 display: 'flex', flexDirection: 'column', gap: 7 }}>
 {plan.features.map(f => (
 <li key={f} style={{ fontSize: 12.5,
 color: isSelected ? 'rgba(255,255,255,0.85)' : '#6b6b6b',
 display: 'flex', alignItems: 'flex-start', gap: 7, lineHeight: 1.4 }}>
 <span style={{ color: isSelected ? '#86efac' : '#22c55e', flexShrink: 0 }}></span>
 {f}
 </li>
 ))}
 </ul>

 {/* Job-application email note. Pro and Max Pro only */}
 {(plan.id === 'pro' || plan.id === 'maxpro') && (
 <p style={{ fontSize: 11, lineHeight: 1.5, marginTop: 12,
 color: isSelected ? 'rgba(255,255,255,0.6)' : '#9b9b9b' }}>
 A new email + password is required. Some companies ask for
 OTP verification during applications. Create it fresh, don't
 reuse your personal email, and keep it professional.
 </p>
 )}

 {/* Selected indicator */}
 {isSelected && (
 <div style={{ position: 'absolute', top: 14, left: 20,
 width: 20, height: 20, borderRadius: '50%',
 background: 'rgba(255,255,255,0.25)',
 display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
 <polyline points="20 6 9 17 4 12"/>
 </svg>
 </div>
 )}
 </button>
 )
 })}
 </div>

 {/* Summary bar */}
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 padding: '14px 18px', background: '#fff', border: '1.5px solid #e8e8e8',
 borderRadius: 12, marginBottom: 16 }}>
 <div>
 <p style={{ fontSize: 13, color: '#9b9b9b', marginBottom: 2 }}>Selected</p>
 <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f0f' }}>
 {selectedPlan.label}: {couponApplied && selectedPlan.id !== 'free' ? (
 <>
 <span style={{ textDecoration: 'line-through', color: '#b5b5b5', marginRight: 6 }}>
 ₹{selectedPlan.price.toLocaleString('en-IN')}
 </span>
 ₹{Math.round(selectedPlan.price * (1 - COUPON_DISCOUNT_PCT / 100)).toLocaleString('en-IN')}
 </>
 ) : (
 <>₹{selectedPlan.price.toLocaleString('en-IN')}</>
 )}
 </p>
 </div>
 <div style={{ textAlign: 'right' }}>
 <p style={{ fontSize: 13, color: '#9b9b9b', marginBottom: 2 }}>Who applies</p>
 <p style={{ fontSize: 15, fontWeight: 600, color: '#0f0f0f' }}>{selectedPlan.whoApplies}</p>
 </div>
 </div>

 {/* Coupon code */}
 {selectedPlan.id !== 'free' && (
 <div style={{ marginBottom: 16 }}>
 {couponApplied ? (
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 padding: '10px 14px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10 }}>
 <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
 "{couponApplied.toUpperCase()}" applied — {COUPON_DISCOUNT_PCT}% off
 </span>
 <button type="button" onClick={() => { setCouponApplied(null); setCouponInput(''); setCouponError(null) }}
 style={{ background: 'none', border: 'none', color: '#6b6b6b', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
 Remove
 </button>
 </div>
 ) : (
 <div>
 <div style={{ display: 'flex', gap: 8 }}>
 <input
 value={couponInput}
 onChange={e => { setCouponInput(e.target.value); setCouponError(null) }}
 onKeyDown={e => { if (e.key === 'Enter') applyCoupon() }}
 placeholder="Coupon code"
 style={{ flex: 1, height: 42, padding: '0 14px', borderRadius: 10,
 border: '1.5px solid #e8e8e8', fontSize: 14, fontFamily: "'Inter',sans-serif" }}
 />
 <button type="button" onClick={applyCoupon} disabled={!couponInput.trim()} style={{
 height: 42, padding: '0 18px', borderRadius: 10, border: 'none',
 background: couponInput.trim() ? '#0f0f0f' : '#e8e8e8',
 color: couponInput.trim() ? '#fff' : '#9b9b9b',
 fontSize: 13, fontWeight: 600, cursor: couponInput.trim() ? 'pointer' : 'not-allowed',
 }}>Apply</button>
 </div>
 {couponError && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{couponError}</p>}
 </div>
 )}
 </div>
 )}

 {error && (
 <div style={{ marginBottom: 16, padding: '14px 16px', background: '#fef2f2',
 border: '1px solid #fecaca', borderRadius: 12, fontSize: 14, color: '#dc2626' }}>
 {error}
 </div>
 )}

 {/* Pay button */}
 <button onClick={handlePay} disabled={loading} style={{
 width: '100%', height: 56, background: loading ? '#9b9b9b' : selectedPlan.color,
 color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700,
 cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Inter',sans-serif",
 display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
 transition: 'background 0.2s',
 boxShadow: loading ? 'none' : `0 4px 16px ${selectedPlan.color}44`,
 }}>
 {loading ? (
 <>
 <div style={{ width: 18, height: 18, borderRadius: '50%',
 border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
 animation: 'spin 0.7s linear infinite' }} />
 Opening payment…
 </>
 ) : (
 selectedPlan.id === 'free' ? 'Continue with Free' :
 `Pay ₹${(couponApplied
 ? Math.round(selectedPlan.price * (1 - COUPON_DISCOUNT_PCT / 100))
 : selectedPlan.price
 ).toLocaleString('en-IN')} for ${selectedPlan.label}`
 )}
 </button>

 <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap',
 marginTop: 16, marginBottom: 4 }}>
 {['Real admin applies daily', 'WhatsApp proof of every application', 'Cancel anytime'].map(t => (
 <span key={t} style={{ fontSize: 12, color: '#6b6b6b', display: 'flex',
 alignItems: 'center', gap: 5 }}>
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3">
 <polyline points="20 6 9 17 4 12"/>
 </svg>
 {t}
 </span>
 ))}
 </div>

 <p style={{ textAlign: 'center', fontSize: 12, color: '#b5b5b5', marginTop: 6 }}>
 Secured by Razorpay, UPI, Cards, Net banking, No auto-renewal
 </p>
 </div>
 <style>{`
 @keyframes spin { to { transform: rotate(360deg); } }
 @media (max-width: 1024px) and (min-width: 769px) {
 .sub-pricing-grid { grid-template-columns: repeat(2,1fr) !important; }
 }
 @media (max-width: 768px) {
 .sub-pricing-grid {
 display: flex !important;
 overflow-x: auto !important;
 scroll-snap-type: x mandatory !important;
 -webkit-overflow-scrolling: touch !important;
 gap: 14px !important;
 padding: 4px 24px 16px !important;
 margin: 0 -24px 28px !important;
 max-width: 100vw !important;
 scrollbar-width: none !important;
 }
 .sub-pricing-grid::-webkit-scrollbar { display: none !important; }
 .sub-pricing-card {
 flex: 0 0 82vw !important;
 scroll-snap-align: center !important;
 }
 }
 `}</style>
 </div>
 )
}
