import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for any Supabase session cookie (no network call)
  // Handle both non-chunked (sb-*-auth-token) and chunked (sb-*-auth-token.0, .1, ...) cookies
  const hasSession = request.cookies.getAll().some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')
  )

  const isAuthRoute = pathname.startsWith('/auth')

  // Redirect unauthenticated users to login
  if (!hasSession && !isAuthRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Redirect authenticated users away from login
  if (hasSession && pathname === '/auth/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
