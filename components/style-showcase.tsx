import Link from 'next/link'
import { format, getDictionary, groupLabel, localizedPath, styleText, type Locale } from '@/lib/i18n'
import { displayGroups, isDefaultStyle } from '@/lib/style-display'

/**
 * Every style on the landing, under its group heading: preview, name and
 * description. Server component; the previews are the 480 px copies under
 * public/styles-web/ (task 0010 section 5), all lazy because the hero, not
 * this section, is above the fold.
 */
export default function StyleShowcase({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  const groups = displayGroups()
  const workshop = localizedPath(locale, '/workshop')

  return (
    <section className="style-showcase" id="styles">
      <h2>{t.showcase.title}</h2>
      <p className="showcase-lede">{t.showcase.lede}</p>

      {groups.map((group) => (
        <div key={group.id} className="showcase-group" data-style-group={group.id}>
          <h3>{groupLabel(group.id, locale)}</h3>
          <ul className="showcase-grid">
            {group.styles.map((style) => {
              const text = styleText(style, locale)
              return (
                <li key={style.id} className="showcase-item">
                  <Link className="showcase-link" href={workshop + '?style=' + style.id}>
                    <img
                      src={'/styles-web/' + style.id + '.webp'}
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
      ))}
    </section>
  )
}
