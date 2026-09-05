/**
 * Single source of truth for the image upload contract used by both
 * components/cartoonify-form.tsx (client) and app/api/cartoonify/route.ts
 * (server). Neither of those files may restate a MIME string or a byte
 * number of its own — see criterion 22.
 *
 * Pure constants and pure functions only. No secrets. Safe to bundle
 * client-side.
 */

/** The only MIME types this feature accepts, in either direction. */
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/**
 * 4 MiB, not a rounder number, because Vercel caps a serverless function
 * request body at 4.5 MB. A larger ceiling would pass locally and fail only
 * in production. Do not raise it.
 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4194304

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_MAGIC = [0xff, 0xd8, 0xff]
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]

function bytesStartWith(bytes: Uint8Array, magic: number[], offset = 0): boolean {
  if (bytes.length < offset + magic.length) return false
  for (let i = 0; i < magic.length; i++) {
    if (bytes[offset + i] !== magic[i]) return false
  }
  return true
}

/**
 * Reads magic bytes to determine the real image type. The `type` field on a
 * FormData file is supplied by the client and is not evidence — this is.
 */
export function sniffImageType(bytes: Uint8Array): AllowedMimeType | null {
  if (bytesStartWith(bytes, PNG_MAGIC)) return 'image/png'
  if (bytesStartWith(bytes, JPEG_MAGIC)) return 'image/jpeg'
  if (bytesStartWith(bytes, RIFF_MAGIC) && bytesStartWith(bytes, WEBP_MAGIC, 8)) {
    return 'image/webp'
  }
  return null
}
