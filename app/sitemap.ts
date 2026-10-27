import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/env'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const routes = [
    '',
    '/workshop',
    '/privacy',
    '/terms',
    '/refund',
    '/cookies',
    '/contact',
    '/tr',
    '/tr/workshop',
    '/tr/privacy',
    '/tr/terms',
    '/tr/refund',
    '/tr/cookies',
    '/tr/kvkk',
    '/tr/contact',
  ]
  return routes.map((r) => ({ url: base + r, lastModified: new Date() }))
}
