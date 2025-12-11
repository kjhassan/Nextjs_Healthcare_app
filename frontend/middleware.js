import { NextResponse } from 'next/server'

export async function middleware(request) {
  const token = request.cookies.get('token')
  const { pathname } = request.nextUrl

  // Protect /patient and /doctor routes: redirect to home if no token
  if ((pathname.startsWith('/patient') || pathname.startsWith('/doctor')) && !token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/patient/:path*', '/doctor/:path*'],
}
