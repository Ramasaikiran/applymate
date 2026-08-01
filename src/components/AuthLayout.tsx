import type { ReactNode } from 'react'
import { isMisconfigured } from '../lib/supabase'

const STATS = [
 { n: '10–15', label: 'Applications / day' },
 { n: '4 min', label: 'Setup time' },
 { n: '₹399', label: 'Starting / month' },
]

const AVATARS = ['PK','AR','SM','VR','NK']

export default function AuthLayout({ eyebrow, title, subtitle, children, footer }: {
 eyebrow: string; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode
}) {
 return (
 <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter',-apple-system,sans-serif" }}>

 {/* ── LEFT PANEL ──────────────────────────────────────────── */}
 <aside className="oc-left" style={{
 width: '50%', background: '#0f0f0f', padding: '44px 48px',
 display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
 }}>
 {/* Logo */}
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 72 }}>
 <div style={{ width: 42, height: 42, borderRadius: 11, background: '#fff',
 display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <img src="/logo-mark.png" alt="ApplyMate" style={{ width: 28, height: 28, objectFit: 'contain' }} />
 </div>
 <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.02em' }}>ApplyMate</span>
 </div>

 {/* Hero */}
 <div style={{ flex: 1 }}>
 {/* Live badge */}
 <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
 background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
 borderRadius: 99, padding: '6px 14px', marginBottom: 32 }}>
 <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'block', flexShrink: 0 }} />
 <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
 Now open, founding members
 </span>
 </div>

 <h1 style={{
 fontFamily: "'Instrument Serif',Georgia,serif",
 fontSize: 52, fontWeight: 400, lineHeight: 1.08,
 letterSpacing: '-0.03em', color: '#fff', marginBottom: 20,
 }}>
 We apply.<br />
 <span style={{ color: 'rgba(255,255,255,0.4)' }}>You interview.</span>
 </h1>
 <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, maxWidth: 360, marginBottom: 44 }}>
 Tell us your skills once. We apply to 10–15 matching jobs daily, directly on official career portals.
 </p>

 {/* Stats */}
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1,
 background: 'rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', marginBottom: 32 }}>
 {STATS.map(s => (
 <div key={s.n} style={{ padding: '18px 16px', background: 'rgba(255,255,255,0.04)' }}>
 <p style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 22, color: '#fff', marginBottom: 4 }}>{s.n}</p>
 <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{s.label}</p>
 </div>
 ))}
 </div>

 {/* Avatar stack */}
 <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
 <div style={{ display: 'flex' }}>
 {AVATARS.map((a, i) => (
 <div key={a} style={{
 width: 30, height: 30, borderRadius: '50%',
 background: `hsl(${i * 50 + 180},50%,55%)`,
 border: '2px solid #0f0f0f', marginLeft: i === 0 ? 0 : -8,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 10, fontWeight: 700, color: '#fff',
 }}>{a[0]}</div>
 ))}
 </div>
 </div>
 </div>

 {/* Bottom trust */}
 <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)',
 display: 'flex', gap: 20 }}>
 {[' Razorpay secured', 'DPDPA compliant', 'Cancel anytime'].map(t => (
 <span key={t} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{t}</span>
 ))}
 </div>
 </aside>

 {/* RIGHT PANEL: FORM */}
 <main style={{ flex: 1, display: 'flex', flexDirection: 'column',
 alignItems: 'center', justifyContent: 'center',
 padding: '40px 24px', background: '#fff', overflowY: 'auto' }}>

 {/* Mobile top bar */}
 <div className="oc-mobile-nav" style={{ display: 'none', position: 'fixed', top: 0,
 left: 0, right: 0, height: 56, alignItems: 'center', padding: '0 20px',
 background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)',
 borderBottom: '1px solid #f0f0f0', zIndex: 50 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f7f7f5',
 border: '1px solid #ececec', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <img src="/logo-mark.png" alt="ApplyMate" style={{ width: 24, height: 24, objectFit: 'contain' }} />
 </div>
 <span style={{ fontSize: 14, fontWeight: 600 }}>ApplyMate</span>
 </div>
 </div>

 {/* Mobile social proof strip */}
 <div className="oc-mobile-proof" style={{ display: 'none', width: '100%',
 maxWidth: 420, marginBottom: 24 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between',
 background: '#f7f7f7', borderRadius: 10, padding: '12px 16px' }}>
 {STATS.map(s => (
 <div key={s.n} style={{ textAlign: 'center' }}>
 <p style={{ fontSize: 16, fontWeight: 700, color: '#0f0f0f', marginBottom: 2 }}>{s.n}</p>
 <p style={{ fontSize: 10, color: '#9b9b9b' }}>{s.label}</p>
 </div>
 ))}
 </div>
 </div>

 {isMisconfigured && (
 <div style={{ width: '100%', maxWidth: 420, marginBottom: 20,
 background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
 padding: '12px 16px', fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
 Set <code>VITE_SUPABASE_URL</code> + <code>VITE_SUPABASE_ANON_KEY</code> in Vercel env vars then redeploy.
 </div>
 )}

 <div className="anim-slide-up" style={{ width: '100%', maxWidth: 420 }}>
 <p style={{ fontSize: 11, fontWeight: 600, color: '#b5b5b5',
 letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{eyebrow}</p>
 <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 32,
 fontWeight: 400, color: '#0f0f0f', lineHeight: 1.15,
 letterSpacing: '-0.02em', marginBottom: subtitle ? 8 : 28 }}>{title}</h2>
 {subtitle && (
 <p style={{ fontSize: 14, color: '#9b9b9b', lineHeight: 1.65, marginBottom: 28 }}>{subtitle}</p>
 )}

 {children}

 {footer && (
 <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#9b9b9b' }}>{footer}</p>
 )}
 <p style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#c5c5c5', lineHeight: 1.7 }}>
 By continuing you agree to our{' '}
 <a href="#" style={{ color: '#9b9b9b', textDecoration: 'underline' }}>Terms</a>
 {' '}&amp;{' '}
 <a href="#" style={{ color: '#9b9b9b', textDecoration: 'underline' }}>Privacy Policy</a>.
 </p>
 </div>
 </main>

 <style>{`
 @media (max-width: 860px) {
 .oc-left { display: none !important; }
 .oc-mobile-nav { display: flex !important; }
 .oc-mobile-proof { display: block !important; }
 main { padding-top: 80px !important; justify-content: flex-start !important; }
 }
 .oc-input {
 width: 100%; height: 54px; padding: 0 16px;
 font-family: 'Inter',-apple-system,sans-serif; font-size: 16px; color: #0f0f0f;
 background: #fff; border: 1.5px solid #e5e5e5; border-radius: 10px;
 outline: none; box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s;
 }
 .oc-input:focus { border-color: #0f0f0f; box-shadow: 0 0 0 3px rgba(15,15,15,0.08); }
 .oc-input.error { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.08); }
 .oc-input::placeholder { color: #c5c5c5; }
 .oc-label { display: block; font-size: 13px; font-weight: 600; color: #4b4b4b; margin-bottom: 8px; }
 .oc-btn-primary {
 width: 100%; height: 54px; display: flex; align-items: center; justify-content: center;
 font-family: 'Inter',sans-serif; font-size: 15.5px; font-weight: 600;
 color: #fff; background: #0f0f0f; border: none; border-radius: 12px;
 cursor: pointer; letter-spacing: -0.01em; transition: opacity 0.15s, transform 0.1s;
 }
 .oc-btn-primary:active { transform: scale(0.98); }
 .oc-btn-primary:disabled { cursor: not-allowed; opacity: 0.5; }
 .oc-eye-btn {
 position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
 background: none; border: none; cursor: pointer; color: #9b9b9b;
 width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
 border-radius: 8px;
 }
 .oc-eye-btn:active { background: #f2f2f2; }
 .oc-field-error { margin-top: 5px; font-size: 12px; color: #ef4444; }
 .oc-error { padding: 12px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; font-size: 13px; color: #dc2626; margin-bottom: 16px; line-height: 1.5; }
 .oc-divider { display: flex; align-items: center; gap: 12; color: #c5c5c5; font-size: 12px; font-weight: 500; }
 .oc-divider::before,.oc-divider::after { content: ''; flex: 1; height: 1px; background: #f0f0f0; }
 .anim-slide-up { animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
 @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
 @keyframes ping { 75%,100% { transform:scale(2); opacity:0; } }
 `}</style>
 </div>
 )
}
