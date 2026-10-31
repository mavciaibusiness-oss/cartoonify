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
      <div className="intro-video-body">
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
        <div className="intro-video-actions">
          <button
            type="button"
            className="intro-video-sound"
            aria-label={soundOn ? t.introVideo.soundOff : t.introVideo.soundOn}
            onClick={toggleSound}
          >
            {soundOn ? t.introVideo.soundOff : t.introVideo.soundOn}
          </button>
          <Link className="intro-video-cta" href={localizedPath(locale, '/workshop')} prefetch={false}>
            {t.featured.cta}
          </Link>
        </div>
      </div>
    </section>
  )
}
