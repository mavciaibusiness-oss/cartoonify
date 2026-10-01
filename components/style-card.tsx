'use client'

import type { CartoonStyle } from '@/lib/cartoon-styles'
import { format, getDictionary, styleText, type Locale } from '@/lib/i18n'
import { isDefaultStyle } from '@/lib/style-display'
import { stylePreviewPath } from '@/lib/style-previews'

/**
 * One style in the picker. Its text is in the visitor's language. Its preview
 * is the 480 px copy of the image rendered for it by task 0008, found through
 * stylePreviewPath. There is no fallback.
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
    <label className="style-card" data-category={style.category}>
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
        src={stylePreviewPath(style.id)}
        alt={format(t.styleCard.previewAlt, { name: text.name })}
        width={480}
        height={480}
        loading="lazy"
      />
      {isDefaultStyle(style.id) ? <span className="style-default-badge">{t.form.defaultGroup}</span> : null}
      <span className="style-card-name">{text.name}</span>
      <span className="style-card-description">{text.description}</span>
    </label>
  )
}
