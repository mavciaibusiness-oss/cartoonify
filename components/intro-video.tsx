'use client'

import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { getDictionary, type Locale } from '@/lib/i18n'

/**
 * Home page hero video (tasks 0027, 0033). The <video> is in the server HTML with
 * preload="none" and a poster, so nothing downloads until it is at least half
 * on screen. Reduced motion: never auto-plays, one centred play button starts it and a click on the
 * video pauses it. No native controls in either mode.
 */
export default function IntroVideo({ locale }: { locale: Locale }) {
  const t = getDictionary(locale)
  ReactDOM.preload('/videos/cartoon-intro-poster.webp', { as: 'image', fetchPriority: 'high' })
  const videoRef = useRef<HTMLVideoElement>(null)
  const [soundOn, setSoundOn] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReduced(reduce)
    if (reduce) return
    let observer: IntersectionObserver | null = null
    const start = () => {
      observer = new IntersectionObserver(
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
    }
    // Task 0033: watch only after the window load event, so the first load
    // fetches the poster and the mp4 starts right after it.
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      window.removeEventListener('load', start)
      if (observer) observer.disconnect()
    }
  }, [])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }

  function toggleSound() {
    const video = videoRef.current
    if (!video) return
    const next = !soundOn
    video.muted = !next
    setSoundOn(next)
    if (next && video.paused) video.play().catch(() => {})
  }

  return (
    <div className="intro-video-media">
        <video
          ref={videoRef}
          className="intro-video-player"
          src="/videos/cartoon-intro.mp4"
          poster="/videos/cartoon-intro-poster.webp"
          muted
          loop
          playsInline
          preload="none"
          width={720}
          height={1280}
          aria-label={t.introVideo.videoLabel}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={reduced ? togglePlay : undefined}
        />
        {reduced && !playing ? (
          <button type="button" className="intro-video-play" aria-label={t.introVideo.play} onClick={togglePlay}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          className="intro-video-sound"
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
  )
}
