import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the auth token. Do not remove: without it, server components
  // see an expired session and every page looks signed out.
  const { data } = await supabase.auth.getClaims()

  // Guard every route here rather than page by page. A client page that
  // fetches before checking sits on a loading state forever when signed
  // out, and each new page would have to remember its own guard.
  const path = request.nextUrl.pathname
  const isPublic =
    path === '/' || path.startsWith('/sign-in') || path.startsWith('/auth')

  if (!data && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    // Come back to where they were headed once they are signed in.
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  // Admin routes require admin role
  if (data && path.startsWith('/admin')) {
    const { data: roles } = await supabase
      .from('person_roles')
      .select('role')
      .eq('person_id', (await supabase.from('me').select('id').maybeSingle()).data?.id)

    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin')
    if (!isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  // Anything with a file extension is a static asset and must be excluded,
  // not just the _next ones. Without the extension clause every file under
  // public/ — including the vendored room and sky scripts — is answered
  // with a 307 to /sign-in, and the office silently never loads.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:js|css|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)',
  ],
}
