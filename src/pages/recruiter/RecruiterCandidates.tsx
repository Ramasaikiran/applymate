import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type CandidateCard } from '../../lib/supabase'
import { RecruiterShell, Chip, ErrorBox, card, inp, lbl, btnDark, FONT } from './ui'

const PAGE = 20

export default function RecruiterCandidates() {
  const [query, setQuery] = useState('')
  const [skills, setSkills] = useState('')
  const [minExp, setMinExp] = useState('')
  const [passout, setPassout] = useState('')
  const [rows, setRows] = useState<CandidateCard[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(offset: number) {
    setLoading(true); setError(null)
    const { data, error: err } = await supabase.rpc('recruiter_search_candidates', {
      p_query: query.trim() || null,
      p_skills: skills.split(',').map(s => s.trim()).filter(Boolean),
      p_min_exp: minExp ? Number(minExp) : null,
      p_passout: passout ? parseInt(passout) : null,
      p_limit: PAGE, p_offset: offset,
    })
    setLoading(false); setSearched(true)
    if (err) { setError('Could not load candidates. Please try again.'); return }
    const list = (data ?? []) as CandidateCard[]
    setRows(prev => offset === 0 ? list : [...prev, ...list])
    setMore(list.length === PAGE)
  }

  useEffect(() => { run(0) /* initial list */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit(e: FormEvent) { e.preventDefault(); run(0) }

  return (
    <RecruiterShell>
      <h1 style={{ fontFamily: "'Instrument Serif',Georgia,serif", fontSize: 30, fontWeight: 400, margin: '0 0 6px' }}>Find candidates</h1>
      <p style={{ fontSize: 13.5, color: '#6b6b6b', margin: '0 0 20px', lineHeight: 1.6 }}>
        All paid ApplyMate members appear here. Search by name, college, role or skill, then filter. Opening a profile shows contact details and notifies the candidate.
      </p>

      <form onSubmit={submit} style={{ ...card, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', alignItems: 'end', marginBottom: 20 }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Search</label>
          <input style={inp} value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, college, role, company or skill" /></div>
        <div><label style={lbl}>Skills (comma separated)</label>
          <input style={inp} value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, Java, SQL" /></div>
        <div><label style={lbl}>Min. experience (years)</label>
          <input style={inp} type="number" min="0" step="0.5" value={minExp} onChange={e => setMinExp(e.target.value)} /></div>
        <div><label style={lbl}>Graduation year</label>
          <input style={inp} type="number" min="2000" max="2100" value={passout} onChange={e => setPassout(e.target.value)} placeholder="2026" /></div>
        <button type="submit" disabled={loading} style={{ ...btnDark(loading), height: 46 }}>{loading ? 'Searching…' : 'Search'}</button>
      </form>

      {error && <ErrorBox>{error}</ErrorBox>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(c => (
          <Link key={c.candidate_id} to={`/recruiter/candidates/${c.candidate_id}`}
            style={{ ...card, textDecoration: 'none', color: 'inherit', display: 'block', fontFamily: FONT }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 3px' }}>{c.first_name || 'Candidate'}</p>
                <p style={{ fontSize: 12.5, color: '#9b9b9b', margin: 0 }}>
                  {c.user_type === 'professional'
                    ? [c.previous_job_title, c.years_experience != null ? `${c.years_experience} yrs exp` : null].filter(Boolean).join(' · ')
                    : [c.college_name, c.branch, c.passout_year ? `Class of ${c.passout_year}` : null, c.cgpa != null ? `CGPA ${c.cgpa}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f0f0f' }}>View profile →</span>
            </div>
            {!!c.technical_skills?.length && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {c.technical_skills.slice(0, 10).map(s => <Chip key={s}>{s}</Chip>)}
              </div>
            )}
          </Link>
        ))}
      </div>

      {searched && !loading && rows.length === 0 && !error && (
        <p style={{ textAlign: 'center', color: '#9b9b9b', fontSize: 14, padding: '40px 0' }}>
          No paid candidates match. Try fewer filters.
        </p>
      )}
      {more && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => run(rows.length)} disabled={loading} style={btnDark(loading)}>Load more</button>
        </div>
      )}
    </RecruiterShell>
  )
}
