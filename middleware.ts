import { NextResponse, type NextRequest } from 'next/server'
import { siteUrl } from '@/lib/env'

// Every path except Next's own static assets and the favicon.
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }

const WEBHOOKS = ['/api/stripe/webhook', '/api/polar/webhook']

function hostOf(value: string): string {
  const first = value.split(',')[0].trim().toLowerCase()
  return first.split(':')[0]
}

/**
 * On the live deployment only, any *.vercel.app address answers 308 to the
 * canonical site with path and query kept. Webhook paths are never redirected
 * (Stripe does not follow redirects). If the configured site is itself a
 * vercel.app address, nothing is redirected (loop guard).
 *
 * Then: old English addresses (/en/...) answer 301 to the same address without
 * /en, query kept. The KVKK page keeps its file path, so /kvkk answers 301 to
 * /tr/kvkk and /tr/kvkk is served from that file by an internal rewrite.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (process.env.VERCEL_ENV === 'production' && WEBHOOKS.indexOf(pathname) < 0) {
    const host = hostOf(request.headers.get('host') ?? '')
    if (host.endsWith('.vercel.app')) {
      const site = new URL(siteUrl())
      if (!site.hostname.endsWith('.vercel.app') && site.hostname !== host) {
        return NextResponse.redirect(site.origin + pathname + search, 308)
      }
    }
  }

  if (pathname === '/tr/kvkk') return NextResponse.rewrite(new URL('/kvkk' + search, request.url))
  if (pathname === '/kvkk') return NextResponse.redirect(new URL('/tr/kvkk' + search, request.url), 301)
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname === '/en' ? '/' : pathname.slice(3)
    return NextResponse.redirect(new URL(rest + search, request.url), 301)
  }
  return NextResponse.next()
}
