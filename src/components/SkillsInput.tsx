import { useState, type CSSProperties } from 'react'
import { SKILL_SUGGESTIONS, POPULAR_SKILLS, MAX_SKILLS, addSkills } from '../lib/skills'

const FONT = "'Inter',-apple-system,sans-serif"

export default function SkillsInput({ value, onChange, error }: {
  value: string[]; onChange: (v: string[]) => void; error?: string
}) {
  const [text, setText] = useState('')

  const q = text.trim().toLowerCase()
  const have = new Set(value.map(s => s.toLowerCase()))
  const matches = q
    ? SKILL_SUGGESTIONS.filter(s => s.toLowerCase().includes(q) && !have.has(s.toLowerCase())).slice(0, 6)
    : []
  const popular = POPULAR_SKILLS.filter(s => !have.has(s.toLowerCase()))

  function commit(v: string) { onChange(addSkills(value, v)); setText('') }

  const chip: CSSProperties = { padding: '6px 12px', borderRadius: 99, fontSize: 13, fontFamily: FONT, cursor: 'pointer', border: 'none' }

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {value.map(s => (
            <span key={s} style={{ ...chip, background: '#0f0f0f', color: '#fff', cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {s}
              <button type="button" aria-label={`Remove ${s}`} onClick={() => onChange(value.filter(x => x !== s))}
                style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (text.trim()) commit(text) } }}
        onBlur={() => { if (text.trim()) commit(text) }}
        disabled={value.length >= MAX_SKILLS}
        placeholder={value.length >= MAX_SKILLS ? `Maximum ${MAX_SKILLS} skills` : 'Type a skill and press Enter'}
        style={{ width: '100%', height: 48, padding: '0 14px', fontSize: 14, fontFamily: FONT, borderRadius: 10, boxSizing: 'border-box',
          border: `1.5px solid ${error ? '#ef4444' : '#e5e5e5'}`, outline: 'none', background: '#fff', color: '#0f0f0f' }} />
      {matches.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {matches.map(s => <button key={s} type="button" onMouseDown={e => e.preventDefault()} onClick={() => commit(s)}
            style={{ ...chip, background: '#f5f5f5', color: '#0f0f0f' }}>+ {s}</button>)}
        </div>
      )}
      {!q && popular.length > 0 && value.length < 5 && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11.5, color: '#9b9b9b', margin: '0 0 6px' }}>Popular</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {popular.map(s => <button key={s} type="button" onClick={() => commit(s)}
              style={{ ...chip, background: '#f5f5f5', color: '#4b4b4b' }}>+ {s}</button>)}
          </div>
        </div>
      )}
      {error && <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444' }}>{error}</p>}
    </div>
  )
}
