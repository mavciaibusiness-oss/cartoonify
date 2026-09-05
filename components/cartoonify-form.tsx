'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CARTOON_STYLES,
  DEFAULT_CARTOON_STYLE_ID,
  isCartoonStyleId,
  type CartoonStyleId,
} from '@/lib/cartoon-styles'
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from '@/lib/image-constraints'

type Status = 'idle' | 'loading' | 'error' | 'success'

type ApiResponse = { ok: true; image: string } | { ok: false; code: string; message: string }

// Client-side validation produces the same Turkish copy as the server codes.
// It is a courtesy for the visitor, never the control — the server
// re-validates every upload regardless (see app/api/cartoonify/route.ts).
const CLIENT_MESSAGES = {
  invalidType: 'Bu dosya türü desteklenmiyor. Lütfen PNG, JPEG veya WEBP formatında bir görsel yükleyin.',
  tooLarge: 'Görsel çok büyük. Lütfen daha küçük bir dosya seçin.',
  noFile: 'Bir görsel seçmediniz. Lütfen bir dosya yükleyin.',
  network: 'Bağlantı sırasında bir sorun oluştu. Lütfen tekrar deneyin.',
}

function validateFile(file: File): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return CLIENT_MESSAGES.invalidType
  }
  if (file.size > MAX_FILE_BYTES) {
    return CLIENT_MESSAGES.tooLarge
  }
  return null
}

export default function CartoonifyForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [styleId, setStyleId] = useState<CartoonStyleId>(DEFAULT_CARTOON_STYLE_ID)
  const objectUrlRef = useRef<string | null>(null)

  function releasePreview() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  // Release the current object URL on unmount, in addition to every
  // replacement handled inline in handleFileChange.
  useEffect(() => {
    return releasePreview
  }, [])

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    releasePreview()
    setResultUrl(null)

    if (!file) {
      setPreviewUrl(null)
      setStatus('idle')
      setMessage(null)
      return
    }

    const validationError = validateFile(file)
    if (validationError) {
      setPreviewUrl(null)
      setStatus('error')
      setMessage(validationError)
      return
    }

    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setPreviewUrl(url)
    setStatus('idle')
    setMessage(null)
  }

  // The select can only offer allow-listed ids, so this guard is about a
  // stale or tampered DOM value, never about trusting the client: the server
  // re-checks the id against the same list on every request.
  function handleStyleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value
    if (isCartoonStyleId(value)) {
      setStyleId(value)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const input = event.currentTarget.elements.namedItem('image')
    const file = input instanceof HTMLInputElement ? input.files?.[0] ?? null : null

    if (!file) {
      setStatus('error')
      setMessage(CLIENT_MESSAGES.noFile)
      return
    }

    const validationError = validateFile(file)
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
        setMessage(data.message)
        return
      }

      setResultUrl(data.image)
      setStatus('success')
    } catch {
      setStatus('error')
      setMessage(CLIENT_MESSAGES.network)
    }
  }

  const canSubmit = status !== 'loading' && previewUrl !== null
  const selectedStyle =
    CARTOON_STYLES.find((style) => style.id === styleId) ?? CARTOON_STYLES[0]

  return (
    <div data-state={status} className="cartoonify">
      <form onSubmit={handleSubmit}>
        <label htmlFor="cartoonify-image-input">Bir fotoğraf seçin</label>
        <input
          id="cartoonify-image-input"
          name="image"
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          onChange={handleFileChange}
        />

        <div className="style-picker">
          <label htmlFor="cartoonify-style-select">Karikatür stili</label>
          <select
            id="cartoonify-style-select"
            name="style"
            value={styleId}
            onChange={handleStyleChange}
            disabled={status === 'loading'}
            aria-describedby="cartoonify-style-description"
          >
            {CARTOON_STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.name}
              </option>
            ))}
          </select>
          <p id="cartoonify-style-description">{selectedStyle.description}</p>
        </div>

        <p className="kvkk-notice">
          Yüklediğiniz görsel, karikatüre dönüştürülmek üzere <strong>OpenAI</strong> sunucularına
          gönderilir. Bu sunucular <strong>ABD</strong>&apos;de (Amerika Birleşik Devletleri)
          bulunur; bu bir <strong>yurt dışına aktarımdır</strong>. Görsel, işlemden önce veya
          sonra bu sitede saklanmaz. Ayrıntılı bilgi için{' '}
          <a href="/kvkk">KVKK Aydınlatma Metni</a>&apos;ni inceleyebilirsiniz.
        </p>

        {previewUrl ? (
          <div className="comparison">
            <figure>
              <figcaption>Orijinal</figcaption>
              <img src={previewUrl} alt="Yüklenen orijinal görsel" />
            </figure>
            {status === 'success' && resultUrl ? (
              <figure>
                <figcaption>Karikatür</figcaption>
                <img src={resultUrl} alt="Oluşturulan karikatür görseli" />
                <a download="karikatur.png" href={resultUrl}>
                  Karikatürü indir
                </a>
              </figure>
            ) : null}
          </div>
        ) : null}

        {status === 'loading' ? <p role="status">Karikatüre çevriliyor…</p> : null}
        {status === 'error' && message ? <p role="alert">{message}</p> : null}

        <button type="submit" disabled={!canSubmit}>
          Karikatüre Çevir
        </button>
      </form>
    </div>
  )
}
