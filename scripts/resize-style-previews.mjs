/**
 * Resizes the 31 style previews for the web: the landing showcase and the
 * workshop picker card both read the web-size preview (stylePreviewPath). Task 0010, section 5.
 *
 * FREE. It reads the full-size previews and writes the web-size ones; it makes no
 * provider call and needs no key.
 *
 * Every source is checked against the hash task 0008 recorded for it in
 * lib/preview-manifest.json before anything is written, so a web copy can only
 * come from the frozen preview. One mismatch stops the run with nothing
 * written: the previews are frozen, and a changed one is a finding, not
 * something to resize around.
 *
 * Run from the repository root:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/resize-style-previews.mjs
 *
 * Writes lib/style-web-manifest.json: { files: { <id>: { from, from_sha256,
 * sha256, bytes, width, quality } } }, which task 0010 criterion 9 reads.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { CARTOON_STYLES } from '../lib/cartoon-styles.ts'
import { stylePreviewPath } from '../lib/style-previews.ts'

/** Task 0010 section 5. Measured before the spec was written: 1 204 102 bytes
 *  for all 31, the largest 95 946, so no quality ladder is needed. */
const WIDTH = 480
const QUALITY = 72
const EFFORT = 6
const MAX_BYTES = 100000

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PREVIEW_MANIFEST = path.join(ROOT, 'lib', 'preview-manifest.json')
const OUT_MANIFEST_REL = 'lib/style-web-manifest.json'
const OUT_DIR_REL = path.posix.dirname('public' + stylePreviewPath('_', 'web'))
const abs = (rel) => path.join(ROOT, ...rel.split('/'))
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')

function fail(message) {
  console.error('resize-style-previews: ' + message)
  process.exit(1)
}

const recorded = JSON.parse(fs.readFileSync(PREVIEW_MANIFEST, 'utf8')).previews || {}

// Check every source first, so a mismatch leaves nothing half-written.
const sources = CARTOON_STYLES.map((style) => {
  const from = 'public' + stylePreviewPath(style.id, 'full')
  if (!fs.existsSync(abs(from))) fail(from + ' is missing')
  const bytes = fs.readFileSync(abs(from))
  const hash = sha256(bytes)
  const expected = recorded[style.id] && recorded[style.id].sha256
  if (hash !== expected) {
    fail(from + ' hashes to ' + hash.slice(0, 12) + ', but lib/preview-manifest.json records ' + String(expected).slice(0, 12) + '; stopping, nothing written')
  }
  return { id: style.id, from, bytes, hash }
})

fs.mkdirSync(abs(OUT_DIR_REL), { recursive: true })
const files = {}
let total = 0
for (const s of sources) {
  const out = await sharp(s.bytes).resize(WIDTH, WIDTH).webp({ quality: QUALITY, effort: EFFORT }).toBuffer()
  if (out.length > MAX_BYTES) fail(s.id + ' is ' + out.length + ' bytes at ' + WIDTH + ' px q' + QUALITY + ', over ' + MAX_BYTES)
  const rel = 'public' + stylePreviewPath(s.id, 'web')
  fs.writeFileSync(abs(rel), out)
  files[s.id] = { from: s.from, from_sha256: s.hash, sha256: sha256(out), bytes: out.length, width: WIDTH, quality: QUALITY }
  total += out.length
}

fs.writeFileSync(abs(OUT_MANIFEST_REL), JSON.stringify({ files }, null, 2) + '\n')
console.log('wrote ' + sources.length + ' files, ' + total + ' bytes total')
