/**
 * Renders task 0017's style previews batch by batch, each style on its own
 * subject. Task 0017, sections 3.5 and 3.6.
 *
 *   --plan <n>                                   FREE. Prints batch n: every id, its
 *                                                subject, its source and its full
 *                                                prompt, the estimated cost and the
 *                                                PLAN HASH. Writes nothing.
 *   --render <n> --approved-plan <hex>           PAID. Renders batch n. Refuses unless
 *            [--only <id>]                       the hex is the start of the plan hash
 *                                                (the prompts are the ones the operator
 *                                                saw), every earlier batch's result was
 *                                                accepted, and every source still hashes
 *                                                to its approved value. Stops before any
 *                                                call that would pass the batch or the
 *                                                task ceiling.
 *   --accept <n> --result <hex>                  FREE. Records the operator's approval of
 *                                                batch n's result by its RESULT HASH.
 *   --status                                     FREE. Batches, spend and ceilings.
 *
 * The model, quality and size come from lib/image-constraints.ts; paths from
 * stylePreviewPath; subjects, sources and batches from lib/style-previews.ts;
 * the key through lib/env.ts only. It never generates a source image.
 * Everything is recorded in lib/preview-manifest.json after every call.
 *
 * Run from the repository root, with the key in .env.local:
 *   node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/render-batch.mjs --plan 1
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI, { toFile } from 'openai'
import { IMAGE_MODEL, IMAGE_QUALITY, IMAGE_SIZE, sniffImageType, uploadFilename } from '../lib/image-constraints.ts'
import { getCartoonStyle, isCartoonStyleId } from '../lib/cartoon-styles.ts'
import { stylePreviewPath, PREVIEW_BATCHES, PREVIEW_SUBJECTS, PREVIEW_SOURCES } from '../lib/style-previews.ts'
import { getEnv } from '../lib/env.ts'

// ---------------------------------------------------------------- the spend

const TASK = '0017'
/** Operator's ceilings for task 0017 (brief, and 0013 section 6). Literals on purpose. */
const BATCH_CEILING_USD = 0.5
const TASK_CEILING_USD = 3.5
/** For the plan's estimate only; the ceilings are enforced with it before each call. */
const ESTIMATE_PER_RENDER_USD = 0.0219
/** The rates task 0008 recorded; the manifest keeps them. */
const RATES = {
  text_input_per_m: 5,
  image_input_per_m: 8,
  image_output_per_m: 30,
  source: 'https://developers.openai.com/api/docs/pricing',
  retrieved: '2026-09-29',
}
const PREVIEW_ENCODING = { output_format: 'webp', output_compression: 80 }
const CLIENT_TIMEOUT_MS = 300000

// ------------------------------------------------------------------- paths

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = path.join(ROOT, 'lib', 'preview-manifest.json')
const abs = (rel) => path.join(ROOT, ...rel.split('/'))
const fullFile = (id) => 'public' + stylePreviewPath(id, 'full')

// ----------------------------------------------------------------- helpers

function fail(message) {
  console.error('render-batch: ' + message)
  process.exit(1)
}
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const now = () => new Date().toISOString()
const usd = (n) => (typeof n === 'number' ? n.toFixed(4) + ' USD' : 'unknown')

function costOf(usage) {
  if (!usage || typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') return null
  const details = usage.input_tokens_details || {}
  const text = typeof details.text_tokens === 'number' ? details.text_tokens : 0
  const image = typeof details.image_tokens === 'number' ? details.image_tokens : usage.input_tokens - text
  const cost = (text * RATES.text_input_per_m + image * RATES.image_input_per_m + usage.output_tokens * RATES.image_output_per_m) / 1e6
  return Math.round(cost * 1e6) / 1e6
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) fail('lib/preview-manifest.json does not exist')
  const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  if (m.model !== IMAGE_MODEL) fail('lib/preview-manifest.json was written for ' + m.model + ', not ' + IMAGE_MODEL)
  m.previews = m.previews || {}
  m.discarded = m.discarded || []
  m.batches = m.batches || {}
  return m
}
function saveManifest(m) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + '\n')
}

const taskRecords = (m) => [...Object.values(m.previews), ...m.discarded].filter((r) => r && r.task === TASK)
const taskSpent = (m) => taskRecords(m).reduce((s, r) => s + (typeof r.cost_usd === 'number' ? r.cost_usd : 0), 0)
const batchSpent = (m, n) => taskRecords(m).filter((r) => r.batch === n).reduce((s, r) => s + (typeof r.cost_usd === 'number' ? r.cost_usd : 0), 0)

function batchIds(n) {
  if (!Number.isInteger(n) || n < 1 || n > PREVIEW_BATCHES.length) fail('batch must be 1..' + PREVIEW_BATCHES.length)
  return PREVIEW_BATCHES[n - 1]
}

/** Every subject source, checked against its approved sha256 prefix. */
function sources() {
  const out = {}
  for (const [key, s] of Object.entries(PREVIEW_SOURCES)) {
    if (!fs.existsSync(abs(s.path))) fail('source ' + key + ' ' + s.path + ' is missing')
    const bytes = fs.readFileSync(abs(s.path))
    const hash = sha256(bytes)
    if (hash.indexOf(s.sha256_prefix) !== 0) fail('source ' + key + ' ' + s.path + ' hashes to ' + hash.slice(0, 12) + ', not the approved ' + s.sha256_prefix)
    const type = sniffImageType(new Uint8Array(bytes))
    if (type !== 'image/jpeg') fail('source ' + key + ' is not a JPEG')
    out[key] = { ...s, sha256: hash, bytes, type }
  }
  return out
}

function planOf(n, src) {
  const items = batchIds(n).map((id) => {
    if (!isCartoonStyleId(id)) fail(id + ' in batch ' + n + ' is not a style id')
    const subject = PREVIEW_SUBJECTS[id]
    if (!subject || !src[subject]) fail(id + ' has no known subject')
    return { id, subject, source: src[subject].path, source_sha256: src[subject].sha256, prompt: getCartoonStyle(id).prompt }
  })
  const hash = sha256(Buffer.from(JSON.stringify(items.map((i) => [i.id, i.subject, i.source_sha256, i.prompt]))))
  return { items, hash }
}

function resultHash(m, n) {
  const ids = batchIds(n)
  const shas = []
  for (const id of ids) {
    const r = m.previews[id]
    if (!r || r.task !== TASK || r.batch !== n) return null
    if (!fs.existsSync(abs(r.file)) || sha256(fs.readFileSync(abs(r.file))) !== r.sha256) return null
    shas.push(r.sha256)
  }
  return sha256(Buffer.from(shas.join('')))
}

const hexPrefix = (v, what) => {
  const p = String(v || '').toLowerCase()
  if (p.length < 12 || !/^[0-9a-f]+$/.test(p)) fail(what + ' needs at least 12 hex characters')
  return p
}

// ------------------------------------------------------------------- modes

function runPlan(n) {
  const src = sources()
  const { items, hash } = planOf(n, src)
  console.log('batch ' + n + ': ' + items.length + ' render(s), estimated ' + usd(items.length * ESTIMATE_PER_RENDER_USD))
  for (const i of items) console.log('\n' + i.id + '  [subject ' + i.subject + ': ' + i.source + ', sha256 ' + i.source_sha256.slice(0, 12) + ']\n  ' + i.prompt)
  const m = loadManifest()
  console.log('\nspent in task ' + TASK + ' so far: ' + usd(taskSpent(m)) + ' of ' + usd(TASK_CEILING_USD) + '; batch ceiling ' + usd(BATCH_CEILING_USD))
  console.log('PLAN HASH ' + hash)
}

async function runRender(n, approvedPlan, only) {
  const m = loadManifest()
  const src = sources()
  const { items, hash } = planOf(n, src)
  const prefix = hexPrefix(approvedPlan, '--approved-plan')
  if (hash.indexOf(prefix) !== 0) fail('--approved-plan ' + prefix + ' is not the plan hash of batch ' + n + ' (' + hash.slice(0, 12) + '...); run --plan ' + n + ' and have it approved again')
  for (let k = 1; k < n; k++) {
    const acc = m.batches[k]
    const rh = resultHash(m, k)
    if (!acc || !acc.accepted_at || !rh || rh !== acc.result_sha256) fail('batch ' + k + ' has no accepted, unchanged result; batch ' + n + ' cannot start')
  }
  if (m.batches[n] && m.batches[n].accepted_at) fail('batch ' + n + ' is already accepted; it is not rendered again')
  if (only && !items.find((i) => i.id === only)) fail('--only ' + only + ' is not in batch ' + n)
  const todo = items.filter((i) => {
    if (only) return i.id === only
    const r = m.previews[i.id]
    return !(r && r.task === TASK && r.batch === n && fs.existsSync(abs(r.file)) && sha256(fs.readFileSync(abs(r.file))) === r.sha256)
  })
  const openai = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY, timeout: CLIENT_TIMEOUT_MS, maxRetries: 0 })
  for (const i of todo) {
    if (batchSpent(m, n) + ESTIMATE_PER_RENDER_USD > BATCH_CEILING_USD) fail('STOP before ' + i.id + ': batch ' + n + ' would pass ' + usd(BATCH_CEILING_USD) + ' (spent ' + usd(batchSpent(m, n)) + '). Ask the operator.')
    if (taskSpent(m) + ESTIMATE_PER_RENDER_USD > TASK_CEILING_USD) fail('STOP before ' + i.id + ': task ' + TASK + ' would pass ' + usd(TASK_CEILING_USD) + ' (spent ' + usd(taskSpent(m)) + '). Ask the operator.')
    const s = src[i.subject]
    const at = now()
    const started = Date.now()
    let result
    try {
      result = await openai.images.edit({
        image: await toFile(s.bytes, uploadFilename(s.type), { type: s.type }),
        model: IMAGE_MODEL,
        prompt: i.prompt,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY,
        ...PREVIEW_ENCODING,
      })
    } catch (err) {
      m.last_error = { mode: 'render-batch', id: i.id, batch: n, at, message: String((err && err.message) || err) }
      saveManifest(m)
      fail(i.id + ' failed: ' + m.last_error.message)
    }
    const b64 = result.data && result.data[0] && result.data[0].b64_json
    if (!b64) { m.last_error = { mode: 'render-batch', id: i.id, batch: n, at, message: 'no image returned' }; saveManifest(m); fail(i.id + ': the provider returned no image') }
    const out = Buffer.from(b64, 'base64')
    if (sniffImageType(new Uint8Array(out)) !== 'image/webp') { m.last_error = { mode: 'render-batch', id: i.id, batch: n, at, message: 'not webp' }; saveManifest(m); fail(i.id + ': the result is not WebP; nothing was written') }
    const usage = result.usage ?? null
    const cost = costOf(usage)
    const old = m.previews[i.id]
    if (old) m.discarded.push({ role: 'preview ' + i.id, replaced_at: at, ...old })
    const rel = fullFile(i.id)
    fs.writeFileSync(abs(rel), out)
    m.previews[i.id] = {
      file: rel, sha256: sha256(out), input_sha256: s.sha256, subject: i.subject, task: TASK, batch: n,
      plan_sha256: hash, request: { size: IMAGE_SIZE, quality: IMAGE_QUALITY, ...PREVIEW_ENCODING },
      response_quality: result.quality ?? null, response_size: result.size ?? null,
      usage, cost_usd: cost, latency_ms: Date.now() - started, at,
    }
    m.last_error = null
    saveManifest(m)
    console.log(i.id.padEnd(24) + usd(cost).padStart(12) + '   batch ' + usd(batchSpent(m, n)) + '   task ' + usd(taskSpent(m)))
    if (typeof cost !== 'number') fail(i.id + ' recorded no usage, so the spend can no longer be controlled; stopping')
    if (m.previews[i.id].response_quality !== IMAGE_QUALITY) fail(i.id + ': the provider reported quality ' + m.previews[i.id].response_quality + '; stopping')
  }
  const rh = resultHash(m, n)
  console.log('\nbatch ' + n + ': ' + (rh ? 'complete' : 'incomplete') + '; spent in batch ' + usd(batchSpent(m, n)) + ', in task ' + usd(taskSpent(m)))
  if (rh) {
    for (const i of items) console.log('  ' + i.id.padEnd(24) + m.previews[i.id].sha256)
    console.log('RESULT HASH ' + rh)
  }
}

function runAccept(n, result) {
  const m = loadManifest()
  const prefix = hexPrefix(result, '--result')
  const rh = resultHash(m, n)
  if (!rh) fail('batch ' + n + ' is not completely rendered, or a file changed since it was rendered')
  if (rh.indexOf(prefix) !== 0) fail('--result ' + prefix + ' is not batch ' + n + "'s result hash (" + rh.slice(0, 12) + '...)')
  m.batches[n] = { result_sha256: rh, accepted_prefix: prefix, accepted_at: now() }
  saveManifest(m)
  console.log('batch ' + n + ' accepted: ' + rh)
}

function runStatus() {
  const m = loadManifest()
  PREVIEW_BATCHES.forEach((ids, k) => {
    const n = k + 1
    const b = m.batches[n]
    console.log('batch ' + String(n).padStart(2) + ': ' + ids.length + ' styles, ' + (b && b.accepted_at ? 'accepted ' + b.result_sha256.slice(0, 12) : resultHash(m, n) ? 'rendered, not accepted' : 'not rendered') + ', spent ' + usd(batchSpent(m, n)))
  })
  console.log('task ' + TASK + ': spent ' + usd(taskSpent(m)) + ' of ' + usd(TASK_CEILING_USD))
}

// -------------------------------------------------------------------- main

const argv = process.argv.slice(2)
const val = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined }
if (argv.includes('--plan')) runPlan(Number(val('--plan')))
else if (argv.includes('--render')) await runRender(Number(val('--render')), val('--approved-plan'), val('--only'))
else if (argv.includes('--accept')) runAccept(Number(val('--accept')), val('--result'))
else if (argv.includes('--status')) runStatus()
else fail('choose --plan <n>, --render <n> --approved-plan <hex> [--only <id>], --accept <n> --result <hex>, or --status')
