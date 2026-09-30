import Link from 'next/link'
import { CARTOON_STYLES } from '@/lib/cartoon-styles'
import { format, getDictionary, localizedPath, styleText, type Locale } from '@/lib/i18n'
import { isDefaultStyle } from '@/lib/style-display'
import { stylePreviewPath } from '@/lib/style-previews'
import { activeCategories } from '@/lib/style-query'

/** Sample cards per category; the largest N that keeps the page in budget (task 0016 section 3.2). */
const SAMPLES_PER_CATEGORY = 2

/**
 * Sample styles by category on the landing: the first few of each category,
 * each with preview, name and description. The category heading opens the
 * picker filtered to it. Server component; the previews are the small copies
 * from stylePreviewPath, all lazy because the hero, not this section, is above
 * the fold.
 */
export default function StyleShowcase({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  const workshop = localizedPath(locale, '/workshop')

  return (
    <section className="style-showcase" id="styles">
      <h2>{t.showcase.title}</h2>
      <p className="showcase-lede">{t.showcase.lede}</p>

      <div className="showcase-categories">
        {activeCategories().map((id) => {
          const samples = CARTOON_STYLES.filter((style) => style.category === id).slice(0, SAMPLES_PER_CATEGORY)
          return (
            <div key={id} className="showcase-category" data-category={id}>
              <h3>
                <Link href={workshop + '?category=' + id} prefetch={false}>
                  {t.styleCategories[id]}
                </Link>
              </h3>
              <ul className="showcase-grid">
                {samples.map((style) => {
                  const text = styleText(style, locale)
                  return (
                    <li key={style.id} className="showcase-item">
                      <Link className="showcase-link" href={workshop + '?style=' + style.id} prefetch={false}>
                        <img
                          src={stylePreviewPath(style.id)}
                          alt={format(t.styleCard.previewAlt, { name: text.name })}
                          width={480}
                          height={480}
                          loading="lazy"
                          decoding="async"
                        />
                        {isDefaultStyle(style.id) ? <span className="style-default-badge">{t.form.defaultGroup}</span> : null}
                        <span className="showcase-name">{text.name}</span>
                        <span className="showcase-description">{text.description}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
