import { DEFAULT_CARTOON_STYLE_ID, getCartoonStyle, STYLE_GROUPS } from '@/lib/cartoon-styles'
import { format, getDictionary, groupLabel, styleText, type Locale } from '@/lib/i18n'

/**
 * Every style on the landing, under its group heading: preview, name and
 * description. Server component; the previews are the 480 px copies under
 * public/styles-web/ (task 0010 section 5), all lazy because the hero, not
 * this section, is above the fold.
 */
export default function StyleShowcase({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  const groups = [
    { id: 'default', label: t.form.defaultGroup, count: null, styles: [getCartoonStyle(DEFAULT_CARTOON_STYLE_ID)] },
    ...STYLE_GROUPS.map((group) => ({
      id: group.id,
      label: groupLabel(group.id, locale),
      count: group.styles.length,
      styles: group.styles,
    })),
  ]

  return (
    <section className="style-showcase">
      <h2>{t.showcase.title}</h2>
      <p className="showcase-lede">{t.showcase.lede}</p>

      {groups.map((group) => (
        <div key={group.id} className="showcase-group" data-style-group={group.id}>
          <h3>
            {group.label}
            {group.count !== null ? (
              <span className="showcase-count">{format(t.landing.groupCount, { n: group.count })}</span>
            ) : null}
          </h3>
          <ul className="showcase-grid">
            {group.styles.map((style) => {
              const text = styleText(style, locale)
              return (
                <li key={style.id} className="showcase-item">
                  <img
                    src={'/styles-web/' + style.id + '.webp'}
                    alt={format(t.styleCard.previewAlt, { name: text.name })}
                    width={480}
                    height={480}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="showcase-name">{text.name}</span>
                  <span className="showcase-description">{text.description}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
