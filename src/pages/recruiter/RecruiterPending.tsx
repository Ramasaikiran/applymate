import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import NotificationBell from '../../components/NotificationBell'
import { CenterCard, H1, btnDark, btnGhost, FONT } from './ui'

type NodeState = 'done' | 'active' | 'todo' | 'failed'

function Node({ state, label, sub }: { state: NodeState; label: string; sub?: string }) {
  const color = state === 'failed' ? '#dc2626' : state === 'todo' ? '#d4d4d4' : '#16a34a'
  return (
    <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
      <div style={{ position: 'relative', width: 36, height: 36, margin: '0 auto 8px' }}>
        {state === 'active' && <span className="rp-ring" style={{ borderColor: '#d97706' }} />}
        <div className={state === 'failed' ? 'rp-shake' : ''} style={{
          width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: state === 'todo' ? '#fff' : state === 'active' ? '#fffbeb' : state === 'failed' ? '#fef2f2' : '#f0fdf4',
          border: `2px solid ${state === 'active' ? '#d97706' : color}`, position: 'relative',
        }}>
          {state === 'done' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline className="rp-draw" points="20 6 9 17 4 12" />
            </svg>
          )}
          {state === 'active' && <span className="rp-dot" />}
          {state === 'failed' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </div>
      </div>
      <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0, color: state === 'todo' ? '#b5b5b5' : '#0f0f0f' }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: '#9b9b9b', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  )
}

function Line({ filled, failed }: { filled: boolean; failed?: boolean }) {
  return (
    <div style={{ flex: '0 0 28px', height: 2, marginTop: 17, background: '#e5e5e5', position: 'relative', overflow: 'hidden' }}>
      <div className="rp-fill" style={{ position: 'absolute', inset: 0, background: failed ? '#dc2626' : '#16a34a',
        transform: filled ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left' }} />
    </div>
  )
}

export default function RecruiterPending() {
  const { recruiter, refreshProfile, signOut } = useAuth()
  const [checking, setChecking] = useState(false)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  // While waiting, re-check every 30 seconds so approval shows up without a tap.
  useEffect(() => {
    if (recruiter?.status !== 'pending') return
    const t = setInterval(() => { refreshProfile() }, 30_000)
    return () => clearInterval(t)
  }, [recruiter?.status, refreshProfile])

  if (!recruiter) return <Navigate to="/recruiter/apply" replace />
  if (recruiter.status === 'approved') return <Navigate to="/recruiter" replace />

  async function check() {
    setChecking(true)
    const started = Date.now()
    await refreshProfile()
    // keep the animation visible long enough to read, even on a fast network
    const wait = 900 - (Date.now() - started)
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    setChecking(false)
    setCheckedAt(new Date())
  }

  const status = recruiter.status
  const decided = status === 'rejected' || status === 'suspended'
  const submitted = new Date(recruiter.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const title = status === 'pending' ? 'Application submitted' : status === 'rejected' ? 'Application rejected' : 'Account suspended'

  return (
    <CenterCard>
      <style>{`
        @keyframes rp-pulse { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(1.9); opacity: 0 } }
        @keyframes rp-blink { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        @keyframes rp-draw { from { stroke-dashoffset: 30 } to { stroke-dashoffset: 0 } }
        @keyframes rp-pop { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes rp-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-3px) } 75% { transform: translateX(3px) } }
        @keyframes rp-spin { to { transform: rotate(360deg) } }
        .rp-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid; animation: rp-pulse 1.6s ease-out infinite }
        .rp-dot { width: 10px; height: 10px; border-radius: 50%; background: #d97706; animation: rp-blink 1.2s ease-in-out infinite }
        .rp-draw { stroke-dasharray: 30; animation: rp-draw .6s ease both }
        .rp-fill { transition: transform .7s ease }
        .rp-pop { animation: rp-pop .35s ease both }
        .rp-shake { animation: rp-shake .4s ease 1 }
        .rp-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; animation: rp-spin .7s linear infinite; display: inline-block; vertical-align: -2px; margin-right: 8px }
        @media (prefers-reduced-motion: reduce) { .rp-ring, .rp-dot, .rp-draw, .rp-pop, .rp-shake, .rp-spinner { animation: none !important } .rp-fill { transition: none } }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#9b9b9b', margin: 0 }}>RECRUITER APPLICATION</p>
        <NotificationBell />
      </div>

      <h1 style={H1}>{title}</h1>

      {/* Progress tracker */}
      <div style={{ display: 'flex', alignItems: 'flex-start', margin: '22px 0 24px' }}>
        <Node state="done" label="Submitted" sub={submitted} />
        <Line filled />
        <Node state={decided ? 'done' : 'active'} label="In review" />
        <Line filled={decided} failed={decided} />
        <Node state={decided ? 'failed' : 'todo'} label={status === 'suspended' ? 'Suspended' : status === 'rejected' ? 'Rejected' : 'Decision'} />
      </div>

      {status === 'pending' && (
        <p style={{ fontSize: 14.5, color: '#6b6b6b', lineHeight: 1.7, margin: '0 0 18px' }}>
          Your application was received. An admin is verifying your company details. You cannot post jobs or view candidates until it is approved.
        </p>
      )}

      {decided && (
        <div className="rp-pop" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 16px', margin: '0 0 18px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', margin: '0 0 6px', letterSpacing: '0.04em' }}>
            {status === 'rejected' ? 'WHY IT WAS REJECTED' : 'WHY IT WAS SUSPENDED'}
          </p>
          <p style={{ fontSize: 14, color: '#7f1d1d', lineHeight: 1.65, margin: 0 }}>
            {recruiter.review_note || 'No reason was added. Contact support@applymate.in for details.'}
          </p>
          <p style={{ fontSize: 11.5, color: '#b45454', margin: '10px 0 0' }}>A copy is in your notifications (bell icon, top right).</p>
        </div>
      )}

      <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 12, padding: 16, fontSize: 13.5, color: '#4b4b4b', lineHeight: 1.8, marginBottom: 20 }}>
        <div><strong>{recruiter.company_name}</strong> · {recruiter.designation}</div>
        <div>{recruiter.work_email}</div>
      </div>

      {/* Result of the last "Check status" tap */}
      {status === 'pending' && checkedAt && !checking && (
        <div key={checkedAt.getTime()} className="rp-pop" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 14 }}>
          Still in review. Checked at {checkedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontFamily: FONT }}>
        {status === 'rejected' && (
          <Link to="/recruiter/apply" style={{ ...btnDark(), textDecoration: 'none', display: 'inline-block' }}>Edit and resubmit</Link>
        )}
        {status === 'pending' && (
          <button onClick={check} disabled={checking} style={btnDark(checking)}>
            {checking ? <><span className="rp-spinner" />Checking…</> : 'Check status'}
          </button>
        )}
        <button onClick={signOut} style={btnGhost}>Sign out</button>
      </div>
      {status === 'suspended' && (
        <p style={{ fontSize: 12.5, color: '#9b9b9b', marginTop: 18 }}>Questions? Email support@applymate.in</p>
      )}
    </CenterCard>
  )
}
