import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  subscriptionId: string
  onClose: () => void
  onDone: () => void
}

export default function RefundModal({ subscriptionId, onClose, onDone }: Props) {
  const [reason, setReason] = useState<'withdrawal' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  const submit = async () => {
    if (!reason) return
    setLoading(true)
    setError('')
    const { data, error: fnErr } = await supabase.functions.invoke('request-refund', {
      body: { subscription_id: subscriptionId, reason },
    })
    setLoading(false)
    if (fnErr || data?.error) {
      setError(data?.error || fnErr?.message || 'Refund failed. Try again.')
      return
    }
    setResult(data)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 400, width: '100%',
        fontFamily: "'Inter',sans-serif" }}>

        {!result ? (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Request refund</h3>
            <p style={{ fontSize: 13, color: '#6b6b6b', marginBottom: 16, lineHeight: 1.5 }}>
              Job in 15 days? We apply the next 15 for a better offer, no refund.
              Want out? We refund unused days, minus Razorpay's 2% fee.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setReason('withdrawal')} style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 10,
                border: `1.5px solid ${reason === 'withdrawal' ? '#0f0f0f' : '#e5e5e5'}`,
                background: reason === 'withdrawal' ? '#f7f7f7' : '#fff',
                fontFamily: "'Inter',sans-serif", fontSize: 13.5, cursor: 'pointer' }}>
                I want to withdraw
              </button>
            </div>

            {error && <p style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: '11px 0', borderRadius: 9, border: '1px solid #e5e5e5',
                background: '#fff', fontFamily: "'Inter',sans-serif", fontSize: 13.5, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submit} disabled={!reason || loading} style={{
                flex: 1, padding: '11px 0', borderRadius: 9, border: 'none',
                background: reason && !loading ? '#0f0f0f' : '#cfcfcf', color: '#fff',
                fontFamily: "'Inter',sans-serif", fontSize: 13.5, fontWeight: 600,
                cursor: reason && !loading ? 'pointer' : 'not-allowed' }}>
                {loading ? 'Processing...' : 'Confirm refund'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Refund processed</h3>
            <div style={{ fontSize: 13.5, color: '#3b3b3b', lineHeight: 1.9 }}>
              <p>Days used: <strong>{result.days_used}</strong></p>
              <p>Days refunded: <strong>{result.days_remaining}</strong></p>
              <p>Refund amount: <strong>₹{result.refund_gross_rupees}</strong></p>
              <p>Razorpay fee (non-refundable): <strong>₹{result.razorpay_fee_rupees}</strong></p>
              <p style={{ marginTop: 6, fontSize: 15, fontWeight: 700, color: '#15803d' }}>
                You get: ₹{result.refund_net_rupees}
              </p>
            </div>
            <button onClick={onDone} style={{
              marginTop: 18, width: '100%', padding: '11px 0', borderRadius: 9, border: 'none',
              background: '#0f0f0f', color: '#fff', fontFamily: "'Inter',sans-serif",
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
