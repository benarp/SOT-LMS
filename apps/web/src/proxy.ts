import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Public routes — no auth required
  const isPublicRoute =
    pathname === '/login' ||
    pathname.startsWith('/apply') ||
    pathname.startsWith('/reference')

  // Redirect unauthenticated users to login (except public routes)
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // Fetch role to determine where to send the user
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role

    // Applicants can only access /apply/* — redirect everything else
    if (role === 'applicant') {
      if (!pathname.startsWith('/apply') && !pathname.startsWith('/reference')) {
        return NextResponse.redirect(new URL('/apply/status', request.url))
      }
      return supabaseResponse
    }

    // Redirect authenticated non-applicants away from login
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Redirect authenticated non-applicants away from /apply (they're already enrolled)
    if (pathname.startsWith('/apply')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Redirect root to dashboard
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
