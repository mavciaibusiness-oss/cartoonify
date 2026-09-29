'use client'

import type { CartoonStyle } from '@/lib/cartoon-styles'
import { format, getDictionary, styleText, type Locale } from '@/lib/i18n'

/**
 * One style in the picker. Its text is in the visitor's language. Its preview
 * is the one image rendered for it by task 0008: the same source portrait, at
 * the model, size and quality a visitor's request uses. There is one directory
 * and no fallback; task 0008 criterion 9 proves all 31 exist.
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
      <img
        className="style-card-preview"
        src={'/styles/' + style.id + '.webp'}
        alt={format(t.styleCard.previewAlt, { name: text.name })}
        width={320}
        height={320}
        loading="lazy"
      />
      <span className="style-card-name">{text.name}</span>
      <span className="style-card-description">{text.description}</span>
    </label>
  )
}
