import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip middleware for static assets and internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check for any Supabase session cookie (no network call)
  const hasSession = request.cookies.getAll().some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  )

  const isAuthRoute = pathname.startsWith('/auth')

  // Redirect unauthenticated users to login
  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login (but not callback)
  if (hasSession && pathname === '/auth/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
