import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set(['https://applymate.in'])
function corsFor(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://applymate.in',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

// Fields the onboarding form knows how to prefill. Anything the model
// can't find in the resume comes back null/empty rather than guessed —
// better an empty field the user fills in than a wrong one they miss.
const EXTRACTION_PROMPT = `You are extracting structured data from a resume PDF to prefill a job-application onboarding form for an Indian job seeker.

Return ONLY a single JSON object — no markdown fences, no commentary — with exactly these keys:

{
  "role_suggestion": "student" | "professional",
  "first_name": string,
  "last_name": string,
  "mobile": string | null,
  "linkedin": string | null,
  "github": string | null,
  "address": string | null,
  "college": string | null,
  "degree": string | null,
  "branch": string | null,
  "current_year": string | null,
  "passout_year": string | null,
  "cgpa": string | null,
  "skills": string,
  "projects": string,
  "years_exp": string | null,
  "prev_title": string | null,
  "prev_company": string | null
}

Rules:
- "role_suggestion": "student" if currently enrolled or a recent graduate with no full-time role, "professional" if they have prior full-time work experience.
- "skills": comma-separated list of technical/tools skills found on the resume.
- "projects": 2-4 sentence plain-text summary of their most relevant projects, not a bullet list.
- "years_exp": total full-time professional experience, as a plain number string (e.g. "2"), or null if a student/fresher.
- Leave a field null (or "" for skills/projects) if it genuinely isn't findable in the resume — never invent a value.
- mobile numbers: return digits only, no country code prefix, no spaces.
- Output must be valid JSON and nothing else.`

serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { resume_path } = await req.json()
    if (!resume_path || typeof resume_path !== 'string') {
      return new Response(JSON.stringify({ error: 'resume_path is required' }), { status: 400, headers: cors })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token!)
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    // resume_path is always "{uid}/{filename}" — refuse to parse a file
    // that doesn't belong to the caller.
    if (!resume_path.startsWith(`${user.id}/`)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: cors })
    }

    // Rate limit: parsing calls the Anthropic API, which costs money per
    // call — cap retries so a stuck client can't rack up an unbounded bill.
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_identifier:    user.id,
      p_action:        'parse_resume',
      p_max_hits:      8,
      p_window_minutes: 60,
    })
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Please wait a bit and try again.' }), { status: 429, headers: cors })
    }

    const { data: fileBlob, error: dlErr } = await supabase.storage.from('resumes').download(resume_path)
    if (dlErr || !fileBlob) {
      return new Response(JSON.stringify({ error: 'Could not read the uploaded resume.' }), { status: 404, headers: cors })
    }
    if (fileBlob.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Resume too large to parse.' }), { status: 400, headers: cors })
    }

    const bytes = new Uint8Array(await fileBlob.arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'Resume parsing is not configured yet.' }), { status: 503, headers: cors })
    }

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        }],
      }),
    })

    if (!aiRes.ok) {
      const detail = await aiRes.text()
      console.error('Anthropic API error:', aiRes.status, detail)
      return new Response(JSON.stringify({ error: 'Could not parse resume right now. You can still fill the form manually.' }), { status: 502, headers: cors })
    }

    const aiData = await aiRes.json()
    const textBlock = (aiData.content ?? []).find((b: any) => b.type === 'text')
    const raw = (textBlock?.text ?? '').trim().replace(/^```json\s*|\s*```$/g, '')

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error('Could not parse model output as JSON:', raw.slice(0, 500))
      return new Response(JSON.stringify({ error: 'Could not read that resume clearly. You can still fill the form manually.' }), { status: 502, headers: cors })
    }

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('parse-resume error:', err)
    return new Response(JSON.stringify({ error: 'Something went wrong parsing your resume.' }), { status: 500, headers: cors })
  }
})
