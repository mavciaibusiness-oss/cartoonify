'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from '@/lib/image-constraints'
import { format, getDictionary, localizedPath, type Dictionary, type Locale } from '@/lib/i18n'
import { useUpload } from './upload-state'

type UploadControlProps = {
  locale: Locale
  redirectOnSelect?: boolean
}

function validateFile(file: File, t: Dictionary): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return t.errors.INVALID_TYPE
  }
  if (file.size > MAX_FILE_BYTES) {
    return t.errors.FILE_TOO_LARGE
  }
  return null
}

export default function UploadControl({ locale, redirectOnSelect = true }: UploadControlProps) {
  const router = useRouter()
  const { setUpload } = useUpload()
  const [message, setMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const t = getDictionary(locale)

  function handleSelectedFile(file: File | null) {
    if (!file) {
      setUpload(null)
      setMessage(null)
      return
    }

    const validationError = validateFile(file, t)
    if (validationError) {
      setUpload(null)
      setMessage(validationError)
      return
    }

    setMessage(null)
    setUpload(file)

    if (redirectOnSelect) {
      router.push(localizedPath(locale, '/workshop'))
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    handleSelectedFile(event.target.files?.[0] ?? null)
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    handleSelectedFile(event.dataTransfer.files?.[0] ?? null)
  }

  function handleDragOver(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }

  return (
    <section className="upload-control" aria-labelledby="upload-control-title">
      <input
        id="cartoonify-image-input"
        className="visually-hidden"
        name="image"
        type="file"
        accept={ALLOWED_MIME_TYPES.join(',')}
        aria-describedby="cartoonify-upload-help cartoonify-upload-message"
        onChange={handleFileChange}
      />

      <label
        htmlFor="cartoonify-image-input"
        className="upload-dropzone"
        data-dragging={isDragging ? 'true' : 'false'}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <span className="upload-dropzone-eyebrow">{t.upload.eyebrow}</span>
        <h2 id="upload-control-title">{t.upload.title}</h2>
        <p>{t.upload.description}</p>
        <span className="upload-dropzone-button">{t.upload.browse}</span>
      </label>

      <p id="cartoonify-upload-help" className="upload-help">
        {format(t.upload.help, { n: Math.floor(MAX_FILE_BYTES / (1024 * 1024)) })}
      </p>

      <p id="cartoonify-upload-message" className="upload-message" aria-live="polite" role="status">
        {message}
      </p>
    </section>
  )
}
