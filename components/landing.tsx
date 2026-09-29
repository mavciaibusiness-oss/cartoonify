import { STYLE_GROUPS } from '@/lib/cartoon-styles'
import { format, getDictionary, groupLabel, type Locale } from '@/lib/i18n'
import KvkkNotice from './kvkk-notice'
import UploadControl from './upload-control'

/**
 * The landing body, shared by / and /en.
 *
 * The before/after pair is true: the left image is the source portrait itself,
 * the exact bytes sent to the provider, and the right image is its classic
 * render at the model a visitor's request uses (task 0008). It sits above the
 * disclosure and the upload control, so the disclosure still comes before any
 * file input.
 */
export default function Landing({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)

  return (
    <main className="landing">
      <section className="landing-hero">
        <p className="workshop-badge">{t.landing.badge}</p>
        <h1>{t.landing.title}</h1>
        <p className="hero-lede">{t.landing.lede}</p>

        <div className="hero-pair">
          <figure>
            <img src="/hero/before.jpg" alt={t.landing.heroBeforeAlt} width={1024} height={1024} />
            <figcaption>{t.landing.heroBeforeCaption}</figcaption>
          </figure>
          <figure>
            <img src="/styles/classic.webp" alt={t.landing.heroAfterAlt} width={1024} height={1024} />
            <figcaption>{t.landing.heroAfterCaption}</figcaption>
          </figure>
        </div>

        <KvkkNotice locale={locale} />

        <UploadControl locale={locale} />
      </section>

      <section className="group-intro">
        <h2>{t.landing.groupsTitle}</h2>
        <p>{t.landing.groupsLede}</p>
        <ul className="group-preview">
          {STYLE_GROUPS.map((group) => (
            <li key={group.id} data-style-group={group.id}>
              <span className="group-preview-name">{groupLabel(group.id, locale)}</span>
              <span className="group-preview-count">{format(t.landing.groupCount, { n: group.styles.length })}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="how-it-works">
        <h2>{t.landing.howTitle}</h2>
        <ol className="how-steps">
          <li>{t.landing.step1}</li>
          <li>{t.landing.step2}</li>
          <li>{t.landing.step3}</li>
        </ol>
      </section>
    </main>
  )
}
