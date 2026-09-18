'use client'

import type { CartoonStyle } from '@/lib/cartoon-styles'
import { STYLE_PREVIEW_IDS } from '@/lib/style-previews'

/**
 * One card in the style grid: a radio input, a preview image or a CSS
 * swatch fallback, the name and the description. No style id and no colour
 * is hard-coded here — the id comes from `style`, which is always sourced
 * from lib/cartoon-styles.ts, and colour is app/globals.css's job via the
 * `data-style-group` attribute (see task 0004 criterion 11).
 */
export default function StyleCard({
  style,
  checked,
  disabled,
  onSelect,
}: {
  style: CartoonStyle
  checked: boolean
  disabled: boolean
  onSelect: (id: string) => void
}) {
  const hasPreview = STYLE_PREVIEW_IDS.includes(style.id)

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
      {hasPreview ? (
        <img
          className="style-card-preview"
          src={'/styles/' + style.id + '.webp'}
          alt={style.name}
          width={150}
          height={150}
          loading="lazy"
        />
      ) : (
        <span className="style-card-swatch" aria-hidden="true" />
      )}
      <span className="style-card-name">{style.name}</span>
      <span className="style-card-description">{style.description}</span>
    </label>
  )
}
