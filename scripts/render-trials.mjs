/**
 * Task 0018: trial renders for prompt variants and subject moves, the operator's
 * choices, and promotion of the chosen trial into the preview. Sections 3.3-3.6.
 *
 *   --plan <n>                                  FREE. Batch n's items: id, variant, subject,
 *                                               source, full prompt; estimated cost; PLAN HASH.
 *                                               Batch 4 is derived: variant B of every style
 *                                               rejected in batches 1-3.
 *   --render <n> --approved-plan <hex>          PAID. Renders batch n into assets/trials/0018/.
 *            [--only <id>.<variant>]             Refuses unless the plan hash matches, every
 *                                               earlier batch is accepted, the sources hash to
 *                                               their approved values, and the next call stays
 *                                               under $0.50 for the batch and $1.50 for the task.
 *   --accept <n> --result <hex>                 FREE. Records the operator's acceptance of batch n
 *            [--reject id,id]                    by its RESULT HASH. Batches 1-3: the listed ids are
 *            [--choose id=A|B|keep,...]          rejected (B is tried in batch 4). Batch 4: every
 *                                               style in it needs --choose.
 *   --finalize                                  FREE. Writes reports/0018-choices.json once every
 *                                               batch is accepted.
 *   --promote                                   FREE. Copies each chosen trial to its preview file
 *                                               and records it, refusing any style whose code
 *                                               prompt or subject differs from the choice.
 *   --status                                    FREE.
 *
 * Prompts: variant A/B = the data file's body + ' ' + CLOSING[style.closing];
 * EN = the data file's full English prompt (an experiment, never promoted);
 * S (subject move) = the style's current code prompt on the new subject.
 * The key is read through lib/env.ts only.
 *
 *   node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/render-trials.mjs --plan 1
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI, { toFile } from 'openai'
import { IMAGE_MODEL, IMAGE_QUALITY, IMAGE_SIZE, sniffImageType, uploadFilename } from '../lib/image-constraints.ts'
import { getCartoonStyle, CLOSING } from '../lib/cartoon-styles.ts'
import { stylePreviewPath, PREVIEW_SUBJECTS, PREVIEW_SOURCES } from '../lib/style-previews.ts'
import { getEnv } from '../lib/env.ts'

const TASK = '0018'
/** Operator's ceilings for task 0018. Literals on purpose. */
const BATCH_CEILING_USD = 0.5
const TASK_CEILING_USD = 1.5
const ESTIMATE_PER_RENDER_USD = 0.0219
const RATES = { text_input_per_m: 5, image_input_per_m: 8, image_output_per_m: 30 }
const PREVIEW_ENCODING = { output_format: 'webp', output_compression: 80 }
const CLIENT_TIMEOUT_MS = 300000

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = path.join(ROOT, 'lib', 'preview-manifest.json')
const DATA_PATH = path.join(ROOT, 'data', 'prompt-trials-0018.json')
const CHOICES_REL = 'reports/0018-choices.json'
const TRIAL_DIR_REL = 'assets/trials/0018'
const abs = (rel) => path.join(ROOT, ...rel.split('/'))

function fail(message) {
  console.error('render-trials: ' + message)
  process.exit(1)
}
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex')
const now = () => new Date().toISOString()
const usd = (n) => (typeof n === 'number' ? n.toFixed(4) + ' USD' : 'unknown')
function costOf(usage) {
  if (!usage || typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') return null
  const d = usage.input_tokens_details || {}
  const text = typeof d.text_tokens === 'number' ? d.text_tokens : 0
  const image = typeof d.image_tokens === 'number' ? d.image_tokens : usage.input_tokens - text
  return Math.round(((text * RATES.text_input_per_m + image * RATES.image_input_per_m + usage.output_tokens * RATES.image_output_per_m) / 1e6) * 1e6) / 1e6
}

const DATA = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
function loadManifest() {
  const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  if (m.model !== IMAGE_MODEL) fail('lib/preview-manifest.json was written for ' + m.model + ', not ' + IMAGE_MODEL)
  m.discarded = m.discarded || []
  m.trials = m.trials || {}
  m.batches_0018 = m.batches_0018 || {}
  return m
}
const saveManifest = (m) => fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + '\n')
const taskRecords = (m) => [...Object.values(m.previews), ...Object.values(m.trials), ...m.discarded].filter((r) => r && r.task === TASK)
const spent = (rs) => rs.reduce((s, r) => s + (typeof r.cost_usd === 'number' ? r.cost_usd : 0), 0)
const taskSpent = (m) => spent(taskRecords(m).filter((r) => r.batch))
const batchSpent = (m, n) => spent(taskRecords(m).filter((r) => r.batch === n))

function sources() {
  const out = {}
  for (const [k, s] of Object.entries(PREVIEW_SOURCES)) {
    if (!fs.existsSync(abs(s.path))) fail('source ' + k + ' is missing')
    const bytes = fs.readFileSync(abs(s.path))
    const h = sha256(bytes)
    if (h.indexOf(s.sha256_prefix) !== 0) fail('source ' + k + ' hashes to ' + h.slice(0, 12) + ', not the approved ' + s.sha256_prefix)
    if (sniffImageType(new Uint8Array(bytes)) !== 'image/jpeg') fail('source ' + k + ' is not a JPEG')
    out[k] = { ...s, sha256: h, bytes, type: 'image/jpeg' }
  }
  return out
}

function promptOf(id, variant) {
  const style = getCartoonStyle(id)
  if (variant === 'A' || variant === 'B') {
    const v = DATA.variants[id]
    if (!v || !v[variant]) fail(id + ' has no variant ' + variant)
    return v[variant] + ' ' + CLOSING[style.closing]
  }
  if (variant === 'EN') {
    if (!DATA.experiment || DATA.experiment.id !== id) fail(id + ' has no EN experiment')
    return DATA.experiment.prompt
  }
  if (variant === 'S') return style.prompt
  fail('unknown variant ' + variant)
}
const subjectOf = (id, variant) => (variant === 'S' ? DATA.moves[id] : PREVIEW_SUBJECTS[id])

/** Batch n's [id, variant] pairs. Batch 4 is derived from the rejections in 1-3. */
function batchItems(m, n) {
  if (n >= 1 && n <= DATA.batches.length) return DATA.batches[n - 1]
  if (n === DATA.batches.length + 1) {
    const out = []
    for (let k = 1; k <= DATA.batches.length; k++) {
      const acc = m.batches_0018[k]
      if (!acc || !acc.accepted_at) fail('batch ' + n + ' is derived from batches 1-' + DATA.batches.length + ', and batch ' + k + ' is not accepted')
      for (const [id, v] of DATA.batches[k - 1]) if (v === 'A' && acc.decisions[id] === 'reject') out.push([id, 'B'])
    }
    return out
  }
  fail('batch must be 1..' + (DATA.batches.length + 1))
}
const keyOf = (id, v) => id + '.' + v
const trialFile = (id, v) => TRIAL_DIR_REL + '/' + keyOf(id, v) + '.webp'

function planOf(m, n, src) {
  const items = batchItems(m, n).map(([id, variant]) => {
    const subject = subjectOf(id, variant)
    if (!subject || !src[subject]) fail(id + '.' + variant + ' has no known subject')
    return { id, variant, subject, source: src[subject].path, source_sha256: src[subject].sha256, prompt: promptOf(id, variant) }
  })
  const hash = sha256(Buffer.from(JSON.stringify(items.map((i) => [i.id, i.variant, i.subject, i.source_sha256, i.prompt]))))
  return { items, hash }
}

function resultHash(m, n) {
  const shas = []
  for (const [id, v] of batchItems(m, n)) {
    const r = m.trials[keyOf(id, v)]
    if (!r || r.task !== TASK || r.batch !== n) return null
    if (!fs.existsSync(abs(r.file)) || sha256(fs.readFileSync(abs(r.file))) !== r.sha256) return null
    shas.push(r.sha256)
  }
  return shas.length ? sha256(Buffer.from(shas.join(''))) : null
}
const hexPrefix = (v, what) => {
  const p = String(v || '').toLowerCase()
  if (p.length < 12 || !/^[0-9a-f]+$/.test(p)) fail(what + ' needs at least 12 hex characters')
  return p
}

function runPlan(n) {
  const m = loadManifest()
  const { items, hash } = planOf(m, n, sources())
  console.log('batch ' + n + ': ' + items.length + ' render(s), estimated ' + usd(items.length * ESTIMATE_PER_RENDER_USD))
  for (const i of items) console.log('\n' + i.id + '.' + i.variant + '  [subject ' + i.subject + ': ' + i.source + ']\n  ' + i.prompt)
  console.log('\nspent in task ' + TASK + ' so far: ' + usd(taskSpent(m)) + ' of ' + usd(TASK_CEILING_USD) + '; batch ceiling ' + usd(BATCH_CEILING_USD))
  console.log('PLAN HASH ' + hash)
}

async function runRender(n, approvedPlan, only) {
  const m = loadManifest()
  const src = sources()
  const { items, hash } = planOf(m, n, src)
  const prefix = hexPrefix(approvedPlan, '--approved-plan')
  if (hash.indexOf(prefix) !== 0) fail('--approved-plan ' + prefix + ' is not the plan hash of batch ' + n + ' (' + hash.slice(0, 12) + '...); run --plan ' + n + ' and have it approved again')
  for (let k = 1; k < n; k++) {
    const acc = m.batches_0018[k]
    const rh = resultHash(m, k)
    if (!acc || !acc.accepted_at || rh !== acc.result_sha256) fail('batch ' + k + ' has no accepted, unchanged result; batch ' + n + ' cannot start')
  }
  if (m.batches_0018[n] && m.batches_0018[n].accepted_at) fail('batch ' + n + ' is already accepted; it is not rendered again')
  if (!items.length) fail('batch ' + n + ' is empty; nothing to render')
  if (only && !items.find((i) => keyOf(i.id, i.variant) === only)) fail('--only ' + only + ' is not in batch ' + n)
  const todo = items.filter((i) => {
    const key = keyOf(i.id, i.variant)
    if (only) return key === only
    const r = m.trials[key]
    return !(r && r.batch === n && fs.existsSync(abs(r.file)) && sha256(fs.readFileSync(abs(r.file))) === r.sha256)
  })
  fs.mkdirSync(abs(TRIAL_DIR_REL), { recursive: true })
  const openai = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY, timeout: CLIENT_TIMEOUT_MS, maxRetries: 0 })
  for (const i of todo) {
    const key = keyOf(i.id, i.variant)
    if (batchSpent(m, n) + ESTIMATE_PER_RENDER_USD > BATCH_CEILING_USD) fail('STOP before ' + key + ': batch ' + n + ' would pass ' + usd(BATCH_CEILING_USD) + ' (spent ' + usd(batchSpent(m, n)) + '). Ask the operator.')
    if (taskSpent(m) + ESTIMATE_PER_RENDER_USD > TASK_CEILING_USD) fail('STOP before ' + key + ': task ' + TASK + ' would pass ' + usd(TASK_CEILING_USD) + ' (spent ' + usd(taskSpent(m)) + '). Ask the operator.')
    const s = src[i.subject]
    const at = now()
    const started = Date.now()
    let result
    try {
      result = await openai.images.edit({ image: await toFile(s.bytes, uploadFilename(s.type), { type: s.type }), model: IMAGE_MODEL, prompt: i.prompt, size: IMAGE_SIZE, quality: IMAGE_QUALITY, ...PREVIEW_ENCODING })
    } catch (err) {
      m.last_error = { mode: 'render-trials', key, batch: n, at, message: String((err && err.message) || err) }
      saveManifest(m)
      fail(key + ' failed: ' + m.last_error.message)
    }
    const b64 = result.data && result.data[0] && result.data[0].b64_json
    if (!b64) { m.last_error = { mode: 'render-trials', key, batch: n, at, message: 'no image returned' }; saveManifest(m); fail(key + ': no image returned') }
    const out = Buffer.from(b64, 'base64')
    if (sniffImageType(new Uint8Array(out)) !== 'image/webp') { m.last_error = { mode: 'render-trials', key, batch: n, at, message: 'not webp' }; saveManifest(m); fail(key + ': not WebP; nothing written') }
    const usage = result.usage ?? null
    const cost = costOf(usage)
    const old = m.trials[key]
    if (old) m.discarded.push({ role: 'trial ' + key, replaced_at: at, ...old })
    const rel = trialFile(i.id, i.variant)
    fs.writeFileSync(abs(rel), out)
    m.trials[key] = { file: rel, sha256: sha256(out), id: i.id, variant: i.variant, subject: i.subject, input_sha256: s.sha256, prompt_sha256: sha256(Buffer.from(i.prompt)), task: TASK, batch: n, plan_sha256: hash, request: { size: IMAGE_SIZE, quality: IMAGE_QUALITY, ...PREVIEW_ENCODING }, response_quality: result.quality ?? null, response_size: result.size ?? null, usage, cost_usd: cost, latency_ms: Date.now() - started, at }
    m.last_error = null
    saveManifest(m)
    console.log(key.padEnd(28) + usd(cost).padStart(12) + '   batch ' + usd(batchSpent(m, n)) + '   task ' + usd(taskSpent(m)))
    if (typeof cost !== 'number') fail(key + ' recorded no usage; stopping')
    if (m.trials[key].response_quality !== IMAGE_QUALITY) fail(key + ': the provider reported quality ' + m.trials[key].response_quality + '; stopping')
  }
  const rh = resultHash(m, n)
  console.log('\nbatch ' + n + ': ' + (rh ? 'complete' : 'incomplete') + '; batch ' + usd(batchSpent(m, n)) + ', task ' + usd(taskSpent(m)))
  if (rh) {
    for (const i of items) console.log('  ' + keyOf(i.id, i.variant).padEnd(28) + m.trials[keyOf(i.id, i.variant)].sha256)
    console.log('RESULT HASH ' + rh)
  }
}

function parseList(v) { return v ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : [] }

function runAccept(n, result, reject, choose) {
  const m = loadManifest()
  const prefix = hexPrefix(result, '--result')
  const items = batchItems(m, n)
  const rh = resultHash(m, n)
  if (!rh) fail('batch ' + n + ' is not completely rendered, or a file changed since')
  if (rh.indexOf(prefix) !== 0) fail('--result ' + prefix + " is not batch " + n + "'s result hash (" + rh.slice(0, 12) + '...)')
  const decisions = {}
  if (n <= DATA.batches.length) {
    const rej = parseList(reject)
    for (const id of rej) if (!items.find(([i, v]) => i === id && (v === 'A' || v === 'S'))) fail('--reject ' + id + ' is not an A or S item of batch ' + n)
    for (const [id, v] of items) if (v !== 'EN') decisions[id] = rej.indexOf(id) >= 0 ? 'reject' : 'accept'
    if (choose) fail('--choose belongs to batch ' + (DATA.batches.length + 1))
  } else {
    const ch = {}
    for (const pair of parseList(choose)) { const [id, c] = pair.split('='); ch[id] = c }
    for (const [id] of items) {
      if (['A', 'B', 'keep'].indexOf(ch[id]) < 0) fail('--choose needs ' + id + '=A, B or keep')
      decisions[id] = ch[id]
    }
    for (const id of Object.keys(ch)) if (!items.find(([i]) => i === id)) fail('--choose ' + id + ' is not in batch ' + n)
    if (reject) fail('--reject belongs to batches 1-' + DATA.batches.length)
  }
  m.batches_0018[n] = { result_sha256: rh, accepted_prefix: prefix, accepted_at: now(), decisions }
  saveManifest(m)
  console.log('batch ' + n + ' accepted: ' + rh + '\n' + JSON.stringify(decisions))
}

/** Final choice per style from the accepted batches, or null if not every batch is accepted. */
function choicesOf(m) {
  const last = DATA.batches.length + 1
  for (let k = 1; k <= DATA.batches.length; k++) if (!(m.batches_0018[k] && m.batches_0018[k].accepted_at)) return null
  const b4 = batchItems(m, last)
  if (b4.length && !(m.batches_0018[last] && m.batches_0018[last].accepted_at)) return null
  const out = {}
  for (let k = 1; k <= DATA.batches.length; k++) {
    for (const [id, v] of DATA.batches[k - 1]) {
      if (v === 'EN') continue
      const d = m.batches_0018[k].decisions[id]
      if (v === 'S') out[id] = { kind: 'move', choice: d === 'accept' ? 'S' : 'keep', subject: d === 'accept' ? DATA.moves[id] : PREVIEW_SUBJECTS[id] }
      else out[id] = { kind: 'prompt', choice: d === 'accept' ? 'A' : m.batches_0018[last].decisions[id], subject: PREVIEW_SUBJECTS[id] }
    }
  }
  for (const [id, c] of Object.entries(out)) {
    if (c.choice === 'keep') continue
    const t = m.trials[keyOf(id, c.choice)]
    c.trial = t.file
    c.trial_sha256 = t.sha256
    c.prompt = promptOf(id, c.choice)
    if (c.kind === 'prompt') c.body = DATA.variants[id][c.choice]
  }
  return out
}

function runFinalize() {
  const m = loadManifest()
  const c = choicesOf(m)
  if (!c) fail('not every batch is accepted')
  const exp = DATA.experiment ? m.trials[keyOf(DATA.experiment.id, 'EN')] : null
  const out = { task: TASK, choices: c, experiment: exp ? { id: DATA.experiment.id, file: exp.file, sha256: exp.sha256, promoted: false } : null }
  fs.mkdirSync(abs('reports'), { recursive: true })
  fs.writeFileSync(abs(CHOICES_REL), JSON.stringify(out, null, 2) + '\n')
  console.log('written ' + CHOICES_REL)
  for (const [id, x] of Object.entries(c)) console.log('  ' + id.padEnd(22) + x.kind.padEnd(8) + x.choice + (x.kind === 'move' ? ' -> ' + x.subject : ''))
}

function runPromote() {
  const m = loadManifest()
  const c = choicesOf(m)
  if (!c) fail('not every batch is accepted')
  const saved = JSON.parse(fs.readFileSync(abs(CHOICES_REL), 'utf8'))
  if (JSON.stringify(saved.choices) !== JSON.stringify(c)) fail(CHOICES_REL + ' does not match the accepted batches; run --finalize')
  const bad = []
  for (const [id, x] of Object.entries(c)) {
    if (x.choice === 'keep') continue
    if (getCartoonStyle(id).prompt !== x.prompt) bad.push(id + ': the code prompt is not the chosen ' + x.choice)
    if (PREVIEW_SUBJECTS[id] !== x.subject) bad.push(id + ': PREVIEW_SUBJECTS says ' + PREVIEW_SUBJECTS[id] + ', the choice ' + x.subject)
  }
  if (bad.length) fail('apply the choices to the code first: ' + bad.join('; '))
  let n = 0
  for (const [id, x] of Object.entries(c)) {
    if (x.choice === 'keep') continue
    const t = m.trials[keyOf(id, x.choice)]
    const bytes = fs.readFileSync(abs(t.file))
    if (sha256(bytes) !== t.sha256) fail(t.file + ' changed since it was rendered')
    const rel = 'public' + stylePreviewPath(id, 'full')
    if (m.previews[id] && m.previews[id].sha256 === t.sha256) continue
    const old = m.previews[id]
    if (old) m.discarded.push({ role: 'preview ' + id, replaced_at: now(), ...old })
    fs.writeFileSync(abs(rel), bytes)
    m.previews[id] = { file: rel, sha256: t.sha256, input_sha256: t.input_sha256, subject: t.subject, task: TASK, from_trial: keyOf(id, x.choice), prompt_sha256: t.prompt_sha256, cost_usd: 0, at: now() }
    n++
  }
  saveManifest(m)
  console.log('promoted ' + n + ' preview(s)')
}

function runStatus() {
  const m = loadManifest()
  for (let n = 1; n <= DATA.batches.length + 1; n++) {
    const b = m.batches_0018[n]
    const ready = n <= DATA.batches.length || DATA.batches.every((_, k) => m.batches_0018[k + 1] && m.batches_0018[k + 1].accepted_at)
    const label = ready ? batchItems(m, n).length + ' item(s)' : 'derived after batches 1-' + DATA.batches.length
    console.log('batch ' + n + ': ' + label + ', ' + (b && b.accepted_at ? 'accepted ' + b.result_sha256.slice(0, 12) : 'not accepted') + ', spent ' + usd(batchSpent(m, n)))
  }
  console.log('task ' + TASK + ': spent ' + usd(taskSpent(m)) + ' of ' + usd(TASK_CEILING_USD))
}

const argv = process.argv.slice(2)
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined }
if (argv.includes('--plan')) runPlan(Number(val('--plan')))
else if (argv.includes('--render')) await runRender(Number(val('--render')), val('--approved-plan'), val('--only'))
else if (argv.includes('--accept')) runAccept(Number(val('--accept')), val('--result'), val('--reject'), val('--choose'))
else if (argv.includes('--finalize')) runFinalize()
else if (argv.includes('--promote')) runPromote()
else if (argv.includes('--status')) runStatus()
else fail('choose --plan, --render, --accept, --finalize, --promote or --status')
