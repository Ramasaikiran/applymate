import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://applymate.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Deletes a user's auth.users row (service-role only — cannot be done from
// the browser). profiles/student_details/professional_details/subscriptions/
// job_applications/saved_jobs all have `on delete cascade` FKs to auth.users
// or profiles, so this also removes their app data. Called by the admin
// dashboard after a profile_deletion_requests row has been approved via
// admin_resolve_deletion_request (which only deletes the `profiles` row —
// this function finishes the job by removing the login/email record itself
// so the person's email is free to sign up again).
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user_id, deletion_request_id } = await req.json()
    if (!user_id || !deletion_request_id) {
      return new Response(JSON.stringify({ error: 'user_id and deletion_request_id are required' }), { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Caller must be an authenticated admin.
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token!)
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const { data: callerProfile } = await supabase.from('profiles').select('is_admin').eq('id', caller.id).single()
    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    // Only proceed if there's an approved deletion request for this user,
    // so this endpoint can't be used to delete arbitrary accounts.
    const { data: reqRow } = await supabase.from('profile_deletion_requests')
      .select('user_id,status').eq('id', deletion_request_id).single()
    if (!reqRow || reqRow.user_id !== user_id || reqRow.status !== 'approved') {
      return new Response(JSON.stringify({ error: 'No approved deletion request found for this user' }),
        { status: 400, headers: corsHeaders })
    }

    const { error: delErr } = await supabase.auth.admin.deleteUser(user_id)
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
