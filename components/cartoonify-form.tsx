'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CARTOON_STYLE_ID,
  getCartoonStyle,
  isCartoonStyleId,
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
import { REDUCED_MOTION_QUERY, resultPanel, scrollBehaviorFor } from '@/lib/workbench-state'
import { displayGroups } from '@/lib/style-display'
import { styleMatchesQuery } from '@/lib/style-search'
import {
  activeCategories,
  categoryFromQuery,
  searchFromQuery,
  styleFromQuery,
  withPickerQuery,
  type CategoryFilter,
} from '@/lib/style-query'
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
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultStyleId, setResultStyleId] = useState<CartoonStyleId | null>(null)
  const [styleId, setStyleId] = useState<CartoonStyleId>(() => styleFromQuery(searchParams.get('style')))
  const [progress, setProgress] = useState(0)
  const [category, setCategory] = useState<CategoryFilter>(() => categoryFromQuery(searchParams.get('category')))
  const [query, setQuery] = useState<string>(() => searchFromQuery(searchParams.get('q')))
  const resultRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (status !== 'loading') {
      setProgress(0)
      return
    }

    const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches
    resultRef.current?.scrollIntoView({ block: 'start', behavior: scrollBehaviorFor(reduced) })

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

  // Writes the filter to the address, keeping every other parameter. The raw
  // text stays in state so spaces can be typed; only the address is trimmed.
  function applyFilter(nextCategory: CategoryFilter, nextQuery: string) {
    setCategory(nextCategory)
    setQuery(nextQuery)
    router.replace(pathname + withPickerQuery(searchParams.toString(), nextCategory, nextQuery), { scroll: false })
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
    setResultStyleId(null)
    setMessage(null)
  }

  function handleRemoveFile() {
    setUpload(null)
    setStyleId(DEFAULT_CARTOON_STYLE_ID)
    setResultUrl(null)
    setResultStyleId(null)
    setMessage(null)
    setStatus('idle')
  }

  function handleCreateAnother() {
    setResultUrl(null)
    setResultStyleId(null)
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

    // The style that is sent is the style the result will be labelled with,
    // even if the selection changes while the request is in flight.
    const sentStyleId = styleId

    setStatus('loading')
    setMessage(null)

    try {
      const body = new FormData()
      body.append('image', file)
      body.append('style', sentStyleId)

      const response = await fetch('/api/cartoonify', { method: 'POST', body })
      const data = (await response.json()) as ApiResponse

      if (!data.ok) {
        setStatus('error')
        setMessage(errorMessage(t, data.code, data.message))
        return
      }

      setResultUrl(data.image)
      setResultStyleId(sentStyleId)
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
    () => displayGroups().map((group) => ({ id: group.id, label: groupLabel(group.id, locale), styles: group.styles })),
    [locale]
  )
  const categories = useMemo(() => activeCategories(), [])
  const visibleGroups = galleryGroups
    .map((group) => ({
      ...group,
      styles: group.styles.filter(
        (style) =>
          (category === 'all' || style.category === category) &&
          styleMatchesQuery({ id: style.id, name: style.name }, query)
      ),
    }))
    .filter((group) => group.styles.length > 0)
  const styleCount = visibleGroups.reduce((sum, group) => sum + group.styles.length, 0)

  const isResultVisible = Boolean(resultUrl)
  const panel = resultPanel({
    selectedStyleId: styleId,
    resultStyleId,
    hasResult: isResultVisible,
    loading: status === 'loading',
  })
  const resultText = styleText(getCartoonStyle(panel.labelStyleId as CartoonStyleId), locale)
  const showResultRegion = status === 'loading' || isResultVisible

  return (
    <div data-state={status} className="cartoonify-workshop">
      <form onSubmit={handleSubmit} className="workshop-shell">
        <div className="workshop-panel">
          <KvkkNotice locale={locale} />

          <section className="workshop-upload" aria-label={t.form.stepPreview}>
            <div className="workshop-upload-head">
              <h2>{t.form.stepPreview}</h2>
            </div>

            <input
              id="replace-image-input"
              className="visually-hidden"
              type="file"
              accept={ALLOWED_MIME_TYPES.join(',')}
              onChange={handleReplaceFile}
            />

            {previewUrl ? <img src={previewUrl} alt={t.form.originalAlt} className="workshop-upload-preview" /> : null}
            <span className="workshop-upload-name">{file?.name}</span>

            <div className="workshop-upload-controls">
              <label htmlFor="replace-image-input" className="ghost-button">
                {t.form.replace}
              </label>
              <button type="button" className="ghost-button" onClick={handleRemoveFile}>
                {t.form.remove}
              </button>
            </div>
          </section>

          <p className="workshop-selected">
            {t.form.selectedStyle} <strong>{selectedText.name}</strong>
          </p>

          <div className="workshop-actions">
            {panel.showGenerate ? (
              <button type="submit" className="generate-button" disabled={!canSubmit}>
                {status === 'loading' ? t.form.generating : t.form.generate}
              </button>
            ) : (
              <>
                {resultUrl ? (
                  <a className="primary-download" download="karikatur.png" href={resultUrl}>
                    {t.form.download}
                  </a>
                ) : null}
                {panel.showRegenerate ? (
                  <button type="submit" className="regenerate-button ghost-button">
                    {format(t.form.regenerate, { style: selectedText.name })}
                  </button>
                ) : null}
                <button type="button" className="ghost-button" onClick={handleCreateAnother}>
                  {t.form.createAnother}
                </button>
              </>
            )}
          </div>

          {status === 'error' && message ? (
            <p className="error-text" role="alert">
              {message}
            </p>
          ) : null}
        </div>

        <div className="workshop-main">
          <header className="workshop-header">
            <p className="workshop-badge">{t.form.badge}</p>
            <h1>{t.form.title}</h1>
            <p>{t.form.lede}</p>
          </header>

          {showResultRegion ? (
            <section ref={resultRef} className="workshop-result" aria-label={t.form.workspaceLabel}>
              <div className="workspace-stage-head">
                <h2>{t.form.stepResult}</h2>
                <div className="workspace-stage-head-right">
                  {status === 'loading' ? <span className="status-chip">{t.form.chipProcessing}</span> : null}
                  {status === 'success' ? <span className="status-chip success">{t.form.chipReady}</span> : null}
                  {status === 'error' ? <span className="status-chip error">{t.form.chipError}</span> : null}
                </div>
              </div>

              <div className="workshop-result-frame" data-canvas-state={status}>
                {status === 'loading' ? (
                  <div className="processing-canvas" role="status" aria-live="polite">
                    <p>{t.form.processing}</p>
                    <div className="progress-track" aria-hidden="true">
                      <span className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <small>{progress}%</small>
                  </div>
                ) : resultUrl ? (
                  <img src={resultUrl} alt={t.form.resultAlt} className="workspace-stage-image" />
                ) : null}
              </div>

              {isResultVisible && panel.labelKind === 'result' ? (
                <p className="workspace-style-hint">
                  {t.form.resultStyle} <strong>{resultText.name}</strong>
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="style-picker" aria-label={t.form.galleryLabel}>
            <div className="style-sidebar-head">
              <h2>{t.form.stepStyle}</h2>
              <p>{format(t.form.stylesAvailable, { n: styleCount })}</p>
            </div>

            <div className="style-tools">
              <div className="style-filter" role="group" aria-label={t.form.filterLabel}>
                <button
                  type="button"
                  data-category="all"
                  aria-pressed={category === 'all'}
                  onClick={() => applyFilter('all', query)}
                >
                  {t.form.filterAll}
                </button>
                {categories.map((id) => (
                  <button
                    key={id}
                    type="button"
                    data-category={id}
                    aria-pressed={category === id}
                    onClick={() => applyFilter(id, query)}
                  >
                    {t.styleCategories[id]}
                  </button>
                ))}
              </div>
              <label className="style-search-label">
                {t.form.searchLabel}
                <input
                  type="search"
                  className="style-search"
                  maxLength={60}
                  placeholder={t.form.searchPlaceholder}
                  value={query}
                  onChange={(event) => applyFilter(category, event.target.value)}
                />
              </label>
            </div>

            <div className="style-gallery" aria-describedby="cartoonify-style-description">
              {visibleGroups.map((group) => (
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

              {styleCount === 0 ? (
                <p className="style-empty">
                  {t.form.noResults}
                  <button type="button" className="ghost-button" onClick={() => applyFilter('all', '')}>
                    {t.form.clearFilters}
                  </button>
                </p>
              ) : null}

              <p id="cartoonify-style-description" className="style-description-live">
                {selectedText.description}
              </p>
            </div>
          </section>
        </div>
      </form>
    </div>
  )
}
