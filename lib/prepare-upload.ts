import { MAX_FILE_BYTES, MAX_UPLOAD_EDGE_PX } from '@/lib/image-constraints'

/**
 * Browser-side downscale (decision D4). The server only receives 4 MiB, so a
 * larger or wider photo is re-encoded here as a JPEG before it is sent. Small
 * files are returned unchanged. Returns null when the result is still too big.
 */

async function encode(file: File, longEdge: number, quality: number): Promise<File | null> {
  // from-image applies the EXIF rotation, so a portrait phone photo stays portrait.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return null
    const base = file.name.replace(/[.][^.]*$/, '') || 'photo'
    return new File([blob], base + '.jpg', { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}

async function longEdgeOf(file: File): Promise<number> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const edge = Math.max(bitmap.width, bitmap.height)
  bitmap.close()
  return edge
}

export async function prepareUpload(file: File): Promise<File | null> {
  let edge = 0
  try {
    edge = await longEdgeOf(file)
  } catch {
    // Not decodable here; send as is and let the server decide.
    return file.size <= MAX_FILE_BYTES ? file : null
  }
  if (file.size <= MAX_FILE_BYTES && edge <= MAX_UPLOAD_EDGE_PX) return file

  const attempts: Array<[number, number]> = [
    [MAX_UPLOAD_EDGE_PX, 0.9],
    [MAX_UPLOAD_EDGE_PX, 0.8],
    [1536, 0.8],
  ]
  for (const [longEdge, quality] of attempts) {
    const out = await encode(file, longEdge, quality)
    if (out && out.size <= MAX_FILE_BYTES) return out
  }
  return null
}
