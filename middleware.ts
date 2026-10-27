import { NextResponse, type NextRequest } from 'next/server'

export const config = { matcher: ['/en', '/en/:path*', '/kvkk', '/tr/kvkk'] }

/**
 * Old English addresses (/en/...) answer 301 to the same address without /en,
 * query kept. The KVKK page keeps its file path, so /kvkk answers 301 to
 * /tr/kvkk and /tr/kvkk is served from that file by an internal rewrite.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (pathname === '/tr/kvkk') return NextResponse.rewrite(new URL('/kvkk' + search, request.url))
  if (pathname === '/kvkk') return NextResponse.redirect(new URL('/tr/kvkk' + search, request.url), 301)
  const rest = pathname === '/en' ? '/' : pathname.slice(3)
  return NextResponse.redirect(new URL(rest + search, request.url), 301)
}
