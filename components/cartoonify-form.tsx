'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_CARTOON_STYLE_ID,
  getCartoonStyle,
  isCartoonStyleId,
  STYLE_GROUPS,
  type CartoonStyle,
  type CartoonStyleId,
} from '@/lib/cartoon-styles'
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from '@/lib/image-constraints'
import {
  errorMessage,
  format,
  getDictionary,
  groupLabel,
  styleText,
  type Dictionary,
  type Locale,
} from '@/lib/i18n'
import KvkkNotice from './kvkk-notice'
import { useUpload } from './upload-state'
import StyleCard from './style-card'

type Status = 'idle' | 'loading' | 'error' | 'success'

type ApiResponse = { ok: true; image: string } | { ok: false; code: string; message: string }

type GalleryGroup = { id: string; label: string; styles: readonly CartoonStyle[] }

function validateFile(file: File, t: Dictionary): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return t.errors.INVALID_TYPE
  }
  if (file.size > MAX_FILE_BYTES) {
    return t.errors.FILE_TOO_LARGE
  }
  return null
}

export default function CartoonifyForm({ locale }: { locale: Locale }) {
  const { file, previewUrl, setUpload } = useUpload()
  const t = getDictionary(locale)

  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [styleId, setStyleId] = useState<CartoonStyleId>(DEFAULT_CARTOON_STYLE_ID)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (status !== 'loading') {
      setProgress(0)
      return
    }

    setProgress(8)
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev
        const jump = prev < 35 ? 8 : prev < 70 ? 5 : 2
        return Math.min(92, prev + jump)
      })
    }, 320)

    return () => window.clearInterval(timer)
  }, [status])

  function handleStyleSelect(value: string) {
    if (isCartoonStyleId(value)) {
      setStyleId(value)
    }
  }

  function handleReplaceFile(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null

    if (!nextFile) {
      return
    }

    const validationError = validateFile(nextFile, t)
    if (validationError) {
      setMessage(validationError)
      setStatus('error')
      return
    }

    setUpload(nextFile)
    setStatus('idle')
    setResultUrl(null)
    setMessage(null)
  }

  function handleRemoveFile() {
    setUpload(null)
    setStyleId(DEFAULT_CARTOON_STYLE_ID)
    setResultUrl(null)
    setMessage(null)
    setStatus('idle')
  }

  function handleCreateAnother() {
    setResultUrl(null)
    setMessage(null)
    setStatus('idle')
    setProgress(0)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!file) {
      setStatus('error')
      setMessage(t.errors.NO_FILE)
      return
    }

    const validationError = validateFile(file, t)
    if (validationError) {
      setStatus('error')
      setMessage(validationError)
      return
    }

    setStatus('loading')
    setMessage(null)

    try {
      const body = new FormData()
      body.append('image', file)
      body.append('style', styleId)

      const response = await fetch('/api/cartoonify', { method: 'POST', body })
      const data = (await response.json()) as ApiResponse

      if (!data.ok) {
        setStatus('error')
        setMessage(errorMessage(t, data.code, data.message))
        return
      }

      setResultUrl(data.image)
      setStatus('success')
      setProgress(100)
    } catch {
      setStatus('error')
      setMessage(t.client.network)
    }
  }

  const canSubmit = status !== 'loading' && previewUrl !== null
  const selectedText = styleText(getCartoonStyle(styleId), locale)
  const galleryGroups = useMemo<readonly GalleryGroup[]>(
    () => [
      { id: 'default', label: t.form.defaultGroup, styles: [getCartoonStyle(DEFAULT_CARTOON_STYLE_ID)] },
      ...STYLE_GROUPS.map((group) => ({ id: group.id, label: groupLabel(group.id, locale), styles: group.styles })),
    ],
    [t, locale]
  )
  const styleCount = galleryGroups.reduce((sum, group) => sum + group.styles.length, 0)

  const canvasImageUrl = resultUrl ?? previewUrl
  const isResultVisible = Boolean(resultUrl)

  return (
    <div data-state={status} className="cartoonify-workshop">
      <header className="workshop-header">
        <p className="workshop-badge">{t.form.badge}</p>
        <h1>{t.form.title}</h1>
        <p>{t.form.lede}</p>
      </header>

      <form onSubmit={handleSubmit} className="workshop-shell">
        <KvkkNotice locale={locale} />

        <section className="workshop-upload" aria-label={t.form.stepPreview}>
          <div className="workshop-upload-head">
            <h2>{t.form.stepPreview}</h2>
            <div className="workspace-stage-controls">
              <label htmlFor="replace-image-input" className="ghost-button">
                {t.form.replace}
              </label>
              <button type="button" className="ghost-button" onClick={handleRemoveFile}>
                {t.form.remove}
              </button>
            </div>
          </div>

          <input
            id="replace-image-input"
            className="visually-hidden"
            type="file"
            accept={ALLOWED_MIME_TYPES.join(',')}
            onChange={handleReplaceFile}
          />

          <div className="workshop-upload-file">
            {previewUrl ? <img src={previewUrl} alt={t.form.originalAlt} className="workshop-upload-thumb" /> : null}
            <span className="workshop-upload-name">{file?.name}</span>
          </div>
        </section>

        <aside className="style-sidebar" aria-label={t.form.galleryLabel}>
          <div className="style-sidebar-head">
            <h2>{t.form.stepStyle}</h2>
            <p>{format(t.form.stylesAvailable, { n: styleCount })}</p>
          </div>

          <div className="style-gallery" aria-describedby="cartoonify-style-description">
            {galleryGroups.map((group) => (
              <fieldset key={group.id} className="style-group">
                <legend>{group.label}</legend>
                <div className="style-grid">
                  {group.styles.map((style) => (
                    <StyleCard
                      key={style.id}
                      style={style}
                      locale={locale}
                      checked={styleId === style.id}
                      disabled={status === 'loading'}
                      onSelect={handleStyleSelect}
                    />
                  ))}
                </div>
              </fieldset>
            ))}

            <p id="cartoonify-style-description" className="style-description-live">
              {selectedText.description}
            </p>
          </div>
        </aside>

        <section className="workshop-result" aria-label={t.form.workspaceLabel}>
          <div className="workspace-stage-head">
            <h2>{t.form.stepResult}</h2>
            <div className="workspace-stage-head-right">
              {status === 'loading' ? <span className="status-chip">{t.form.chipProcessing}</span> : null}
              {status === 'success' ? <span className="status-chip success">{t.form.chipReady}</span> : null}
              {status === 'error' ? <span className="status-chip error">{t.form.chipError}</span> : null}
            </div>
          </div>

          <div className="workspace-stage-image-wrap" data-canvas-state={status}>
            {status === 'loading' ? (
              <div className="processing-canvas" role="status" aria-live="polite">
                <p>{t.form.processing}</p>
                <div className="progress-track" aria-hidden="true">
                  <span className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <small>{progress}%</small>
              </div>
            ) : canvasImageUrl ? (
              <img
                src={canvasImageUrl}
                alt={isResultVisible ? t.form.resultAlt : t.form.originalAlt}
                className="workspace-stage-image"
              />
            ) : (
              <p className="result-empty">{t.form.emptyCanvas}</p>
            )}
          </div>

          <div className="workspace-cta-block">
            {!isResultVisible ? (
              <button type="submit" className="generate-button" disabled={!canSubmit}>
                {status === 'loading' ? t.form.generating : t.form.generate}
              </button>
            ) : (
              <div className="result-actions workspace-result-actions">
                <a className="primary-download" download="karikatur.png" href={resultUrl ?? undefined}>
                  {t.form.download}
                </a>
                <button type="button" className="ghost-button" onClick={handleCreateAnother}>
                  {t.form.createAnother}
                </button>
              </div>
            )}
            <p className="workspace-style-hint">
              {t.form.selectedStyle} <strong>{selectedText.name}</strong>
            </p>
          </div>

          {status === 'error' && message ? (
            <p className="error-text" role="alert">
              {message}
            </p>
          ) : null}
        </section>
      </form>
    </div>
  )
}
