/**
 * Executable form of the style worksheet.
 *
 * The axis grid, the group derivation, the separation rule and the assertion
 * column are design rules that used to live only in a document. This runs them.
 * A new style cannot be added by writing a prompt from a name: it has to fill
 * the same columns as the thirty already here, and this fails if it does not.
 *
 * Run: npm run check:styles
 */
import fs from 'node:fs'
import {
  STYLE_SOURCE, CARTOON_STYLES, CLOSING, deriveGroup, closingFor,
  STYLE_CATEGORIES, MERGED_STYLE_IDS,
} from '../lib/cartoon-styles.ts'
import { STYLE_PREVIEW_IDS, stylePreviewPath } from '../lib/style-previews.ts'

// Literal, never built from a template string (next.regex_no_template_literal).
const SLUG = /^[a-z0-9-]+$/

/**
 * Deliberate second copy of `classic`'s prompt. Its only job is to fail if the
 * first copy changes. Task 0001's criteria assert this string unchanged, and
 * the transcription into config is exactly when it would be normalised into
 * the new shape by accident.
 */
const FROZEN_CLASSIC =
  'Bu fotoğrafı canlı renkli, temiz hatlı bir karikatür/çizgi film çizimine dönüştür. ' +
  'Konuyu ve kompozisyonu koru, yalnızca çizim üslubunu değiştir.'

const AXES = ['B', 'T', 'C', 'S', 'F', 'D']
const KEY_AXES = ['B', 'T', 'F']
// The one value per axis that means "no instruction given".
const NULL_VALUES = new Set(['B3', 'C1', 'S1', 'D1'])
const BAND = { preserve: [260, 280], exaggerate: [300, 320] }

const failures = []
const fail = (m) => failures.push(m)

const seen = new Set()
for (const s of CARTOON_STYLES) {
  if (!SLUG.test(s.id)) fail(`id is not [a-z0-9-]: ${JSON.stringify(s.id)}`)
  if (seen.has(s.id)) fail(`duplicate id: ${s.id}`)
  seen.add(s.id)
  if (!s.name || !s.description) fail(`${s.id}: missing name or description`)

  if (s.id === 'classic') {
    if (s.prompt !== FROZEN_CLASSIC) fail('classic prompt CHANGED — 0001 asserts it unchanged')
    if (s.coords !== null || s.group !== null) fail('classic must stay outside the grid')
    continue
  }
  if (s.coords === null || s.asserts === null) fail(`${s.id}: missing coords or asserts`)
  if (s.coords === null) continue

  const closing = closingFor(s.coords)
  if (!s.prompt.endsWith(CLOSING[closing])) fail(`${s.id}: wrong closing constant`)
  const n = [...s.prompt].length
  const [lo, hi] = BAND[closing]
  if (n < lo || n > hi) fail(`${s.id}: prompt ${n} chars, band ${lo}-${hi}`)

  for (const a of AXES) {
    const src = s.asserts[a]
    if (!src) fail(`${s.id}: axis ${a} has no assertion source`)
    if (src === 'null' && !NULL_VALUES.has(s.coords[a]))
      fail(`${s.id}: ${a}=${s.coords[a]} is not a null value but is asserted by nothing`)
    if (src === 'constant' && !(a === 'F' && s.coords.F === 'F1'))
      fail(`${s.id}: only F1 may be asserted by the closing constant`)
  }
  if (s.coords.D === 'D4' && !['T1', 'T5'].includes(s.coords.T))
    fail(`${s.id}: D4 (modelled volume) requires T1 or T5, has ${s.coords.T}`)
  if (deriveGroup(s.coords) !== s.group) fail(`${s.id}: group is not derived from coords`)
}

// Separation rule: within a group, two styles differ on >=2 axes, at least one
// of which is B, T or F — the three that survive being shrunk to a card.
const grid = CARTOON_STYLES.filter((s) => s.coords !== null)
for (const g of ['cizgi', 'boya', 'baski', 'kesme']) {
  const rows = grid.filter((s) => s.group === g)
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const d = AXES.filter((a) => rows[i].coords[a] !== rows[j].coords[a])
      if (d.length < 2 || !d.some((a) => KEY_AXES.includes(a)))
        fail(`separation: ${rows[i].id} / ${rows[j].id} differ only on [${d.join(',')}]`)
    }
  }
}

// Categories (task 0014). Stored on each record, never derived; the list is
// the twelve of the catalogue plan. Checked on STYLE_SOURCE, the stored form,
// so a record that omits the field fails here rather than reading undefined.
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

// Merged ids (task 0014): an old id is never an active one, and it always
// lands on an active style, so the route's redirect can never reach nothing.
const activeIds = new Set(CARTOON_STYLES.map((s) => s.id))
for (const [from, to] of Object.entries(MERGED_STYLE_IDS)) {
  if (!SLUG.test(from)) fail(`merged: ${JSON.stringify(from)} is not [a-z0-9-]`)
  if (activeIds.has(from)) fail(`merged: ${from} is still an active style id`)
  if (!activeIds.has(to)) fail(`merged: ${from} -> ${to}, which is not an active style id`)
}

// Preview list and preview directory must agree in BOTH directions.
//
// lib/style-previews.ts has always said this file keeps them in agreement. It
// did not: nothing here imported the list or looked at the directory, so the
// binding the comment describes was asserted and unenforced. An empty list is
// still legal - previews are generated one at a time and cost a paid upstream
// call each - but a listed id with no file, a file with no listed id, an id
// that is not a style, a duplicate, or a zero-byte asset are all failures.
const PREVIEW_DIR = ('public' + stylePreviewPath('_', 'full')).split('/').slice(0, -1).join('/')
const listed = STYLE_PREVIEW_IDS
const styleIds = new Set(CARTOON_STYLES.map((s) => s.id))
const seenPreview = new Set()
for (const id of listed) {
  if (!styleIds.has(id)) fail(`previews: ${id} is listed but is not a style id`)
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

const counts = ['cizgi', 'boya', 'baski', 'kesme']
  .map((g) => `${g}:${grid.filter((s) => s.group === g).length}`)
  .join(' ')
const perCategory = STYLE_CATEGORIES
  .map((c) => `${c}:${STYLE_SOURCE.filter((s) => s.category === c).length}`)
  .join(' ')
console.log(`styles ${CARTOON_STYLES.length} (grid ${grid.length}, default 1) | ${counts}`)
console.log(`categories | ${perCategory}`)
if (failures.length) {
  console.error(`\ncheck:styles FAILED (${failures.length})`)
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log('check:styles OK')
