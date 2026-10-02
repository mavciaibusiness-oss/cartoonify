import Link from 'next/link'
import { getDictionary, localizedPath, type Locale } from '@/lib/i18n'
import { galleryImagePath } from '@/lib/gallery'
import { stylePreviewPath } from '@/lib/style-previews'

/** Task 0019: the style the landing features under the hero. */
export const FEATURED_STYLE_ID = 'goofy-sketch'

/**
 * The featured-style band (task 0019): the gallery's group photo and its render
 * in the featured style, then a link to the workshop with that style selected. Both
 * images are web-size and lazy, so the band adds little to the first load.
 */
export default function FeaturedStyle({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  const workshop = localizedPath(locale, '/workshop')

  return (
    <section className="featured-style" data-style={FEATURED_STYLE_ID} aria-labelledby="featured-style-title">
      <p className="workshop-badge">{t.featured.badge}</p>
      <h2 id="featured-style-title">{t.featured.title}</h2>
      <p className="featured-lede">{t.featured.lede}</p>
      <div className="featured-pair">
        <figure>
          <img src={galleryImagePath('friends')} alt={t.featured.beforeAlt} width={480} height={480} loading="lazy" />
          <figcaption>{t.featured.beforeCaption}</figcaption>
        </figure>
        <figure>
          <img src={stylePreviewPath(FEATURED_STYLE_ID, 'web')} alt={t.featured.afterAlt} width={480} height={480} loading="lazy" />
          <figcaption>{t.featured.afterCaption}</figcaption>
        </figure>
      </div>
      <Link className="featured-cta" href={workshop + '?style=' + FEATURED_STYLE_ID} prefetch={false}>
        {t.featured.cta}
      </Link>
    </section>
  )
}
