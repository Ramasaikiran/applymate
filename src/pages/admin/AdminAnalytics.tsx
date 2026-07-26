import { useEffect, useState } from 'react'
import { supabase, type JobApplication } from '../../lib/supabase'
import AdminNav from './AdminNav'

const INTERVIEW_STATUSES = ['interview', 'hr_round']
const OFFER_STATUSES     = ['offer', 'joined', 'hired']

export default function AdminAnalytics() {
  const [apps,    setApps]    = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setLoadErr(null)
    const { data, error } = await supabase.from('job_applications').select('*')
    if (error) { console.error('Analytics load error:', error); setLoadErr(error.message) }
    setApps((data as JobApplication[]) ?? [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
      <AdminNav title="Analytics" />
      <div style={{ textAlign: 'center', padding: '80px 0', fontSize: 14, color: '#b5b5b5' }}>Loading…</div>
    </div>
  )

  const total = apps.length
  const interviews = apps.filter(a => INTERVIEW_STATUSES.includes(a.status) || OFFER_STATUSES.includes(a.status)).length
  const offers      = apps.filter(a => OFFER_STATUSES.includes(a.status)).length
  const interviewRate = total ? Math.round((interviews / total) * 100) : 0
  const offerRate      = interviews ? Math.round((offers / interviews) * 100) : 0

  // Per-day, last 14 days
  const days: { label: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0)
    const next = new Date(d); next.setDate(d.getDate() + 1)
    const count = apps.filter(a => {
      const t = new Date(a.applied_at).getTime()
      return t >= d.getTime() && t < next.getTime()
    }).length
    days.push({ label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), count })
  }
  const maxDay = Math.max(1, ...days.map(d => d.count))

  // Per-week, last 8 weeks
  const weeks: { label: string; count: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const end = new Date(); end.setDate(end.getDate() - i * 7)
    const start = new Date(end); start.setDate(end.getDate() - 7)
    const count = apps.filter(a => {
      const t = new Date(a.applied_at).getTime()
      return t >= start.getTime() && t < end.getTime()
    }).length
    weeks.push({ label: `${start.getDate()}/${start.getMonth()+1}`, count })
  }
  const maxWeek = Math.max(1, ...weeks.map(w => w.count))

  // Per-month, last 6 months
  const months: { label: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i, 1); d.setHours(0,0,0,0)
    const next = new Date(d); next.setMonth(d.getMonth() + 1)
    const count = apps.filter(a => {
      const t = new Date(a.applied_at).getTime()
      return t >= d.getTime() && t < next.getTime()
    }).length
    months.push({ label: d.toLocaleDateString('en-IN', { month: 'short' }), count })
  }
  const maxMonth = Math.max(1, ...months.map(m => m.count))

  // Top companies / roles
  const companyCounts = new Map<string, number>()
  const roleCounts = new Map<string, number>()
  apps.forEach(a => {
    if (a.company) companyCounts.set(a.company, (companyCounts.get(a.company) ?? 0) + 1)
    if (a.job_title) roleCounts.set(a.job_title, (roleCounts.get(a.job_title) ?? 0) + 1)
  })
  const topCompanies = [...companyCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 8)
  const topRoles      = [...roleCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 8)

  const Bar = ({ data, max }: { data: { label: string; count: number }[]; max: number }) => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div title={`${d.label}: ${d.count}`} style={{
            width: '100%', maxWidth: 28, borderRadius: '4px 4px 0 0',
            background: d.count ? '#0f0f0f' : '#eee',
            height: `${Math.max(4, (d.count / max) * 84)}px`,
          }} />
          <span style={{ fontSize: 9, color: '#b5b5b5', whiteSpace: 'nowrap' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background: '#fff', border: '1.5px solid #f0f0f0', borderRadius: 16, padding: '20px 22px' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#6b6b6b', marginBottom: 14 }}>{title}</p>
      {children}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter',sans-serif" }}>
      <AdminNav title="Analytics" />

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '36px 24px' }}>
        <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 28, fontWeight: 400,
          color: '#0f0f0f', marginBottom: 24 }}>Analytics</h1>

        {loadErr && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
            Couldn't load analytics: {loadErr}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { v: total,            l: 'Total applications', c: '#0f0f0f' },
            { v: `${interviewRate}%`, l: 'Interview conversion', c: '#d97706' },
            { v: `${offerRate}%`,    l: 'Offer conversion',     c: '#16a34a' },
            { v: offers,            l: 'Total offers',        c: '#16a34a' },
          ].map(({ v, l, c }) => (
            <div key={l} style={{ background: '#fff', border: '1.5px solid #f0f0f0', borderRadius: 16, padding: '20px 22px' }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: c }}>{v}</span>
              <p style={{ fontSize: 13, color: '#9b9b9b', marginTop: 4 }}>{l}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card title="Applications, last 14 days"><Bar data={days} max={maxDay} /></Card>
          <Card title="Applications, last 8 weeks"><Bar data={weeks} max={maxWeek} /></Card>
          <Card title="Applications, last 6 months"><Bar data={months} max={maxMonth} /></Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Most applied companies">
            {topCompanies.length === 0 ? <p style={{ fontSize: 13, color: '#b5b5b5' }}>No data yet.</p> :
              topCompanies.map(([name, count]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0',
                  borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                  <span style={{ color: '#0f0f0f' }}>{name}</span>
                  <span style={{ color: '#9b9b9b', fontWeight: 600 }}>{count}</span>
                </div>
              ))}
          </Card>
          <Card title="Most popular roles">
            {topRoles.length === 0 ? <p style={{ fontSize: 13, color: '#b5b5b5' }}>No data yet.</p> :
              topRoles.map(([name, count]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0',
                  borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                  <span style={{ color: '#0f0f0f' }}>{name}</span>
                  <span style={{ color: '#9b9b9b', fontWeight: 600 }}>{count}</span>
                </div>
              ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
