import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/env'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const routes = ['', '/workshop', '/en', '/en/workshop', '/privacy', '/terms', '/kvkk', '/cookies', '/contact']
  return routes.map((r) => ({ url: base + r, lastModified: new Date() }))
}
