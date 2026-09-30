/**
 * Renders the 31 style previews at exactly the parameters a visitor's request
 * uses, from one source portrait. Task 0008, sections 5 to 7.
 *
 * EVERY MODE IS A PAID CALL. The operator runs them, in this order:
 *
 *   --probe
 *       One images.edit call built exactly as app/api/cartoonify/route.ts
 *       builds it, on the committed placeholder: classic's full-size preview.
 *       Confirms the model accepts the route's parameters, and records what
 *       the provider returns, the usage, the cost and the latency. The output
 *       image is discarded.
 *
 *   --source [--force]
 *       Refuses unless the probe succeeded, the provider reported the quality
 *       and size that were sent, the probe answered inside the route's own
 *       time budget, and the probe's cost times 33 fits under the ceiling.
 *       Generates the source portrait from SOURCE_PROMPT alone and writes it
 *       to public/hero/before.jpg. Then STOP and look at it.
 *
 *   --previews --approved-source <first 12 or more hex of the source sha256>
 *              [--only <style id>] [--force]
 *       Refuses unless the typed prefix matches the source on disk. Renders
 *       each style into its full-size preview file (stylePreviewPath), skipping ones already
 *       rendered from this source. Stops before any call that would cross the
 *       spend ceiling.
 *
 * Run from the repository root, with the key in .env.local:
 *   node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/render-previews.mjs --probe
 *
 * The model, the quality and the size are imported from lib/image-constraints.ts
 * and never restated here; the key is read through lib/env.ts only
 * (next.env_centralised). Everything is recorded in lib/preview-manifest.json,
 * which is rewritten after every call so an interrupted run loses nothing.
 */
import { stylePreviewPath } from '../lib/style-previews.ts'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI, { toFile } from 'openai'
import {
  IMAGE_MODEL,
  IMAGE_QUALITY,
  IMAGE_SIZE,
  sniffImageType,
  uploadFilename,
} from '../lib/image-constraints.ts'
import { CARTOON_STYLES, DEFAULT_CARTOON_STYLE_ID, getCartoonStyle } from '../lib/cartoon-styles.ts'
import { getEnv } from '../lib/env.ts'

// ---------------------------------------------------------------- the spend

/** Approved by the operator with task 0008 (section 7). A literal, on purpose:
 *  criterion 10 reads it from this file. */
const SPEND_CEILING_USD = 5.00

/** 1 probe + 1 source + 31 previews. */
const CALLS_PLANNED = 33

/** Standard rates per million tokens for this model, from the provider's
 *  pricing page on the date below. Recorded in the manifest with every run. */
const RATES = {
  text_input_per_m: 5,
  image_input_per_m: 8,
  image_output_per_m: 30,
  source: 'https://developers.openai.com/api/docs/pricing',
  retrieved: '2026-09-29',
}

// ------------------------------------------------------------ the requests

/** Carried verbatim; the manifest records it and criterion 8 checks it is this. */
const SOURCE_PROMPT = 'Photorealistic lifestyle portrait photograph of a fictional adult woman, about 28 years old, head and upper body, body turned slightly to the side with the face toward the camera, natural warm smile, shoulder-length wavy dark brown hair with visible volume. Casual modest outfit: a mustard-yellow knit sweater. Outdoors in soft late-afternoon light, with a softly blurred green park background. Natural skin texture, sharp focus on the face, no hands in frame, no jewellery, no text, no logos. The person is invented and must not resemble any real or famous person.'

/** The only difference from a visitor's call: how the result is encoded, not
 *  what is drawn. PNG at full size for 31 cards would weigh tens of megabytes. */
const PREVIEW_ENCODING = { output_format: 'webp', output_compression: 80 }

/** The source is JPEG so that every render also exercises a JPEG input. */
const SOURCE_FORMAT = 'jpeg'

/** Generous: the provider warns complex prompts can take minutes. This is the
 *  script's own patience, not the route's budget, which the probe is held to. */
const CLIENT_TIMEOUT_MS = 300000

// ------------------------------------------------------------------- paths

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = path.join(ROOT, 'lib', 'preview-manifest.json')
const ROUTE_PATH = path.join(ROOT, 'app', 'api', 'cartoonify', 'route.ts')
const PROBE_INPUT = 'public' + stylePreviewPath('classic', 'full')
const SOURCE_PATH = 'public/hero/before.jpg'
const previewPath = (id) => 'public' + stylePreviewPath(id, 'full')
const abs = (rel) => path.join(ROOT, ...rel.split('/'))

// ----------------------------------------------------------------- helpers

function fail(message) {
  console.error('render-previews: ' + message)
  process.exit(1)
}

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const now = () => new Date().toISOString()
const usd = (n) => (typeof n === 'number' ? n.toFixed(4) + ' USD' : 'unknown')

function client() {
  return new OpenAI({ apiKey: getEnv().OPENAI_API_KEY, timeout: CLIENT_TIMEOUT_MS, maxRetries: 0 })
}

/** The route's own upstream budget, read from the route, never restated. */
function routeBudgetMs() {
  const route = fs.readFileSync(ROUTE_PATH, 'utf8')
  const at = route.indexOf('maxDuration = ')
  if (at < 0) fail('cannot find maxDuration in ' + ROUTE_PATH)
  return Math.floor(parseInt(route.slice(at + 'maxDuration = '.length), 10) * 1000 * 0.75)
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

/** What the provider said, as it said it. Missing fields are recorded as null. */
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

// ---------------------------------------------------------------- manifest

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { probe: null, source: null, previews: {}, discarded: [] }
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  if (manifest.model && manifest.model !== IMAGE_MODEL) {
    fail(
      'lib/preview-manifest.json was written for ' + manifest.model + ', not ' + IMAGE_MODEL +
        '. Its records do not describe this model; move it aside before running again.',
    )
  }
  manifest.previews = manifest.previews || {}
  manifest.discarded = manifest.discarded || []
  return manifest
}

function saveManifest(manifest) {
  const out = {
    model: IMAGE_MODEL,
    quality: IMAGE_QUALITY,
    size: IMAGE_SIZE,
    output_format: PREVIEW_ENCODING.output_format,
    ceiling_usd: SPEND_CEILING_USD,
    rates: RATES,
    probe: manifest.probe,
    source: manifest.source,
    previews: manifest.previews,
    discarded: manifest.discarded,
    last_error: manifest.last_error ?? null,
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(out, null, 2) + '\n')
}

/** Every call that cost money, including ones later replaced. */
function spent(manifest) {
  const calls = [manifest.probe, manifest.source, ...Object.values(manifest.previews), ...manifest.discarded]
  return calls.reduce((sum, call) => sum + (call && typeof call.cost_usd === 'number' ? call.cost_usd : 0), 0)
}

/** Why the source or the render may not start. Empty means the probe cleared it. */
function probeProblems(manifest) {
  const probe = manifest.probe
  if (!probe) return ['no probe has been run; run --probe first']
  const problems = []
  const budget = routeBudgetMs()
  if (probe.ok !== true) problems.push('the probe did not succeed' + (probe.error ? ': ' + probe.error.message : ''))
  if (probe.model !== IMAGE_MODEL) problems.push('the probe was run against ' + probe.model)
  const response = probe.response || {}
  if (response.quality !== IMAGE_QUALITY) problems.push('the provider reported quality ' + response.quality + ', not ' + IMAGE_QUALITY)
  if (response.size !== IMAGE_SIZE) problems.push('the provider reported size ' + response.size + ', not ' + IMAGE_SIZE)
  if (typeof probe.cost_usd !== 'number') problems.push('the probe recorded no usage, so the spend cannot be controlled')
  else if (probe.cost_usd * CALLS_PLANNED > SPEND_CEILING_USD) {
    problems.push(
      'the probe cost ' + usd(probe.cost_usd) + ' per call, so ' + CALLS_PLANNED + ' calls project to ' +
        usd(probe.cost_usd * CALLS_PLANNED) + ', over the ceiling of ' + usd(SPEND_CEILING_USD),
    )
  }
  if (typeof probe.latency_ms !== 'number' || !(probe.latency_ms < budget)) {
    problems.push('the probe took ' + probe.latency_ms + ' ms; the route gives the provider ' + budget + ' ms')
  }
  return problems
}

// ------------------------------------------------------------------ modes

async function runProbe(manifest) {
  const input = fs.readFileSync(abs(PROBE_INPUT))
  const type = sniffImageType(new Uint8Array(input))
  if (!type) fail(PROBE_INPUT + ' is not a PNG, JPEG or WebP')

  const record = {
    ok: false,
    endpoint: 'images.edit',
    model: IMAGE_MODEL,
    input: PROBE_INPUT,
    input_sha256: sha256(input),
    request: { size: IMAGE_SIZE, quality: IMAGE_QUALITY },
    at: now(),
  }
  if (manifest.probe) manifest.discarded.push({ role: 'probe', replaced_at: record.at, ...manifest.probe })

  const started = Date.now()
  try {
    // Built exactly as the route builds its call: same file wrapper, same four
    // parameters, nothing else.
    const result = await client().images.edit({
      image: await toFile(input, uploadFilename(type), { type }),
      model: IMAGE_MODEL,
      prompt: getCartoonStyle(DEFAULT_CARTOON_STYLE_ID).prompt,
      size: IMAGE_SIZE,
      quality: IMAGE_QUALITY,
    })
    record.latency_ms = Date.now() - started
    record.response = responseRecord(result)
    record.usage = result.usage ?? null
    record.cost_usd = costOf(record.usage)
    record.ok = Boolean(result.data && result.data[0] && result.data[0].b64_json)
    if (!record.ok) record.error = { status: null, type: 'empty_result', message: 'the provider returned no image' }
  } catch (err) {
    record.latency_ms = Date.now() - started
    record.error = describeError(err)
  }
  manifest.probe = record
  manifest.last_error = record.ok ? null : { mode: 'probe', at: record.at, ...record.error }
  saveManifest(manifest)

  console.log('probe: ' + (record.ok ? 'image returned' : 'FAILED'))
  console.log('  latency       ' + record.latency_ms + ' ms (route budget ' + routeBudgetMs() + ' ms)')
  if (record.response) {
    console.log('  reported      quality=' + record.response.quality + ' size=' + record.response.size)
    console.log('  response keys ' + record.response.keys.join(', '))
  }
  console.log('  usage         ' + JSON.stringify(record.usage ?? null))
  console.log('  cost          ' + usd(record.cost_usd) + '; x' + CALLS_PLANNED + ' = ' +
    usd(typeof record.cost_usd === 'number' ? record.cost_usd * CALLS_PLANNED : undefined) +
    ' against a ceiling of ' + usd(SPEND_CEILING_USD))
  if (record.error) console.log('  error         ' + JSON.stringify(record.error))

  const problems = probeProblems(manifest)
  if (problems.length) {
    console.error('\nThe source step will refuse to run. Stop here and take this back to the spec (task 0008 section 5):')
    for (const p of problems) console.error('  - ' + p)
    process.exit(1)
  }
  console.log('\nThe probe cleared every gate. Next: --source')
}

async function runSource(manifest, args) {
  const problems = probeProblems(manifest)
  if (problems.length) fail('refusing to generate the source:\n  - ' + problems.join('\n  - '))
  if (manifest.source && !args.force) {
    fail('a source already exists (' + manifest.source.sha256.slice(0, 12) + '). --force discards it and every preview rendered from it.')
  }
  const projected = spent(manifest) + manifest.probe.cost_usd
  if (projected > SPEND_CEILING_USD) fail('this call would take the spend to ' + usd(projected) + ', over ' + usd(SPEND_CEILING_USD))

  const at = now()
  if (manifest.source) {
    manifest.discarded.push({ role: 'source', replaced_at: at, ...manifest.source })
    for (const [id, entry] of Object.entries(manifest.previews)) manifest.discarded.push({ role: 'preview ' + id, replaced_at: at, ...entry })
    manifest.previews = {}
  }

  const started = Date.now()
  let result
  try {
    result = await client().images.generate({
      model: IMAGE_MODEL,
      prompt: SOURCE_PROMPT,
      size: IMAGE_SIZE,
      quality: IMAGE_QUALITY,
      output_format: SOURCE_FORMAT,
      n: 1,
    })
  } catch (err) {
    manifest.last_error = { mode: 'source', at, ...describeError(err) }
    saveManifest(manifest)
    fail('the source generation failed: ' + manifest.last_error.message)
  }
  const latency = Date.now() - started
  const b64 = result.data && result.data[0] && result.data[0].b64_json
  if (!b64) {
    manifest.last_error = { mode: 'source', at, status: null, type: 'empty_result', message: 'the provider returned no image' }
    saveManifest(manifest)
    fail('the provider returned no image')
  }
  const bytes = Buffer.from(b64, 'base64')
  if (sniffImageType(new Uint8Array(bytes)) !== 'image/jpeg') {
    manifest.last_error = { mode: 'source', at, status: null, type: 'wrong_format', message: 'the source is not a JPEG' }
    saveManifest(manifest)
    fail('the provider did not return a JPEG; nothing was written')
  }

  fs.mkdirSync(path.dirname(abs(SOURCE_PATH)), { recursive: true })
  fs.writeFileSync(abs(SOURCE_PATH), bytes)
  const usage = result.usage ?? null
  manifest.source = {
    path: SOURCE_PATH,
    sha256: sha256(bytes),
    generator: IMAGE_MODEL,
    prompt: SOURCE_PROMPT,
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

  console.log('source written: ' + SOURCE_PATH)
  console.log('  sha256        ' + manifest.source.sha256)
  console.log('  cost          ' + usd(manifest.source.cost_usd) + '; spent so far ' + usd(spent(manifest)))
  console.log('\nSTOP. Open ' + SOURCE_PATH + ' and look at it before anything else is rendered:')
  console.log('  an adult, not a child, not a recognisable person, and realistic.')
  console.log('If it passes, approve it by its hash:')
  console.log('  --previews --approved-source ' + manifest.source.sha256.slice(0, 12))
  if (typeof manifest.source.cost_usd !== 'number') {
    fail('the source call recorded no usage, so the spend can no longer be controlled; stop and take this back to the spec')
  }
}

async function runPreviews(manifest, args) {
  const problems = probeProblems(manifest)
  if (problems.length) fail('refusing to render:\n  - ' + problems.join('\n  - '))
  const source = manifest.source
  if (!source) fail('no source has been generated; run --source first')
  const bytes = fs.readFileSync(abs(source.path))
  if (sha256(bytes) !== source.sha256) fail(source.path + ' has changed since it was generated; it no longer matches the manifest')

  const prefix = String(args.approvedSource || '').toLowerCase()
  if (prefix.length < 12 || !/^[0-9a-f]+$/.test(prefix)) {
    fail('--approved-source needs at least the first 12 hex characters of the source sha256, typed after looking at ' + source.path)
  }
  if (source.sha256.indexOf(prefix) !== 0) fail('--approved-source ' + prefix + ' does not match the source on disk')
  if (!source.approved) {
    source.approved = { sha256_prefix: prefix, at: now() }
    saveManifest(manifest)
  }

  const type = sniffImageType(new Uint8Array(bytes))
  if (type !== 'image/jpeg') fail(source.path + ' is not a JPEG')
  const ids = CARTOON_STYLES.map((style) => style.id)
  if (args.only && ids.indexOf(args.only) < 0) fail('--only ' + args.only + ' is not a style id')
  const todo = args.only ? [args.only] : ids
  const perCall = manifest.probe.cost_usd

  let rendered = 0
  for (const id of todo) {
    const rel = previewPath(id)
    const existing = manifest.previews[id]
    const current =
      existing &&
      existing.input_sha256 === source.sha256 &&
      fs.existsSync(abs(rel)) &&
      sha256(fs.readFileSync(abs(rel))) === existing.sha256
    if (current && !args.force && !args.only) continue

    const projected = spent(manifest) + perCall
    if (projected > SPEND_CEILING_USD) {
      fail('stopping before ' + id + ': the next call would take the spend to ' + usd(projected) + ', over ' + usd(SPEND_CEILING_USD))
    }

    const at = now()
    const started = Date.now()
    let result
    try {
      result = await client().images.edit({
        image: await toFile(bytes, uploadFilename(type), { type }),
        model: IMAGE_MODEL,
        prompt: getCartoonStyle(id).prompt,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY,
        ...PREVIEW_ENCODING,
      })
    } catch (err) {
      manifest.last_error = { mode: 'previews', id, at, ...describeError(err) }
      saveManifest(manifest)
      fail(id + ' failed: ' + manifest.last_error.message + '. Re-run with --only ' + id + ' once the cause is understood.')
    }
    const latency = Date.now() - started
    const b64 = result.data && result.data[0] && result.data[0].b64_json
    if (!b64) {
      manifest.last_error = { mode: 'previews', id, at, status: null, type: 'empty_result', message: 'the provider returned no image' }
      saveManifest(manifest)
      fail(id + ': the provider returned no image')
    }
    const out = Buffer.from(b64, 'base64')
    if (sniffImageType(new Uint8Array(out)) !== 'image/webp') {
      manifest.last_error = { mode: 'previews', id, at, status: null, type: 'wrong_format', message: 'the result is not WebP; the encoding request was not honoured' }
      saveManifest(manifest)
      fail(id + ': the result is not WebP, so output_format did not reach the provider or was ignored. Nothing was written.')
    }

    if (existing) manifest.discarded.push({ role: 'preview ' + id, replaced_at: at, ...existing })
    fs.writeFileSync(abs(rel), out)
    const usage = result.usage ?? null
    manifest.previews[id] = {
      file: rel,
      sha256: sha256(out),
      input_sha256: source.sha256,
      request: { size: IMAGE_SIZE, quality: IMAGE_QUALITY, ...PREVIEW_ENCODING },
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
    console.log(id.padEnd(22) + usd(manifest.previews[id].cost_usd).padStart(12) + '   spent ' + usd(spent(manifest)))

    if (typeof manifest.previews[id].cost_usd !== 'number') {
      fail(id + ' recorded no usage, so the spend can no longer be controlled; stopping')
    }
    if (manifest.previews[id].response_quality !== IMAGE_QUALITY) {
      fail(id + ': the provider reported quality ' + manifest.previews[id].response_quality + ', not ' + IMAGE_QUALITY + '; stopping')
    }
  }

  const done = ids.filter((id) => manifest.previews[id]).length
  console.log('\nrendered ' + rendered + ' this run; ' + done + ' of ' + ids.length + ' previews recorded; spent ' + usd(spent(manifest)) + ' of ' + usd(SPEND_CEILING_USD))
}

// ------------------------------------------------------------------- main

function parseArgs(argv) {
  const args = { mode: null, force: false, only: null, approvedSource: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--probe' || a === '--source' || a === '--previews') {
      if (args.mode) fail('choose one of --probe, --source, --previews')
      args.mode = a.slice(2)
    } else if (a === '--force') args.force = true
    else if (a === '--only') args.only = argv[++i]
    else if (a === '--approved-source') args.approvedSource = argv[++i]
    else fail('unknown argument ' + a)
  }
  if (!args.mode) fail('choose one of --probe, --source, --previews')
  if (args.mode !== 'previews' && (args.only || args.approvedSource)) fail('--only and --approved-source belong to --previews')
  return args
}

const args = parseArgs(process.argv.slice(2))
const manifest = loadManifest()
if (args.mode === 'probe') await runProbe(manifest)
else if (args.mode === 'source') await runSource(manifest, args)
else await runPreviews(manifest, args)
