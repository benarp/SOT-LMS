import { createClient } from '@/lib/supabase/server'
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
  }

  // Only allow same-site relative redirects
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${target}`)
}
