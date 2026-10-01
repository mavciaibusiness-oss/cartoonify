/**
 * Executable form of the style rules (task 0017).
 *
 * The coordinate grid of tasks 0004-0016 is retired. What a style must still
 * satisfy: a slug id, a name and a description, a stored category from the
 * catalogue's twelve, a stored closing whose constant ends its prompt, a prompt
 * inside the length band for that closing, a preview subject with an approved
 * source, and a preview list that agrees with the preview directory. The job
 * the separation rule did - no two styles look alike - is carried by the
 * catalogue's differs_from notes and by the operator's side-by-side review of
 * every render batch (task 0017 section 3.6).
 *
 * Run: npm run check:styles
 */
import fs from 'node:fs'
import {
  STYLE_SOURCE, CARTOON_STYLES, CLOSING,
  STYLE_CATEGORIES, MERGED_STYLE_IDS,
} from '../lib/cartoon-styles.ts'
import { STYLE_PREVIEW_IDS, stylePreviewPath, PREVIEW_SUBJECTS, PREVIEW_SOURCES, PREVIEW_BATCHES } from '../lib/style-previews.ts'

// Literal, never built from a template string (next.regex_no_template_literal).
const SLUG = /^[a-z0-9-]+$/

/**
 * Deliberate second copy of `classic`'s prompt. Its only job is to fail if the
 * first copy changes. Task 0001's criteria assert this string unchanged.
 */
const FROZEN_CLASSIC =
  'Bu fotoğrafı canlı renkli, temiz hatlı bir karikatür/çizgi film çizimine dönüştür. ' +
  'Konuyu ve kompozisyonu koru, yalnızca çizim üslubunu değiştir.'

const BAND = { preserve: [260, 280], exaggerate: [300, 320] }
const SUBJECTS = ['K', 'E', 'P', 'M', 'N']

const failures = []
const fail = (m) => failures.push(m)

const seen = new Set()
for (const s of CARTOON_STYLES) {
  if (!SLUG.test(s.id)) fail(`id is not [a-z0-9-]: ${JSON.stringify(s.id)}`)
  if (seen.has(s.id)) fail(`duplicate id: ${s.id}`)
  seen.add(s.id)
  if (!s.name || !s.description) fail(`${s.id}: missing name or description`)
  if (!Object.prototype.hasOwnProperty.call(CLOSING, s.closing)) { fail(`${s.id}: closing ${JSON.stringify(s.closing)} is not preserve or exaggerate`); continue }
  if (s.id === 'classic') {
    if (s.prompt !== FROZEN_CLASSIC) fail('classic prompt CHANGED — 0001 asserts it unchanged')
    continue
  }
  if (!s.prompt.endsWith(' ' + CLOSING[s.closing])) fail(`${s.id}: the prompt does not end with its closing constant`)
  const n = [...s.prompt].length
  const [lo, hi] = BAND[s.closing]
  if (n < lo || n > hi) fail(`${s.id}: prompt ${n} chars, band ${lo}-${hi}`)
}

// Categories (task 0014): stored on each record, never derived.
const categories = new Set()
for (const c of STYLE_CATEGORIES) {
  if (typeof c !== 'string' || !SLUG.test(c)) fail(`categories: ${JSON.stringify(c)} is not [a-z0-9-]`)
  if (categories.has(c)) fail(`categories: ${c} is listed twice`)
  categories.add(c)
}
if (STYLE_CATEGORIES.length !== 12) fail(`categories: ${STYLE_CATEGORIES.length} listed, expected 12`)
for (const s of STYLE_SOURCE) {
  if (!Object.prototype.hasOwnProperty.call(s, 'category')) fail(`${s.id}: no category`)
  else if (!categories.has(s.category)) fail(`${s.id}: category ${JSON.stringify(s.category)} is not in STYLE_CATEGORIES`)
}

// Merged ids (task 0014): never active, always landing on an active style.
const activeIds = new Set(CARTOON_STYLES.map((s) => s.id))
for (const [from, to] of Object.entries(MERGED_STYLE_IDS)) {
  if (!SLUG.test(from)) fail(`merged: ${JSON.stringify(from)} is not [a-z0-9-]`)
  if (activeIds.has(from)) fail(`merged: ${from} is still an active style id`)
  if (!activeIds.has(to)) fail(`merged: ${from} -> ${to}, which is not an active style id`)
}

// Preview subjects, sources and batches (task 0017).
for (const id of activeIds) if (SUBJECTS.indexOf(PREVIEW_SUBJECTS[id]) < 0) fail(`subjects: ${id} has no known subject`)
for (const id of Object.keys(PREVIEW_SUBJECTS)) if (!activeIds.has(id)) fail(`subjects: ${id} is not an active style`)
for (const k of SUBJECTS) {
  const src = PREVIEW_SOURCES[k]
  // Existence and hash are checked by scripts/render-batch.mjs before every call.
  if (!src || !src.path || !/^[0-9a-f]{12}$/.test(src.sha256_prefix || '')) fail(`sources: ${k} has no path or 12-hex approved prefix`)
}
const inBatch = new Set()
for (const b of PREVIEW_BATCHES) for (const id of b) {
  if (!activeIds.has(id)) fail(`batches: ${id} is not an active style`)
  if (inBatch.has(id)) fail(`batches: ${id} is in two batches`)
  inBatch.add(id)
}

// Preview list and preview directory must agree in BOTH directions.
const PREVIEW_DIR = ('public' + stylePreviewPath('_', 'full')).split('/').slice(0, -1).join('/')
const seenPreview = new Set()
for (const id of STYLE_PREVIEW_IDS) {
  if (!activeIds.has(id)) fail(`previews: ${id} is listed but is not a style id`)
  if (seenPreview.has(id)) fail(`previews: ${id} is listed twice`)
  seenPreview.add(id)
  const f = 'public' + stylePreviewPath(id, 'full')
  if (!fs.existsSync(f)) fail(`previews: ${id} is listed but ${f} does not exist`)
  else if (fs.statSync(f).size === 0) fail(`previews: ${f} is zero bytes`)
}
if (fs.existsSync(PREVIEW_DIR)) {
  for (const e of fs.readdirSync(PREVIEW_DIR)) {
    if (e === '.gitkeep') continue
    if (!e.endsWith('.webp')) fail(`previews: ${PREVIEW_DIR}/${e} is not a .webp`)
    else if (!seenPreview.has(e.slice(0, -5)))
      fail(`previews: ${PREVIEW_DIR}/${e} exists but is not in STYLE_PREVIEW_IDS`)
  }
}

const perCategory = STYLE_CATEGORIES
  .map((c) => `${c}:${STYLE_SOURCE.filter((s) => s.category === c).length}`)
  .join(' ')
const perClosing = Object.keys(CLOSING).map((k) => `${k}:${CARTOON_STYLES.filter((s) => s.closing === k).length}`).join(' ')
console.log(`styles ${CARTOON_STYLES.length} | ${perClosing} | previews ${STYLE_PREVIEW_IDS.length}`)
console.log(`categories | ${perCategory}`)
if (failures.length) {
  console.error(`\ncheck:styles FAILED (${failures.length})`)
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log('check:styles OK')
