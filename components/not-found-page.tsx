import { getDictionary, localizedPath, type Locale } from '@/lib/i18n'

/** The 404 body, used by both not-found.tsx files. A server component. */
export default function NotFoundPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  return (
    <main className="not-found">
      <img className="brand-mascot" src="/brand/mascot-480.webp" alt="" width={240} height={240} />
      <h1>{t.notFound.title}</h1>
      <p>{t.notFound.lede}</p>
      <a className="not-found-home" href={localizedPath(locale, '/')}>
        {t.notFound.home}
      </a>
    </main>
  )
}
