import { createClient } from '@/lib/supabase/server'
import { ensureApplicant } from '@/app/actions/apply'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Most often: link expired, already used, or opened in a different
      // browser than the one that requested it (PKCE code verifier lives
      // in a cookie on the requesting browser only)
      return NextResponse.redirect(`${origin}/login?error=link_expired`)
    }

    // Applicant signup confirmation: AccountForm sets next=/apply/questionnaire
    // specifically for this flow. A session only becomes guaranteed to exist
    // here (not right after signUp()) when email confirmation is required —
    // this is the authoritative place to set role=applicant + create the
    // applications row, since AccountForm's own attempt runs before any
    // session exists in that case and silently can't do this work.
    if (next?.startsWith('/apply')) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const fullName = (user.user_metadata?.full_name as string | undefined) ?? ''
        await ensureApplicant(user.id, fullName)
      }
    }
  }

  // Only allow same-site relative redirects
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${target}`)
}
