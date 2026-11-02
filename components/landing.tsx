import { getDictionary, type Locale } from '@/lib/i18n'
import FeaturedStyle from './featured-style'
import Gallery from './gallery'
import IntroVideo from './intro-video'
import KvkkNotice from './kvkk-notice'
import StyleShowcase from './style-showcase'
import UploadControl from './upload-control'

/**
 * The landing body, shared by / and /tr.
 *
 * Task 0033: the hero is video-led. DOM order is the mobile order: mascot,
 * video, disclosure, H1, sentence, upload box, step strip. From 900px the
 * video and its notice sit in the left column and the copy in the right one;
 * no CSS reorders anything.
 */
export default function Landing({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)

  return (
    <main className="landing">
      <section className="landing-hero">
        <img className="brand-mascot" src="/brand/mascot-480.webp" alt="" width={240} height={240} loading="eager" />

        <div className="hero-media">
          <IntroVideo locale={locale} />
          <KvkkNotice locale={locale} />
        </div>

        <div className="hero-copy">
          <h1>{t.landing.title}</h1>
          <p className="hero-lede">{t.introVideo.lede}</p>

          <UploadControl locale={locale} />

          <ol className="hero-steps">
            <li>{t.introVideo.step1}</li>
            <li>{t.introVideo.step2}</li>
            <li>{t.introVideo.step3}</li>
          </ol>
        </div>
      </section>

      <FeaturedStyle locale={locale} />

      <Gallery locale={locale} />

      <StyleShowcase locale={locale} />

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
