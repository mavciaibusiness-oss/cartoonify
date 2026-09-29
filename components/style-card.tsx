'use client'

import { useMemo, useState } from 'react'
import type { CartoonStyle } from '@/lib/cartoon-styles'
import { format, getDictionary, styleText, type Locale } from '@/lib/i18n'

/**
 * One style in the picker. Its text is in the visitor's language. Its image
 * sources are unchanged by task 0007: the rendered sample first, the preview
 * directory second. Replacing both is the next task's, after the model moves.
 */
export default function StyleCard({
  style,
  locale,
  checked,
  disabled,
  onSelect,
}: {
  style: CartoonStyle
  locale: Locale
  checked: boolean
  disabled: boolean
  onSelect: (id: string) => void
}) {
  const previewSources = useMemo(
    () => ['/style-samples/' + style.id + '.webp', '/styles/' + style.id + '.webp'],
    [style.id]
  )
  const [sourceIndex, setSourceIndex] = useState(0)
  const currentPreviewSource = previewSources[sourceIndex]
  const text = styleText(style, locale)
  const t = getDictionary(locale)

  return (
    <label className="style-card" data-style-group={style.group ?? undefined}>
      <input
        type="radio"
        name="style"
        value={style.id}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(style.id)}
      />
      {currentPreviewSource ? (
        <img
          className="style-card-preview"
          src={currentPreviewSource}
          alt={format(t.styleCard.previewAlt, { name: text.name })}
          width={320}
          height={320}
          loading="lazy"
          onError={() => setSourceIndex((prev) => prev + 1)}
        />
      ) : null}
      <span className="style-card-name">{text.name}</span>
      <span className="style-card-description">{text.description}</span>
    </label>
  )
}
