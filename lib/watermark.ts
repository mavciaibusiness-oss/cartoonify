import sharp from 'sharp'
import { WATERMARK_MARK_PNG_BASE64 } from '@/lib/watermark-mark'

/** The mark's width as a share of the image width, and the corner margin. */
const MARK_WIDTH_SHARE = 0.22
const MARGIN_SHARE = 0.03

/**
 * Composites the ProToolHub mark into the bottom-right corner of a PNG given as
 * base64 and returns a PNG of the same size, also as base64. Nothing outside
 * the corner changes. Server-side only; no fonts and no file reads.
 */
export async function watermarkPng(b64: string): Promise<string> {
  const input = Buffer.from(b64, 'base64')
  const meta = await sharp(input).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width < 1 || height < 1) throw new Error('watermark: unreadable image')

  const markWidth = Math.max(40, Math.min(width, Math.round(width * MARK_WIDTH_SHARE)))
  const mark = await sharp(Buffer.from(WATERMARK_MARK_PNG_BASE64, 'base64'))
    .resize({ width: markWidth })
    .png()
    .toBuffer({ resolveWithObject: true })
  const margin = Math.round(width * MARGIN_SHARE)
  const left = Math.max(0, width - mark.info.width - margin)
  const top = Math.max(0, height - mark.info.height - margin)

  const out = await sharp(input)
    .composite([{ input: mark.data, left, top }])
    .png()
    .toBuffer()
  return out.toString('base64')
}
