'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { getDictionary, localizedPath, type Locale } from '@/lib/i18n'

/**
 * Home page intro video (task 0027). The <video> is in the server HTML with
 * preload="none" and a poster, so nothing downloads until it is at least half
 * on screen. Reduced motion: never auto-plays, native controls are shown.
 */
export default function IntroVideo({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [soundOn, setSoundOn] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReduced(reduce)
    if (reduce) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            video.play().catch(() => {})
          } else {
            video.pause()
          }
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  function toggleSound() {
    const video = videoRef.current
    if (!video) return
    const next = !soundOn
    video.muted = !next
    setSoundOn(next)
    if (next && video.paused) video.play().catch(() => {})
  }

  return (
    <section className="intro-video" aria-labelledby="intro-video-title">
      <h2 id="intro-video-title">{t.introVideo.title}</h2>
      <div className="intro-video-media">
        <video
          ref={videoRef}
          className="intro-video-player"
          src="/videos/cartoon-intro.mp4"
          poster="/videos/cartoon-intro-poster.jpg"
          muted
          loop
          playsInline
          preload="none"
          width={720}
          height={1280}
          controls={reduced}
          aria-label={t.introVideo.videoLabel}
        />
        <button
          type="button"
          className={reduced ? 'intro-video-sound intro-video-sound-lifted' : 'intro-video-sound'}
          aria-label={soundOn ? t.introVideo.soundOff : t.introVideo.soundOn}
          onClick={toggleSound}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M3 9v6h4l5 4V5L7 9H3z" />
            {soundOn ? (
              <path d="M14.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2l1.4-1.4zM17.3 5.7a9 9 0 0 1 0 12.6l-1.4-1.4a7 7 0 0 0 0-9.8l1.4-1.4z" />
            ) : (
              <path d="M15.3 9.3l1.4-1.4 2.3 2.3 2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3-2.3-2.3z" />
            )}
          </svg>
        </button>
      </div>
      <p className="intro-video-lede">{t.introVideo.lede}</p>
      <ol className="intro-video-steps">
        <li>{t.introVideo.step1}</li>
        <li>{t.introVideo.step2}</li>
        <li>{t.introVideo.step3}</li>
      </ol>
      <Link className="intro-video-cta" href={localizedPath(locale, '/workshop')} prefetch={false}>
        {t.featured.cta}
      </Link>
    </section>
  )
}
