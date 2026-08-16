import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import inboxProof1 from '../assets/inbox-proof/proof-1.jpg'
import inboxProof2 from '../assets/inbox-proof/proof-2.jpg'
import inboxProof3 from '../assets/inbox-proof/proof-3.jpg'
import inboxProof4 from '../assets/inbox-proof/proof-4.jpg'
import inboxProof5 from '../assets/inbox-proof/proof-5.jpg'
import logoMoodle from '../assets/company-logos/logo-moodle.jpg'
import logoTuring from '../assets/company-logos/logo-turing.jpg'
import logoWipro from '../assets/company-logos/logo-wipro.jpg'
import logoGoogle from '../assets/company-logos/logo-google.jpg'
import logoSalesforce from '../assets/company-logos/logo-salesforce.jpg'

const COMPANY_LOGOS = [
 { name: 'Moodle', src: logoMoodle },
 { name: 'Turing', src: logoTuring },
 { name: 'Wipro', src: logoWipro },
 { name: 'Google', src: logoGoogle },
 { name: 'Salesforce', src: logoSalesforce },
]

const INBOX_PROOFS = [inboxProof1, inboxProof2, inboxProof3, inboxProof4, inboxProof5]

/* ── tiny helpers ─────────────────────────────────────────────── */
const TICK = () => (
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}>
 <polyline points="20 6 9 17 4 12"/>
 </svg>
)
const CROSS = () => (
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}>
 <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
 </svg>
)

const STATUS_LABEL: Record<string, string> = {
  shortlisted: 'got shortlisted at',
  interview:   'landed an interview at',
  offer:       'received an offer from',
  joined:      'joined',
  hired:       'got hired at',
}

function timeAgo(daysAgo: number) {
  if (daysAgo <= 0) return 'today'
  if (daysAgo === 1) return 'yesterday'
  if (daysAgo < 7) return `${daysAgo} days ago`
  return `${Math.floor(daysAgo / 7)}w ago`
}

function ActivityFeed() {
  const [items, setItems] = useState<{ first_name: string; company: string; status: string; days_ago: number }[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    supabase.rpc('get_recent_activity').then(({ data }: { data: any }) => { if (data?.length) setItems(data) })
  }, [])

  useEffect(() => {
    if (items.length < 2) return
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 4000)
    return () => clearInterval(t)
  }, [items.length])

  // Real activity only, no data yet means nothing renders, ever.
  if (!items.length) return null
  const item = items[idx]

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '28px auto 0' }}>
      <div key={idx} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999,
        fontSize: 13.5, color: '#166534', animation: 'fadeIn 0.4s ease',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
        <span className="activity-pill-text">
          <strong>{item.first_name}</strong> {STATUS_LABEL[item.status] ?? 'made progress at'} <strong>{item.company}</strong>
          <span style={{ color: '#4b7c58' }}> ({timeAgo(item.days_ago)})</span>
        </span>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}

export default function Landing() {
 const { session, subscription, profile } = useAuth()
 const navigate = useNavigate()
 const [showSticky, setShowSticky] = useState(false)
 const [openFaq, setOpenFaq] = useState<number | null>(null)
 const [selectedPlan, setSelectedPlan] = useState<{ label: string; price: string } | null>(null)
 const [howItWorksInView, setHowItWorksInView] = useState(false)
 const [jobRefundClaimed, setJobRefundClaimed] = useState(0)
 const [jobRefundTotal, setJobRefundTotal] = useState(10)
 const [jobRefundBarFilled, setJobRefundBarFilled] = useState(false)

 /* job-refund promo counter */
 useEffect(() => {
 let cancelled = false
 supabase.from('job_refund_program').select('claimed_count, total_slots').eq('id', 1).single()
 .then(({ data }) => {
 if (cancelled || !data) return
 setJobRefundClaimed(data.claimed_count)
 setJobRefundTotal(data.total_slots)
 // Trigger the fill-in animation a tick after mount so the CSS
 // transition actually runs instead of snapping to final width.
 requestAnimationFrame(() => requestAnimationFrame(() => setJobRefundBarFilled(true)))
 })
 return () => { cancelled = true }
 }, [])

 /* auth redirect */
 useEffect(() => {
 if (!session) return
 if (profile === null) return
 if (profile?.is_admin) { navigate('/admin', { replace: true }); return }
 if (!profile?.user_type) { navigate('/onboarding', { replace: true }); return }
 if (!subscription) { navigate('/subscription', { replace: true }); return }
 navigate('/dashboard', { replace: true })
 }, [session, profile, subscription])

 useEffect(() => {
 const onScroll = () => setShowSticky(window.scrollY > 600)
 window.addEventListener('scroll', onScroll, { passive: true })
 return () => window.removeEventListener('scroll', onScroll)
 }, [])

 const howItWorksRef = useRef<HTMLDivElement>(null)
 useEffect(() => {
 const el = howItWorksRef.current
 if (!el) return
 const observer = new IntersectionObserver(
 ([entry]) => { if (entry.isIntersecting) setHowItWorksInView(true) },
 { threshold: 0.35 }
 )
 observer.observe(el)
 return () => observer.disconnect()
 }, [])

 const goSignUp = () => navigate('/sign-up')

 const FAQS = [
 {
 q: 'Is this live? How do I know you\'ll actually apply?',
 a: 'We\'re onboarding our first founding members right now. Once your profile is active, your dashboard shows every single application: company, role, date, matched skills, and status.',
 },
 {
 q: 'Do you write generic cover letters or tailored ones?',
 a: 'Every application is tailored to the JD. We match your skills, highlight relevant projects, and write a cover letter specific to that company.',
 },
 {
 q: 'How many applications per day?',
 a: '10–15 applications daily once your profile is active. That\'s 300–450/month while you focus on interview prep and DSA.',
 },
 {
 q: 'Can I cancel anytime?',
 a: 'Yes. No auto-renewal, no lock-in. Plans are one-time payments. When your period ends, you decide if you want to continue.',
 },
 {
 q: 'I\'m a fresher with no experience. Will this work?',
 a: 'Built especially for freshers. We highlight your projects, college, skills, and internships, and target fresher-friendly roles at companies that actively hire from colleges.',
 },
 {
 q: 'Why join now instead of waiting?',
 a: 'Founding member pricing is locked for early sign-ups and we\'re limiting our first batch so every profile gets proper attention from our team. Once a batch fills, pricing moves to standard rates.',
 },
 {
 q: 'What if I get a job, or want out?',
 a: 'Land a job on your plan? We keep applying to find you an even better offer, refunds aren\'t available once an offer is on record. Want out before that happens? We refund unused days, minus days used and Razorpay\'s 2% fee.',
 },
 ]

 return (
 <div style={{ fontFamily: "'Inter',-apple-system,sans-serif", background: '#fff', color: '#0f0f0f' }}>

 {/* ── PROMO BANNER ──────────────────────────────────────── */}
 <div style={{ background: '#0f0f0f', color: '#fff', textAlign: 'center',
 padding: '10px 16px', fontSize: 13.5 }}>
 <span>
 🎉 50% off all plans - use code{' '}
 <strong style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 8px',
 borderRadius: 6, letterSpacing: '0.03em' }}>applymate50</strong>{' '}
 at checkout
 </span>
 </div>

 {/* ── NAV ───────────────────────────────────────────────── */}
 <nav style={{ position: 'sticky', top: 0, left: 0, right: 0, zIndex: 100,
 background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)',
 borderBottom: '1px solid #f0f0f0' }}>
 <div className="nav-inner" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px',
 height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
 <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f7f7f5',
 border: '1px solid #ececec', display: 'flex', alignItems: 'center', justifyContent: 'center',
 flexShrink: 0 }}>
 <img src="/logo-mark.png" alt="ApplyMate" style={{ width: 26, height: 26, objectFit: 'contain' }} />
 </div>
 <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>ApplyMate</span>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
 <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="nav-free-pill" style={{
 fontSize: 13, color: '#22c55e', fontWeight: 600,
 background: '#f0fdf4', padding: '4px 12px', borderRadius: 99,
 border: '1px solid #bbf7d0', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 whiteSpace: 'nowrap',
 }}>
 Free to start
 </button>
 <button onClick={() => navigate('/sign-in')} className="nav-signin" style={{
 background: 'none', border: 'none', fontSize: 14, color: '#6b6b6b',
 cursor: 'pointer', fontFamily: "'Inter',sans-serif", padding: '8px 6px',
 whiteSpace: 'nowrap',
 }}>Sign in</button>
 <button onClick={goSignUp} style={{
 background: '#0f0f0f', color: '#fff', border: 'none',
 padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap', flexShrink: 0,
 }}>Get started →</button>
 </div>
 </div>
 </nav>

 {/* ── HERO ──────────────────────────────────────────────── */}
 <section style={{ maxWidth: 780, margin: '0 auto', padding: '56px 24px 80px', textAlign: 'center' }}>

 <h1 style={{
 fontFamily: "'Instrument Serif',Georgia,serif",
 fontSize: 'clamp(48px, 9vw, 84px)',
 fontWeight: 400, lineHeight: 1.04,
 letterSpacing: '-0.03em', color: '#0f0f0f',
 marginBottom: 28,
 }}>
 Job applications for<br />
 Indian job seekers<br />
 <span style={{ color: '#9b9b9b' }}>Done daily, for you</span>
 </h1>

 <p style={{ fontSize: 20, color: '#6b6b6b', lineHeight: 1.65,
 maxWidth: 560, margin: '0 auto 44px', fontWeight: 400 }}>
 Get matched to 10–15 relevant jobs a day. Apply yourself for free,
 or let our team apply for you.
 </p>

 {/* Primary CTA */}
 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
 <button onClick={goSignUp} style={{
 background: '#0f0f0f', color: '#fff', border: 'none',
 padding: '20px 56px', borderRadius: 14, fontSize: 19, fontWeight: 700,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 letterSpacing: '-0.02em',
 boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
 }}>
 Get started for free
 </button>
 <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} style={{
 background: 'none', border: 'none', fontSize: 13.5, color: '#9b9b9b',
 cursor: 'pointer', fontFamily: "'Inter',sans-serif", textDecoration: 'underline',
 textUnderlineOffset: 3,
 }}>
 or see founding member plans where we apply for you →
 </button>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
 {['No card required to start free', 'Official career portals only', 'Cancel anytime', 'Secured by Razorpay'].map((t, i) => (
 <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#9b9b9b' }}>
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
 {t}
 </span>
 ))}
 </div>
 </div>
 </section>

 <a href="tel:+916303728397" style={{
 position: 'fixed', bottom: 90, left: 20, right: 20, zIndex: 150,
 background: '#fff', borderRadius: 999, padding: '14px 22px',
 display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none',
 boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxWidth: 420, margin: '0 auto',
 opacity: showSticky ? 0 : 1,
 pointerEvents: showSticky ? 'none' : 'auto',
 transform: showSticky ? 'translateY(20px)' : 'translateY(0)',
 transition: 'opacity 0.25s ease, transform 0.25s ease',
 }}>
 <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#0ea5e9',
 display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
 <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.3 11.3 0 003.55.57 1 1 0 011 1V20a1 1 0 01-1 1C10.4 21 3 13.6 3 4a1 1 0 011-1h3.5a1 1 0 011 1 11.3 11.3 0 00.57 3.55 1 1 0 01-.25 1.02l-2.2 2.2z"/>
 </svg>
 </span>
 <span>
 <span style={{ display: 'block', fontSize: 12, color: '#6b6b6b' }}>Have questions? Call</span>
 <span style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#0f0f0f' }}>+91 63037 28397</span>
 </span>
 </a>

 <ActivityFeed />

 {/* ── WHY APPLYMATE (comparison table) ─────────────────── */}
 <section style={{ background: '#fff', borderTop: '1px solid #f0f0f0', padding: '88px 0' }}>
 <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>
 <p className="eyebrow-label" style={{ fontSize: 11, fontWeight: 700, color: '#b5b5b5',
 letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
 COMPARE
 </p>
 <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 34, fontWeight: 400,
 color: '#0f0f0f', letterSpacing: '-0.02em', marginBottom: 8 }}>
 Why ApplyMate?
 </h2>
 <p style={{ fontSize: 14, color: '#9b9b9b' }} className="why-swipe-hint">
 Swipe to compare →
 </p>
 </div>

 <div style={{ overflowX: 'auto', padding: '28px 24px 8px', WebkitOverflowScrolling: 'touch' }}>
 <div style={{ display: 'grid', gridTemplateColumns: '150px 240px 200px 200px',
 gap: 0, minWidth: 790, maxWidth: 1000, margin: '0 auto' }}>

 {/* header row */}
 <div />
 <div style={{ background: '#0f0f0f', borderRadius: '14px 14px 0 0', padding: '18px 20px', textAlign: 'center' }}>
 <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#0f0f0f',
 background: '#fff', padding: '3px 10px', borderRadius: 99, marginBottom: 10 }}>
 ★ MOST EFFECTIVE
 </span>
 <p className="compare-title" style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>ApplyMate</p>
 <p className="compare-sub" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Done for you</p>
 </div>
 <div style={{ padding: '18px 16px', textAlign: 'center' }}>
 <p className="compare-title" style={{ fontSize: 15, fontWeight: 700, color: '#0f0f0f' }}>Applying solo</p>
 <p className="compare-sub" style={{ fontSize: 12, color: '#9b9b9b' }}>DIY, manual</p>
 </div>
 <div style={{ padding: '18px 16px', textAlign: 'center' }}>
 <p className="compare-title" style={{ fontSize: 15, fontWeight: 700, color: '#0f0f0f' }}>Staffing agencies</p>
 <p className="compare-sub" style={{ fontSize: 12, color: '#9b9b9b' }}>Agencies & consultancies</p>
 </div>

 {[
 { label: 'Your salary', us: 'Keep 100% of your salary', them1: 'Keep 100% (but wastes your time)', them2: '20–30% salary commission' },
 { label: 'Job selection', us: 'Matched to your skills daily', them1: 'You scroll and guess', them2: 'Manual, slow selection' },
 { label: 'Resume', us: 'Resume rewritten to match each JD', them1: 'Same resume for most jobs', them2: 'Same resume for most jobs' },
 { label: 'Volume', us: '10–15 tailored applications/day', them1: '3–5/day before burnout', them2: 'Limited applications' },
 { label: 'The work', us: 'We apply. You just interview.', them1: 'You do everything, alone', them2: 'Manual process, slow' },
 { label: 'Tracking', us: 'Live dashboard, every application', them1: 'A messy spreadsheet, maybe', them2: 'Little or no transparency' },
 { label: 'Where we apply', us: 'Official career pages, every time.', them1: 'Mostly job boards, Easy Apply', them2: 'Mostly job boards & Easy Apply' },
 { label: 'Pricing', us: 'From ₹399/month, cancel anytime', them1: 'Free, but costs your time', them2: 'High upfront fees ($1,200+)' },
 ].map((row, i) => (
 <>
 <div key={row.label + 'l'} style={{ padding: '16px 12px', display: 'flex', alignItems: 'center',
 borderTop: '1px solid #f0f0f0', fontSize: 12, fontWeight: 700, color: '#0f0f0f',
 letterSpacing: '0.02em', textTransform: 'uppercase' }}>
 {row.label}
 </div>
 <div key={row.label + 'us'} style={{ padding: '16px 20px', background: '#f7f9ff',
 borderTop: '1px solid #e8edff', display: 'flex', alignItems: 'flex-start', gap: 10,
 borderLeft: '1px solid #e8edff', borderRight: '1px solid #e8edff',
 borderBottom: i === 7 ? '1px solid #e8edff' : 'none',
 borderRadius: i === 7 ? '0 0 14px 14px' : 0 }}>
 <TICK /><span className="compare-us-text" style={{ fontSize: 13.5, fontWeight: 600, color: '#0f0f0f', lineHeight: 1.4 }}>{row.us}</span>
 </div>
 <div key={row.label + 't1'} style={{ padding: '16px 16px', borderTop: '1px solid #f0f0f0',
 display: 'flex', alignItems: 'flex-start', gap: 10 }}>
 <CROSS /><span className="compare-them-text" style={{ fontSize: 13, color: '#7a7a7a', lineHeight: 1.4 }}>{row.them1}</span>
 </div>
 <div key={row.label + 't2'} style={{ padding: '16px 16px', borderTop: '1px solid #f0f0f0',
 display: 'flex', alignItems: 'flex-start', gap: 10 }}>
 <CROSS /><span className="compare-them-text" style={{ fontSize: 13, color: '#7a7a7a', lineHeight: 1.4 }}>{row.them2}</span>
 </div>
 </>
 ))}
 </div>
 </div>

 <div style={{ textAlign: 'center', marginTop: 8 }}>
 <button onClick={goSignUp} style={{
 background: '#0f0f0f', color: '#fff', border: 'none',
 padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 700,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>
 Start now, 4 min setup →
 </button>
 </div>
 </section>

 {/* ── HOW IT WORKS ──────────────────────────────────────── */}
 <section style={{ maxWidth: 900, margin: '0 auto', padding: '96px 24px' }}>
 <p className="eyebrow-label" style={{ fontSize: 11, fontWeight: 700, color: '#b5b5b5',
 letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>
 HOW IT WORKS
 </p>
 <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 40,
 fontWeight: 400, textAlign: 'center', letterSpacing: '-0.025em',
 color: '#0f0f0f', marginBottom: 16 }}>
 4 minutes setup. Applications for months.
 </h2>
 <p style={{ fontSize: 16, color: '#9b9b9b', textAlign: 'center', marginBottom: 56, maxWidth: 500, margin: '0 auto 56px' }}>
 You set up once. We do the grind. You focus on being ready when they call.
 </p>

 <div ref={howItWorksRef} style={{ position: 'relative' }}>
 <div className="steps-progress-track" style={{ position: 'absolute', top: 0, left: '16.5%', right: '16.5%', height: 2,
 background: '#e5e5e5', zIndex: 1 }} />
 <div className="steps-progress-fill" style={{ position: 'absolute', top: 0, left: '16.5%', height: 2,
 background: '#22c55e', zIndex: 2,
 width: howItWorksInView ? '67%' : '0%',
 transition: 'width 1.1s cubic-bezier(0.65,0,0.35,1)' }} />
 <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2,
 background: '#f0f0f0', borderRadius: 16, overflow: 'hidden' }}>
 {[
 {
 step: '01', title: 'Fill your profile', time: '4 min',
 desc: 'Skills, resume, preferred roles, location. One time. Never repeat.',
 },
 {
 step: '02', title: 'Pick a plan', time: '2 min',
 desc: 'From ₹399/month. No hidden charges. Cancel any time instantly.',
 },
 {
 step: '03', title: 'We apply daily', time: 'Ongoing',
 desc: 'Our team finds matches and applies with tailored cover letters. You get notified of every single one.',
 },
 ].map((s, i) => (
 <div key={s.step} className="steps-card" style={{
 background: i === 1 ? '#0f0f0f' : '#fff', padding: '36px 30px',
 opacity: howItWorksInView ? 1 : 0,
 transform: howItWorksInView ? 'translateY(0)' : 'translateY(14px)',
 transition: `opacity 0.5s ease ${i * 0.15}s, transform 0.5s ease ${i * 0.15}s`,
 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between',
 alignItems: 'flex-start', marginBottom: 16 }}>
 <span style={{ fontSize: 11, fontWeight: 700,
 color: i === 1 ? 'rgba(255,255,255,0.4)' : '#b5b5b5',
 letterSpacing: '0.08em' }}>{s.step}</span>
 <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
 background: i === 1 ? 'rgba(255,255,255,0.1)' : '#f5f5f5',
 color: i === 1 ? 'rgba(255,255,255,0.6)' : '#9b9b9b' }}>{s.time}</span>
 </div>
 <p className="step-title" style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 22,
 color: i === 1 ? '#fff' : '#0f0f0f', marginBottom: 10 }}>{s.title}</p>
 <p className="step-desc" style={{ fontSize: 14, color: i === 1 ? 'rgba(255,255,255,0.55)' : '#9b9b9b',
 lineHeight: 1.65 }}>{s.desc}</p>
 </div>
 ))}
 </div>
 </div>

 <div style={{ textAlign: 'center', marginTop: 32 }}>
 <button onClick={goSignUp} style={{
 background: '#0f0f0f', color: '#fff', border: 'none',
 padding: '14px 36px', borderRadius: 10, fontSize: 15, fontWeight: 600,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>
 Start today →
 </button>
 </div>
 </section>

 {/* ── TRUST / PROOF ─────────────────────────────────────── */}
 <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 96px' }}>
 <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 16,
 padding: '40px 32px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28 }}>
 <div>
 <p className="trust-heading" style={{ fontSize: 13, fontWeight: 700, color: '#0f0f0f', marginBottom: 6 }}>
 Who applies
 </p>
 <p className="trust-body" style={{ fontSize: 13.5, color: '#7a7a7a', lineHeight: 1.6 }}>
 Basic: you apply. Pro & Max Pro: a real admin applies for you.
 </p>
 </div>
 <div>
 <p className="trust-heading" style={{ fontSize: 13, fontWeight: 700, color: '#0f0f0f', marginBottom: 6 }}>
 How matches are chosen
 </p>
 <p className="trust-body" style={{ fontSize: 13.5, color: '#7a7a7a', lineHeight: 1.6 }}>
 We apply only when skills and experience match exactly.
 </p>
 </div>
 <div>
 <p className="trust-heading" style={{ fontSize: 13, fontWeight: 700, color: '#0f0f0f', marginBottom: 6 }}>
 What you get
 </p>
 <p className="trust-body" style={{ fontSize: 13.5, color: '#7a7a7a', lineHeight: 1.6 }}>
 10–15 tailored applications daily. WhatsApp update for each one.
 </p>
 </div>
 </div>
 </section>

 {/* ── 100% MONEY BACK PROGRAM ──────────────────────────── */}
 <section style={{ maxWidth: 780, margin: '0 auto', padding: '0 24px 96px' }}>
 <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '40px 32px' }}>
 <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#dcfce7',
 border: '1px solid #bbf7d0', borderRadius: 99, padding: '6px 18px 6px 6px', marginBottom: 24 }}>
 <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800,
 letterSpacing: '0.02em', borderRadius: 99, padding: '5px 12px' }}>FIRST 10</span>
 <span style={{ fontSize: 12.5, fontWeight: 700, color: '#15803d', letterSpacing: '0.03em' }}>
 MEMBERS ONLY · MONEY-BACK PROGRAM
 </span>
 </div>

 <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontWeight: 400,
 fontSize: 'clamp(26px,4.5vw,36px)', color: '#0f0f0f', marginBottom: 16, letterSpacing: '-0.01em' }}>
 Land a job. Get your money back.
 </h2>
 <p style={{ fontSize: 15.5, color: '#4b5563', lineHeight: 1.7, marginBottom: 32 }}>
 The first 10 subscribers who land a job while on ApplyMate get a{' '}
 <strong style={{ color: '#0f0f0f' }}>100% refund</strong>, just do a short podcast
 episode with us about your job search. Prefer to skip the podcast? You'll still get{' '}
 <strong style={{ color: '#0f0f0f' }}>50% back</strong>.
 </p>

 <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 14, padding: '22px 24px' }}>
 <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700,
 color: '#15803d', marginBottom: 18 }}>
 <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
 This program is limited to the first {jobRefundTotal} placements
 </p>

 <div style={{ position: 'relative', height: 6, background: '#dcfce7', borderRadius: 999 }}>
 <div style={{
 position: 'absolute', top: 0, left: 0, height: 6, borderRadius: 999,
 background: '#16a34a',
 width: jobRefundBarFilled ? `${Math.min(100, (jobRefundClaimed / jobRefundTotal) * 100)}%` : '0%',
 transition: 'width 1.1s cubic-bezier(0.22,1,0.36,1)',
 }} />
 <div style={{
 position: 'absolute', top: '50%', left: 0, width: 14, height: 14,
 borderRadius: '50%', background: '#16a34a', transform: 'translate(-50%,-50%)',
 }} />
 <div style={{
 position: 'absolute', top: '50%', width: 10, height: 10, borderRadius: '50%',
 background: '#fff', border: '2px solid #16a34a',
 left: jobRefundBarFilled ? `${Math.min(100, (jobRefundClaimed / jobRefundTotal) * 100)}%` : '0%',
 transform: 'translate(-50%,-50%)',
 transition: 'left 1.1s cubic-bezier(0.22,1,0.36,1)',
 }} />
 <div style={{
 position: 'absolute', top: '50%', right: 0, width: 14, height: 14,
 borderRadius: '50%', border: '1.5px solid #bbf7d0', background: '#fff',
 transform: 'translate(50%,-50%)',
 }} />
 </div>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
 <span style={{ fontSize: 12, color: '#6b6b6b' }}>0</span>
 <span style={{ fontSize: 12, color: '#6b6b6b' }}>{jobRefundTotal}</span>
 </div>
 <p style={{ fontSize: 13.5, color: '#4b5563', marginTop: 6 }}>
 <strong style={{ color: '#0f0f0f' }}>{jobRefundClaimed} of {jobRefundTotal}</strong> spots claimed so far
 </p>
 </div>

 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
 marginTop: 24, flexWrap: 'wrap' }}>
 <p style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>
 First come, first served. Once {jobRefundTotal} members claim it, it's gone for good.
 </p>
 <button onClick={goSignUp} style={{
 background: '#16a34a', color: '#fff', border: 'none', flexShrink: 0,
 padding: '13px 28px', borderRadius: 10, fontSize: 14.5, fontWeight: 700,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap',
 }}>
 Claim your spot →
 </button>
 </div>
 </div>
 </section>

 {/* ── COMPANIES OUR MEMBERS HAVE INTERVIEWED AT ───────────── */}
 <section style={{ background: '#fafafa', borderTop: '1px solid #f0f0f0',
 borderBottom: '1px solid #f0f0f0', padding: '56px 0', overflow: 'hidden' }}>
 <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
 color: '#9b9b9b', textTransform: 'uppercase', marginBottom: 36, padding: '0 24px' }}>
 Our members have interviewed at companies including
 </p>
 <div style={{ width: '100%', overflow: 'hidden' }}>
 <div className="inbox-marquee-track" style={{ display: 'flex', gap: 48, width: 'max-content',
 alignItems: 'center', animationDuration: '22s' }}>
 {[...COMPANY_LOGOS, ...COMPANY_LOGOS].map((logo, i) => (
 <img key={i} src={logo.src} alt={logo.name} style={{
 height: 34, flexShrink: 0, objectFit: 'contain', filter: 'grayscale(100%)',
 opacity: 0.75,
 }} />
 ))}
 </div>
 </div>
 </section>

 {/* ── STRAIGHT FROM THEIR INBOXES ──────────────────────── */}
 <section style={{ background: '#0f0f0f', padding: '88px 0', overflow: 'hidden' }}>
 <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 24px 48px', textAlign: 'center' }}>
 <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: '#22c55e',
 textTransform: 'uppercase', marginBottom: 14 }}>
 Straight from members' inboxes
 </p>
 <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontWeight: 400,
 fontSize: 'clamp(30px,5vw,44px)', color: '#fff', marginBottom: 16, letterSpacing: '-0.01em' }}>
 10+ real replies, not mockups
 </h2>
 <p style={{ fontSize: 15.5, color: '#a8a8a8', lineHeight: 1.6 }}>
 Screening-call invites, interview confirmations, recruiter replies. Every screenshot
 below came straight from a member's own inbox.
 </p>
 <p style={{ fontSize: 12.5, color: '#6b6b6b', marginTop: 10 }}>
 Hover over a screenshot to pause.
 </p>
 </div>

 <div style={{ width: '100%', overflow: 'hidden' }}>
 <div className="inbox-marquee-track" style={{ display: 'flex', gap: 20, width: 'max-content' }}>
 {[...INBOX_PROOFS, ...INBOX_PROOFS].map((src, i) => (
 <div key={i} style={{
 flexShrink: 0, width: 260, borderRadius: 18, overflow: 'hidden',
 border: '1px solid #262626', boxShadow: '0 20px 40px -20px rgba(0,0,0,0.7)',
 background: '#1a1a1a',
 }}>
 <img src={src} alt="Real recruiter email screenshot" style={{
 display: 'block', width: '100%', height: 400, objectFit: 'cover', objectPosition: 'top',
 }} />
 </div>
 ))}
 </div>
 </div>

 <div style={{ textAlign: 'center', marginTop: 48, padding: '0 24px' }}>
 <button onClick={goSignUp} style={{
 background: '#fff', color: '#0f0f0f', border: 'none',
 padding: '15px 36px', borderRadius: 12, fontSize: 15, fontWeight: 700,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>
 Get your own inbox proof →
 </button>
 </div>
 </section>

 {/* ── PRICING ───────────────────────────────────────────── */}
 <section id="pricing" style={{ background: '#fafafa', borderTop: '1px solid #f0f0f0', maxWidth: '100%', margin: 0, padding: '96px 24px' }}>
 <div style={{ maxWidth: 960, margin: '0 auto' }}>
 <p className="eyebrow-label" style={{ fontSize: 11, fontWeight: 700, color: '#b5b5b5',
 letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>
 FOUNDING MEMBER PRICING
 </p>
 <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 40,
 fontWeight: 400, textAlign: 'center', letterSpacing: '-0.025em',
 color: '#0f0f0f', marginBottom: 8 }}>
          One plan for how you want to job hunt.
 </h2>
 <p style={{ fontSize: 16, color: '#9b9b9b', textAlign: 'center', marginBottom: 56 }}>
          All plans run 30 days. Pick how much of the work you want off your plate.
 </p>

        <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, maxWidth: 1080, margin: '0 auto' }}>
 {[
            { label: 'Free', tagline: 'Get discovered. Apply yourself.', price: '₹0', sub: 'Up to 30 applications / month', highlight: false, popular: false, saving: null, color: '#6b7280' },
            { label: 'Basic', tagline: 'You apply. We surface the jobs.', price: '₹399', sub: 'Daily job feed for you', highlight: false, popular: false, saving: null, color: '#0f0f0f' },
            { label: 'Pro', tagline: 'We apply for you.', price: '₹1,999', sub: 'Admin applies + tracker', highlight: true, popular: true, saving: null, color: '#1d4ed8' },
            { label: 'Max Pro', tagline: 'We apply + get you interview-ready.', price: '₹2,999', sub: 'Interview prep + strategy call', highlight: false, popular: false, saving: null, color: '#7c3aed' },
 ].map(p => (
 <div key={p.label} className="pricing-card" onClick={() => setSelectedPlan({ label: p.label, price: p.price })} style={{
 background: p.highlight ? p.color : '#fff',
 border: selectedPlan?.label === p.label
 ? '2px solid #22c55e'
 : `2px solid ${p.highlight ? p.color : '#e8e8e8'}`,
 borderRadius: 16, padding: '28px 20px', position: 'relative', textAlign: 'center',
 boxShadow: selectedPlan?.label === p.label
 ? '0 0 0 4px rgba(34,197,94,0.15)'
 : p.highlight ? `0 16px 48px ${p.color}33` : '0 1px 4px rgba(0,0,0,0.04)',
 transform: p.highlight ? 'scale(1.04)' : 'none',
 cursor: 'pointer', transition: 'border 0.2s, box-shadow 0.2s',
 }}>
 {selectedPlan?.label === p.label && (
 <span style={{ position: 'absolute', top: -10, right: 12,
 width: 22, height: 22, borderRadius: '50%', background: '#22c55e',
 display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
 <polyline points="20 6 9 17 4 12" />
 </svg>
 </span>
 )}
 {p.popular && (
 <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
 fontSize: 11, fontWeight: 700, padding: '4px 12px',
 background: '#f59e0b', color: '#fff', borderRadius: 99, whiteSpace: 'nowrap' }}>
 MOST POPULAR
 </span>
 )}
 {p.saving && !p.popular && (
 <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
 fontSize: 11, fontWeight: 700, padding: '3px 10px',
 background: '#fef9c3', color: '#92400e', borderRadius: 99, whiteSpace: 'nowrap' }}>
 {p.saving}
 </span>
 )}
 <p className="price-label" style={{ fontSize: 13, fontWeight: 600, color: p.highlight ? '#fff' : '#0f0f0f', marginBottom: 6 }}>
 {p.label}
 </p>
 <p className="price-tagline" style={{ fontSize: 12, color: p.highlight ? 'rgba(255,255,255,0.7)' : '#9b9b9b', marginBottom: 14, lineHeight: 1.4, minHeight: 32 }}>
 {p.tagline}
 </p>
 <p className="price-amount" style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 32,
 color: p.highlight ? '#fff' : '#0f0f0f', marginBottom: 4 }}>{p.price}</p>
 <p className="price-sub" style={{ fontSize: 12, color: p.highlight ? 'rgba(255,255,255,0.5)' : '#b5b5b5', marginBottom: 20 }}>{p.sub}</p>
 <button onClick={(e) => { e.stopPropagation(); setSelectedPlan({ label: p.label, price: p.price }); goSignUp() }} style={{
 width: '100%', padding: '10px 0', borderRadius: 8,
 border: p.highlight ? '1px solid rgba(255,255,255,0.25)' : '1px solid #e8e8e8',
 background: p.highlight ? 'rgba(255,255,255,0.15)' : '#f5f5f5',
 color: p.highlight ? '#fff' : '#0f0f0f',
 fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>
 Get started →
 </button>
 </div>
 ))}
 </div>

 <p style={{ textAlign: 'center', fontSize: 13, color: '#b5b5b5', marginTop: 28 }}>
 Secured by Razorpay, UPI, Cards, Net banking, No auto-renewal
 </p>
 </div>
 </section>

 {/* ── FAQ ───────────────────────────────────────────────── */}
 <section style={{ background: '#fff', padding: '96px 24px' }}>
 <div style={{ maxWidth: 680, margin: '0 auto' }}>
 <p className="eyebrow-label" style={{ fontSize: 11, fontWeight: 700, color: '#b5b5b5',
 letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>
 FAQ
 </p>
 <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 40,
 fontWeight: 400, textAlign: 'center', letterSpacing: '-0.025em',
 color: '#0f0f0f', marginBottom: 52 }}>
 Every question you have.
 </h2>

 {FAQS.map((faq, i) => (
 <div key={i} style={{ borderBottom: '1px solid #ebebeb' }}>
 <button
 onClick={() => setOpenFaq(openFaq === i ? null : i)}
 style={{
 width: '100%', background: 'none', border: 'none', padding: '22px 0',
 display: 'flex', justifyContent: 'space-between', alignItems: 'center',
 cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter',sans-serif",
 }}>
 <span className="faq-question" style={{ fontSize: 16, fontWeight: 600, color: '#0f0f0f', paddingRight: 24 }}>
 {faq.q}
 </span>
 <span style={{ fontSize: 22, color: '#9b9b9b', flexShrink: 0,
 transform: openFaq === i ? 'rotate(45deg)' : 'none',
 transition: 'transform 0.2s', display: 'block' }}>+</span>
 </button>
 <div style={{
 display: 'grid',
 gridTemplateRows: openFaq === i ? '1fr' : '0fr',
 transition: 'grid-template-rows 0.3s ease',
 }}>
 <div style={{ overflow: 'hidden' }}>
 <p className="faq-answer" style={{ fontSize: 15, color: '#6b6b6b', lineHeight: 1.7,
 paddingBottom: 22, paddingRight: 32 }}>
 {faq.a}
 </p>
 </div>
 </div>
 </div>
 ))}

 <div style={{ textAlign: 'center', marginTop: 48 }}>
 <button onClick={goSignUp} style={{
 background: '#0f0f0f', color: '#fff', border: 'none',
 padding: '16px 40px', borderRadius: 12, fontSize: 15, fontWeight: 700,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif",
 }}>
 I'm ready. Count me in
 </button>
 </div>
 </div>
 </section>

 {/* ── FINAL CTA ─────────────────────────────────────────── */}
 <section style={{ background: '#0f0f0f', padding: '100px 24px', textAlign: 'center' }}>
 <p className="eyebrow-label" style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
 letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20 }}>
 YOUR MOVE
 </p>
 <h2 style={{ fontFamily: "'Instrument Serif',Georgia,serif",
 fontSize: 'clamp(36px,6vw,64px)', fontWeight: 400,
 color: '#fff', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 16 }}>
 Every day you wait<br />
 <span style={{ color: 'rgba(255,255,255,0.35)' }}>is a day someone else</span><br />
 gets the role you wanted.
 </h2>
 <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', marginBottom: 48, maxWidth: 480, margin: '0 auto 48px' }}>
 Free to start. Founding member pricing on paid plans, locked in before it moves to standard rates.
 </p>
 <button onClick={goSignUp} style={{
 background: '#fff', color: '#0f0f0f', border: 'none',
 padding: '20px 56px', borderRadius: 14, fontSize: 18, fontWeight: 800,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif", letterSpacing: '-0.02em',
 boxShadow: '0 8px 40px rgba(255,255,255,0.15)',
 }}>
 Start now, 4 min setup →
 </button>
 <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 18 }}>
 Setup in 4 min, Free to start, No auto-renewal, Cancel anytime
 </p>
 </section>

 {/* ── FOOTER ────────────────────────────────────────────── */}
 <footer style={{ background: '#0f0f0f', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '32px 24px' }}>
 <div style={{ maxWidth: 900, margin: '0 auto',
 display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.08)',
 display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <img src="/logo-mark.png" alt="ApplyMate" style={{ width: 20, height: 20, objectFit: 'contain' }} />
 </div>
 <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
 ApplyMate
 </span>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
 <a href="/about.html" className="footer-link" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>About</a>
 <a href="/contact.html" className="footer-link" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Contact</a>
 <a href="/terms.html" className="footer-link" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Terms</a>
 <a href="/privacy.html" className="footer-link" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Privacy</a>
 <a href="/refund-policy.html" className="footer-link" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Refund</a>
 <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>© 2026 All rights reserved</p>
 </div>
 </div>
 </footer>

 {/* ── STICKY CTA BAR ────────────────────────────────────── */}
 <div style={{
 position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
 background: '#0f0f0f', borderTop: '1px solid rgba(255,255,255,0.1)',
 padding: '14px 24px',
 display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
 transform: showSticky ? 'translateY(0)' : 'translateY(100%)',
 transition: 'transform 0.3s ease',
 boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
 display: 'block', boxShadow: '0 0 0 3px rgba(34,197,94,0.25)' }} />
 <span className="sticky-bar-text" style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>
 {selectedPlan ? (
 <><strong>{selectedPlan.label} selected.</strong> {selectedPlan.price}/mo</>
 ) : (
 <><strong>Free to start.</strong> Paid plans apply for you.</>
 )}
 </span>
 </div>
 <button onClick={goSignUp} style={{
 background: '#fff', color: '#0f0f0f', border: 'none',
 padding: '10px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700,
 cursor: 'pointer', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap',
 }}>
 {selectedPlan ? 'Continue →' : 'Get started →'}
 </button>
 </div>

 <style>{`
 @keyframes fadeInUp {
 from { opacity: 0; transform: translateY(10px); }
 to { opacity: 1; transform: translateY(0); }
 }
 @keyframes inboxMarquee {
 from { transform: translateX(0); }
 to { transform: translateX(-50%); }
 }
 .inbox-marquee-track { animation: inboxMarquee 38s linear infinite; }
 .inbox-marquee-track:hover { animation-play-state: paused; }
 @media (prefers-reduced-motion: reduce) {
 .inbox-marquee-track { animation: none; }
 }
 @media (max-width: 1024px) and (min-width: 769px) {
 .pricing-grid { grid-template-columns: repeat(2,1fr) !important; }
 }
 @media (max-width: 600px) {
 .nav-free-pill { display: none !important; }
 .nav-signin { display: none !important; }
 .nav-inner { padding: 0 16px !important; gap: 6px !important; }
 }
 @media (max-width: 640px) {
 .eyebrow-label { font-size: 12px !important; }
 .compare-title { font-size: 15px !important; }
 .compare-sub { font-size: 12.5px !important; }
 .compare-us-text { font-size: 14.5px !important; }
 .compare-them-text { font-size: 13.5px !important; }
 .trust-heading { font-size: 14px !important; }
 .trust-body { font-size: 14.5px !important; }
 .price-label { font-size: 14px !important; }
 .price-tagline { font-size: 13px !important; }
 .price-amount { font-size: 30px !important; }
 .price-sub { font-size: 12.5px !important; }
 .faq-question { font-size: 15px !important; }
 .faq-answer { font-size: 14.5px !important; }
 .footer-link { font-size: 13px !important; }
 .step-title { font-size: 20px !important; }
 .step-desc { font-size: 14.5px !important; }
 .activity-pill-text { font-size: 14.5px !important; }
 .sticky-bar-text { font-size: 13.5px !important; }
 }
 @media (max-width: 640px) {
 .steps-card, .pricing-card { animation: fadeInUp 0.5s ease both !important; }
 }
 @media (max-width: 640px) and (prefers-reduced-motion: no-preference) {
 @keyframes fadeInUpMobile {
 from { opacity: 0; transform: translateY(18px); }
 to { opacity: 1; transform: translateY(0); }
 }
 .steps-card { animation: fadeInUpMobile 0.55s ease both !important; }
 }
 @media (max-width: 768px) {
 .steps-progress-track, .steps-progress-fill { display: none !important; }
 .steps-grid {
 display: flex !important;
 overflow-x: auto !important;
 scroll-snap-type: x mandatory !important;
 -webkit-overflow-scrolling: touch !important;
 gap: 0 !important;
 border-radius: 16px !important;
 scrollbar-width: none !important;
 }
 .steps-grid::-webkit-scrollbar { display: none !important; }
 .steps-card {
 flex: 0 0 86vw !important;
 scroll-snap-align: center !important;
 }
 div[style*="repeat(3,1fr)"] { grid-template-columns: 1fr !important; }
 div[style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
 div[style*="gridTemplateColumns: '1fr 1fr'"] { grid-template-columns: 1fr !important; }

 .pricing-grid {
 display: flex !important;
 overflow-x: auto !important;
 scroll-snap-type: x mandatory !important;
 -webkit-overflow-scrolling: touch !important;
 gap: 14px !important;
 padding: 4px 24px 20px !important;
 margin: 0 -24px !important;
 max-width: 100vw !important;
 scrollbar-width: none !important;
 }
 .pricing-grid::-webkit-scrollbar { display: none !important; }
 .pricing-card {
 flex: 0 0 82vw !important;
 scroll-snap-align: center !important;
 transform: none !important;
 }
 }
 `}</style>
 </div>
 )
}
