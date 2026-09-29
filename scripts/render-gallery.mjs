/**
 * Renders the landing gallery once: five AI-generated sources, three styles
 * each, resized for the page. Task 0009, sections 4 to 7.
 *
 * --sources AND --renders ARE PAID CALLS. The operator runs every mode, in
 * this order:
 *
 *   --sources [--only <id>] [--force]
 *       images.generate per source, from the prompts below, at the route's
 *       model, size and quality, as JPEG -> assets/gallery/<id>/source.jpg.
 *       Skips a source that already exists unless --force, which discards it
 *       together with its approval and its renders. Then STOP and look.
 *
 *   --approve <id> <first 12 or more hex of that source's sha256>
 *       Free. Records the operator's approval of one source, by hash.
 *
 *   --renders [--only <id>] [--force]
 *       Refuses any source without an approval. images.edit of the approved
 *       source with each of its three styles' prompts, built exactly as
 *       app/api/cartoonify/route.ts builds a visitor's call, encoded as WebP
 *       -> assets/gallery/<id>/<style>.webp at full size. Skips renders
 *       already made from the approved source unless --force.
 *
 *   --web
 *       Free. sharp resizes every source and render to a square WebP of
 *       GALLERY_WEB_SIZE -> public/gallery/<id>/..., the only files served.
 *
 * Run from the repository root, with the key in .env.local:
 *   node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/render-gallery.mjs --sources
 *
 * No probe: task 0008's probe confirmed this model takes exactly these
 * parameters. The model, the quality, the size and the prompts are imported and
 * never restated; the key is read through lib/env.ts only
 * (next.env_centralised). Everything is recorded in lib/gallery-manifest.json,
 * rewritten after every call so an interrupted run loses nothing.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import {
  IMAGE_MODEL,
  IMAGE_QUALITY,
  IMAGE_SIZE,
  sniffImageType,
  uploadFilename,
} from '../lib/image-constraints.ts'
import { getCartoonStyle } from '../lib/cartoon-styles.ts'
import { GALLERY, GALLERY_WEB_SIZE } from '../lib/gallery.ts'
import { getEnv } from '../lib/env.ts'

// ---------------------------------------------------------------- the spend

/** Approved by the operator with task 0009 (section 7). A literal, on purpose:
 *  criterion 7 reads it from this file. */
const SPEND_CEILING_USD = 1.00

/** Standard rates per million tokens for this model; the same page and date as
 *  task 0008. Recorded in the manifest. */
const RATES = {
  text_input_per_m: 5,
  image_input_per_m: 8,
  image_output_per_m: 30,
  source: 'https://developers.openai.com/api/docs/pricing',
  retrieved: '2026-09-29',
}

/** How much larger than the most expensive call of its kind in task 0008 a
 *  call is assumed to be, before it is made. Spend is checked against this
 *  projection, so an underestimate cannot carry the total over the ceiling. */
const ESTIMATE_MARGIN = 1.25

// ------------------------------------------------------------ the requests

/** Carried verbatim from task 0009 section 4; the manifest records each and
 *  criterion 6 checks the recorded prompt is in this file. */
const SOURCE_PROMPTS = {
  'pet': 'Photorealistic photograph of a ginger tabby cat and a golden retriever dog sitting side by side on a light grey sofa, both looking toward the camera, soft window light from the left, shallow depth of field, cosy living room softly blurred behind them. No people, no collars with tags, no text, no logos.',
  // Double quotes so the file holds the prompt byte for byte, apostrophe included.
  'maiden-tower': "Photorealistic travel photograph of the Maiden's Tower (Kız Kulesi) on its small islet in the Bosphorus, Istanbul, seen from the Üsküdar shore at golden hour, calm blue water, a few seagulls, the European shore softly visible behind. No people in the foreground, no boats with visible names, no text, no logos, no watermark.",
  'paris-street': 'Photorealistic photograph of a quiet cobblestone street in Paris in the morning, cream Haussmann-style buildings with wrought-iron balconies and flower boxes, a café terrace with empty bistro chairs, soft overcast light. No identifiable people, no readable signs or shop names, no text, no logos, no watermark.',
  'man-portrait': 'Photorealistic portrait photograph of a fictional adult man, about 40 years old, head and shoulders, facing the camera with a relaxed friendly expression, short dark hair greying at the temples, neatly trimmed beard, navy crew-neck sweater, plain warm grey studio background, soft even light. Natural skin texture, sharp focus on the face, no hands in frame, no glasses, no jewellery, no text, no logos. The person is invented and must not resemble any real or famous person.',
  'still-life': 'Photorealistic still-life photograph on a dark wooden table: a white ceramic jug, three pears, a bunch of red grapes, a halved pomegranate and a folded linen cloth, lit by soft side light from a window on the left against a plain dark background, in the manner of a classical painted still life. No text, no logos, no watermark.',
}

/** The sources are JPEG so that every render also exercises a JPEG input. */
const SOURCE_FORMAT = 'jpeg'

/** The only difference from a visitor's call: how the result is encoded, not
 *  what is drawn. The same encoding task 0008 used for the previews. */
const RENDER_ENCODING = { output_format: 'webp', output_compression: 80 }

/** The web copies: the first step whose file fits WEB_MAX_BYTES (criterion 5)
 *  is kept, and its width and quality are recorded per file. Most files fit at
 *  the first step; dense textures (halftone, engraving, hatching) do not, and
 *  measured on task 0008's renders need 560 or 480 px. Criterion 5 allows
 *  480 to 640. The markup keeps width/height at GALLERY_WEB_SIZE: every file is
 *  square, so the aspect ratio it reserves is the same at any of these sizes. */
const WEB_STEPS = [
  [GALLERY_WEB_SIZE, 72], [GALLERY_WEB_SIZE, 60],
  [560, 72], [560, 60], [560, 48],
  [480, 72], [480, 60], [480, 48], [480, 40],
]
const WEB_MAX_BYTES = 80000

/** The script's own patience, not the route's budget. */
const CLIENT_TIMEOUT_MS = 300000

// ------------------------------------------------------------------- paths

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = path.join(ROOT, 'lib', 'gallery-manifest.json')
const PREVIEW_MANIFEST_PATH = path.join(ROOT, 'lib', 'preview-manifest.json')
const sourcePath = (id) => 'assets/gallery/' + id + '/source.jpg'
const renderPath = (id, style) => 'assets/gallery/' + id + '/' + style + '.webp'
const webPath = (id, style) => 'public/gallery/' + id + '/' + (style || 'source') + '.webp'
const abs = (rel) => path.join(ROOT, ...rel.split('/'))

// ----------------------------------------------------------------- helpers

function fail(message) {
  console.error('render-gallery: ' + message)
  process.exit(1)
}

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const now = () => new Date().toISOString()
const usd = (n) => (typeof n === 'number' ? n.toFixed(4) + ' USD' : 'unknown')
const entryOf = (id) => GALLERY.find((entry) => entry.id === id)

function client() {
  return new OpenAI({ apiKey: getEnv().OPENAI_API_KEY, timeout: CLIENT_TIMEOUT_MS, maxRetries: 0 })
}

/** Cost at the recorded rates. Input with no text/image split is charged at the
 *  higher image rate, so an unknown split can only overstate the spend. */
function costOf(usage) {
  if (!usage || typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') return null
  const details = usage.input_tokens_details || {}
  const text = typeof details.text_tokens === 'number' ? details.text_tokens : 0
  const image = typeof details.image_tokens === 'number' ? details.image_tokens : usage.input_tokens - text
  const cost =
    (text * RATES.text_input_per_m + image * RATES.image_input_per_m + usage.output_tokens * RATES.image_output_per_m) /
    1e6
  return Math.round(cost * 1e6) / 1e6
}

/** Projected cost of the next call of each kind, from what task 0008 measured
 *  for the same model at the same size and quality. */
function estimates() {
  if (!fs.existsSync(PREVIEW_MANIFEST_PATH)) fail('lib/preview-manifest.json is missing; the spend cannot be projected')
  const m = JSON.parse(fs.readFileSync(PREVIEW_MANIFEST_PATH, 'utf8'))
  if (m.model !== IMAGE_MODEL) fail('lib/preview-manifest.json describes ' + m.model + ', not ' + IMAGE_MODEL)
  const edits = Object.values(m.previews || {}).map((e) => e.cost_usd).filter((c) => typeof c === 'number')
  const generate = m.source && m.source.cost_usd
  if (!edits.length || typeof generate !== 'number') fail('lib/preview-manifest.json records no measured cost')
  return { generate: generate * ESTIMATE_MARGIN, edit: Math.max(...edits) * ESTIMATE_MARGIN }
}

function responseRecord(result) {
  return {
    quality: result.quality ?? null,
    size: result.size ?? null,
    output_format: result.output_format ?? null,
    keys: Object.keys(result).sort(),
  }
}

function describeError(err) {
  return {
    status: err && typeof err.status === 'number' ? err.status : null,
    type: (err && err.error && err.error.type) || (err && err.name) || null,
    message: String((err && err.error && err.error.message) || (err && err.message) || err),
  }
}

function checkId(id, flag) {
  if (!entryOf(id)) fail(flag + ' ' + id + ' is not a gallery source; one of ' + GALLERY.map((e) => e.id).join(', '))
}

// ---------------------------------------------------------------- manifest

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { sources: {}, renders: {}, web_files: {}, discarded: [] }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  if (manifest.model && manifest.model !== IMAGE_MODEL) {
    fail('lib/gallery-manifest.json was written for ' + manifest.model + ', not ' + IMAGE_MODEL + '; move it aside first.')
  }
  manifest.sources = manifest.sources || {}
  manifest.renders = manifest.renders || {}
  manifest.web_files = manifest.web_files || {}
  manifest.discarded = manifest.discarded || []
  return manifest
}

function saveManifest(manifest) {
  const out = {
    model: IMAGE_MODEL,
    quality: IMAGE_QUALITY,
    size: IMAGE_SIZE,
    ceiling_usd: SPEND_CEILING_USD,
    rates: RATES,
    sources: manifest.sources,
    renders: manifest.renders,
    web_files: manifest.web_files,
    discarded: manifest.discarded,
    last_error: manifest.last_error ?? null,
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(out, null, 2) + '\n')
}

/** Every call that cost money, including ones later replaced. */
function spent(manifest) {
  const calls = [
    ...Object.values(manifest.sources),
    ...Object.values(manifest.renders).flatMap((r) => Object.values(r)),
    ...manifest.discarded,
  ]
  return calls.reduce((sum, call) => sum + (call && typeof call.cost_usd === 'number' ? call.cost_usd : 0), 0)
}

function guardSpend(manifest, next, what) {
  const projected = spent(manifest) + next
  if (projected > SPEND_CEILING_USD) {
    fail('stopping before ' + what + ': the next call could take the spend to ' + usd(projected) + ', over ' + usd(SPEND_CEILING_USD))
  }
}

/** The approved, unchanged source bytes of one gallery entry, or a reason. */
function approvedSource(manifest, id) {
  const s = manifest.sources[id]
  if (!s) return { problem: 'no source; run --sources' }
  if (!fs.existsSync(abs(s.path))) return { problem: s.path + ' is missing' }
  const bytes = fs.readFileSync(abs(s.path))
  if (sha256(bytes) !== s.sha256) return { problem: s.path + ' has changed since it was generated' }
  if (!s.approved) return { problem: 'not approved; look at ' + s.path + ', then --approve ' + id + ' ' + s.sha256.slice(0, 12) }
  return { source: s, bytes }
}

// ------------------------------------------------------------------ modes

async function runSources(manifest, args) {
  const perCall = estimates().generate
  const todo = args.only ? [entryOf(args.only)] : GALLERY
  let made = 0
  for (const entry of todo) {
    const id = entry.id
    const existing = manifest.sources[id]
    if (existing && !args.force) {
      console.log(id.padEnd(14) + 'exists (' + existing.sha256.slice(0, 12) + '), skipped; --force regenerates it')
      continue
    }
    guardSpend(manifest, perCall, 'source ' + id)

    const at = now()
    const started = Date.now()
    let result
    try {
      result = await client().images.generate({
        model: IMAGE_MODEL,
        prompt: SOURCE_PROMPTS[id],
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY,
        output_format: SOURCE_FORMAT,
        n: 1,
      })
    } catch (err) {
      manifest.last_error = { mode: 'sources', id, at, ...describeError(err) }
      saveManifest(manifest)
      fail(id + ' failed: ' + manifest.last_error.message)
    }
    const latency = Date.now() - started
    const b64 = result.data && result.data[0] && result.data[0].b64_json
    if (!b64) {
      manifest.last_error = { mode: 'sources', id, at, status: null, type: 'empty_result', message: 'the provider returned no image' }
      saveManifest(manifest)
      fail(id + ': the provider returned no image')
    }
    const bytes = Buffer.from(b64, 'base64')
    if (sniffImageType(new Uint8Array(bytes)) !== 'image/jpeg') {
      manifest.last_error = { mode: 'sources', id, at, status: null, type: 'wrong_format', message: 'the source is not a JPEG' }
      saveManifest(manifest)
      fail(id + ': the provider did not return a JPEG; nothing was written')
    }

    // A replaced source takes its approval and its renders with it.
    if (existing) {
      manifest.discarded.push({ role: 'source ' + id, replaced_at: at, ...existing })
      for (const [style, render] of Object.entries(manifest.renders[id] || {})) {
        manifest.discarded.push({ role: 'render ' + id + '/' + style, replaced_at: at, ...render })
      }
      delete manifest.renders[id]
    }

    const rel = sourcePath(id)
    fs.mkdirSync(path.dirname(abs(rel)), { recursive: true })
    fs.writeFileSync(abs(rel), bytes)
    const usage = result.usage ?? null
    manifest.sources[id] = {
      path: rel,
      sha256: sha256(bytes),
      generator: IMAGE_MODEL,
      prompt: SOURCE_PROMPTS[id],
      request: { size: IMAGE_SIZE, quality: IMAGE_QUALITY, output_format: SOURCE_FORMAT },
      response_quality: result.quality ?? null,
      response: responseRecord(result),
      usage,
      cost_usd: costOf(usage),
      latency_ms: latency,
      at,
      approved: null,
    }
    manifest.last_error = null
    saveManifest(manifest)
    made++
    console.log(id.padEnd(14) + manifest.sources[id].sha256 + usd(manifest.sources[id].cost_usd).padStart(14) + '   spent ' + usd(spent(manifest)))
    if (typeof manifest.sources[id].cost_usd !== 'number') fail(id + ' recorded no usage, so the spend can no longer be controlled; stopping')
    if (manifest.sources[id].response_quality !== IMAGE_QUALITY) {
      fail(id + ': the provider reported quality ' + manifest.sources[id].response_quality + ', not ' + IMAGE_QUALITY + '; stopping')
    }
  }

  console.log('\ngenerated ' + made + ' this run; spent ' + usd(spent(manifest)) + ' of ' + usd(SPEND_CEILING_USD))
  console.log('\nSTOP. Open each file under assets/gallery/ and look at it before anything is rendered.')
  console.log('Approve each one that passes by its hash:')
  for (const entry of GALLERY) {
    const s = manifest.sources[entry.id]
    if (s && !s.approved) console.log('  --approve ' + entry.id + ' ' + s.sha256.slice(0, 12))
  }
  console.log('Regenerate one that does not with: --sources --only <id> --force')
}

function runApprove(manifest, args) {
  const s = manifest.sources[args.approveId]
  if (!s) fail('no source has been generated for ' + args.approveId)
  const prefix = String(args.prefix || '').toLowerCase()
  if (prefix.length < 12 || !/^[0-9a-f]+$/.test(prefix)) {
    fail('--approve needs at least the first 12 hex characters of the sha256, typed after looking at ' + s.path)
  }
  const bytes = fs.readFileSync(abs(s.path))
  if (sha256(bytes) !== s.sha256) fail(s.path + ' has changed since it was generated')
  if (s.sha256.indexOf(prefix) !== 0) fail(prefix + ' does not match ' + s.path)
  if (s.approved) {
    console.log(args.approveId + ' was already approved at ' + s.approved.at)
    return
  }
  s.approved = { sha256_prefix: prefix, at: now() }
  saveManifest(manifest)
  console.log(args.approveId + ' approved: ' + s.sha256.slice(0, 12))
}

async function runRenders(manifest, args) {
  const perCall = estimates().edit
  const todo = args.only ? [entryOf(args.only)] : GALLERY
  const blocked = todo.map((e) => [e.id, approvedSource(manifest, e.id).problem]).filter(([, p]) => p)
  if (blocked.length) fail('refusing to render:\n  - ' + blocked.map(([id, p]) => id + ': ' + p).join('\n  - '))

  let rendered = 0
  for (const entry of todo) {
    const { source, bytes } = approvedSource(manifest, entry.id)
    const type = sniffImageType(new Uint8Array(bytes))
    if (type !== 'image/jpeg') fail(source.path + ' is not a JPEG')
    manifest.renders[entry.id] = manifest.renders[entry.id] || {}

    for (const style of entry.styles) {
      const rel = renderPath(entry.id, style)
      const existing = manifest.renders[entry.id][style]
      const current =
        existing &&
        existing.input_sha256 === source.sha256 &&
        fs.existsSync(abs(rel)) &&
        sha256(fs.readFileSync(abs(rel))) === existing.sha256
      if (current && !args.force) continue
      guardSpend(manifest, perCall, entry.id + '/' + style)

      const at = now()
      const started = Date.now()
      let result
      try {
        result = await client().images.edit({
          image: await toFile(bytes, uploadFilename(type), { type }),
          model: IMAGE_MODEL,
          prompt: getCartoonStyle(style).prompt,
          size: IMAGE_SIZE,
          quality: IMAGE_QUALITY,
          ...RENDER_ENCODING,
        })
      } catch (err) {
        manifest.last_error = { mode: 'renders', id: entry.id, style, at, ...describeError(err) }
        saveManifest(manifest)
        fail(entry.id + '/' + style + ' failed: ' + manifest.last_error.message + '. Re-run with --only ' + entry.id + ' once the cause is understood.')
      }
      const latency = Date.now() - started
      const b64 = result.data && result.data[0] && result.data[0].b64_json
      if (!b64) {
        manifest.last_error = { mode: 'renders', id: entry.id, style, at, status: null, type: 'empty_result', message: 'the provider returned no image' }
        saveManifest(manifest)
        fail(entry.id + '/' + style + ': the provider returned no image')
      }
      const out = Buffer.from(b64, 'base64')
      if (sniffImageType(new Uint8Array(out)) !== 'image/webp') {
        manifest.last_error = { mode: 'renders', id: entry.id, style, at, status: null, type: 'wrong_format', message: 'the result is not WebP' }
        saveManifest(manifest)
        fail(entry.id + '/' + style + ': the result is not WebP; nothing was written')
      }

      if (existing) manifest.discarded.push({ role: 'render ' + entry.id + '/' + style, replaced_at: at, ...existing })
      fs.mkdirSync(path.dirname(abs(rel)), { recursive: true })
      fs.writeFileSync(abs(rel), out)
      const usage = result.usage ?? null
      manifest.renders[entry.id][style] = {
        file: rel,
        sha256: sha256(out),
        input_sha256: source.sha256,
        request: { size: IMAGE_SIZE, quality: IMAGE_QUALITY, ...RENDER_ENCODING },
        response_quality: result.quality ?? null,
        response_size: result.size ?? null,
        response: responseRecord(result),
        usage,
        cost_usd: costOf(usage),
        latency_ms: latency,
        at,
      }
      manifest.last_error = null
      saveManifest(manifest)
      rendered++
      const r = manifest.renders[entry.id][style]
      console.log((entry.id + '/' + style).padEnd(34) + usd(r.cost_usd).padStart(12) + '   spent ' + usd(spent(manifest)))
      if (typeof r.cost_usd !== 'number') fail(entry.id + '/' + style + ' recorded no usage, so the spend can no longer be controlled; stopping')
      if (r.response_quality !== IMAGE_QUALITY) fail(entry.id + '/' + style + ': the provider reported quality ' + r.response_quality + '; stopping')
    }
  }

  const done = GALLERY.reduce((n, e) => n + e.styles.filter((s) => (manifest.renders[e.id] || {})[s]).length, 0)
  console.log('\nrendered ' + rendered + ' this run; ' + done + ' of 15 recorded; spent ' + usd(spent(manifest)) + ' of ' + usd(SPEND_CEILING_USD))
  if (done === 15) console.log('Next: --web')
}

async function runWeb(manifest) {
  const jobs = []
  for (const entry of GALLERY) {
    const { source, problem } = approvedSource(manifest, entry.id)
    if (problem) fail(entry.id + ': ' + problem)
    jobs.push({ from: source.path, from_sha256: source.sha256, to: webPath(entry.id) })
    for (const style of entry.styles) {
      const r = (manifest.renders[entry.id] || {})[style]
      if (!r || r.input_sha256 !== source.sha256) fail(entry.id + '/' + style + ' has not been rendered from the approved source; run --renders')
      if (!fs.existsSync(abs(r.file)) || sha256(fs.readFileSync(abs(r.file))) !== r.sha256) fail(r.file + ' is missing or no longer matches the manifest')
      jobs.push({ from: r.file, from_sha256: r.sha256, to: webPath(entry.id, style) })
    }
  }

  const web = {}
  for (const job of jobs) {
    let out = null
    let width = null
    let quality = null
    for (const [w, q] of WEB_STEPS) {
      out = await sharp(abs(job.from))
        .resize(w, w, { fit: 'cover' })
        .webp({ quality: q, effort: 6 })
        .toBuffer()
      width = w
      quality = q
      if (out.length <= WEB_MAX_BYTES) break
    }
    if (out.length > WEB_MAX_BYTES) fail(job.to + ' is ' + out.length + ' bytes even at ' + width + ' px, quality ' + quality)
    fs.mkdirSync(path.dirname(abs(job.to)), { recursive: true })
    fs.writeFileSync(abs(job.to), out)
    web[job.to] = { from: job.from, from_sha256: job.from_sha256, sha256: sha256(out), bytes: out.length, width, quality }
    console.log(job.to.padEnd(46) + String(out.length).padStart(7) + ' B  ' + width + ' px  q' + quality)
  }
  manifest.web_files = web
  saveManifest(manifest)
  const total = Object.values(web).reduce((n, w) => n + w.bytes, 0)
  console.log('\n' + jobs.length + ' web files, ' + total + ' bytes')
}

// ------------------------------------------------------------------- main

function parseArgs(argv) {
  const args = { mode: null, force: false, only: null, approveId: null, prefix: null }
  const setMode = (m) => {
    if (args.mode) fail('choose one of --sources, --approve, --renders, --web')
    args.mode = m
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--sources' || a === '--renders' || a === '--web') setMode(a.slice(2))
    else if (a === '--approve') {
      setMode('approve')
      args.approveId = argv[++i]
      args.prefix = argv[++i]
    } else if (a === '--force') args.force = true
    else if (a === '--only') args.only = argv[++i]
    else fail('unknown argument ' + a)
  }
  if (!args.mode) fail('choose one of --sources, --approve, --renders, --web')
  if (args.only) checkId(args.only, '--only')
  if (args.mode === 'approve') checkId(args.approveId, '--approve')
  if ((args.only || args.force) && args.mode !== 'sources' && args.mode !== 'renders') fail('--only and --force belong to --sources and --renders')
  return args
}

const args = parseArgs(process.argv.slice(2))
for (const entry of GALLERY) if (!SOURCE_PROMPTS[entry.id]) fail('no source prompt for ' + entry.id)
const manifest = loadManifest()
if (args.mode === 'sources') await runSources(manifest, args)
else if (args.mode === 'approve') runApprove(manifest, args)
else if (args.mode === 'renders') await runRenders(manifest, args)
else await runWeb(manifest)
