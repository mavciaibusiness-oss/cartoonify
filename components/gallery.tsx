import { getCartoonStyle } from '@/lib/cartoon-styles'
import { GALLERY, GALLERY_WEB_SIZE, galleryImagePath } from '@/lib/gallery'
import { format, getDictionary, styleText, type Locale } from '@/lib/i18n'

/**
 * The landing gallery: each AI-generated source beside its three renders.
 *
 * Every image is a static file under public/gallery/, made once by
 * scripts/render-gallery.mjs. A server component that fetches nothing: nothing here calls
 * the provider or does any work per request (task 0009 criterion 8). The images
 * are lazy because the hero, not the gallery, is above the fold.
 */
export default function Gallery({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).gallery

  return (
    <section className="landing-gallery">
      <h2>{t.title}</h2>
      <p className="gallery-lede">{t.lede}</p>
      <p className="gallery-note">{t.sourceNote}</p>

      <div className="gallery-rows">
        {GALLERY.map((entry) => {
          const sourceAlt = t.alt[entry.id]
          return (
            <div key={entry.id} className="gallery-row" data-gallery-source={entry.id}>
              <figure className="gallery-source">
                <img
                  src={galleryImagePath(entry.id)}
                  alt={sourceAlt}
                  width={GALLERY_WEB_SIZE}
                  height={GALLERY_WEB_SIZE}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>{t.sourceCaption}</figcaption>
              </figure>
              {entry.styles.map((id) => {
                const name = styleText(getCartoonStyle(id), locale).name
                return (
                  <figure key={id}>
                    <img
                      src={galleryImagePath(entry.id, id)}
                      alt={format(t.renderAlt, { source: sourceAlt, style: name })}
                      width={GALLERY_WEB_SIZE}
                      height={GALLERY_WEB_SIZE}
                      loading="lazy"
                      decoding="async"
                    />
                    <figcaption>{name}</figcaption>
                  </figure>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}
