/**
 * Data-driven render jobs, one task at a time (task 0019 onwards). Sections 3.4-3.7.
 *
 *   --task <id> --plan <n>                         FREE. Batch n's items, prompts, estimate, PLAN HASH.
 *   --task <id> --render <n> --approved-plan <hex> PAID. Renders batch n. Refuses unless the plan hash
 *            [--only <key>]                          matches, every earlier batch is accepted, every source
 *                                                  is approved, and the next call stays under the data
 *                                                  file's ceilings (checked against the spec by a criterion).
 *   --task <id> --accept <n> --result <hex>        FREE. The operator's acceptance by RESULT HASH.
 *            [--reject id,id] [--choose id=A|B]       Moves may be rejected (the style keeps its subject);
 *                                                  a new style needs --choose; sources are accepted whole.
 *                                                  A restyle (task 0020) needs --choose id=<variant>|keep.
 *   --task <id> --finalize                         FREE. Writes reports/<id>-choices.json.
 *   --task <id> --promote                          FREE. Copies chosen trials to previews and writes the
 *                                                  sources' web copies (gallery, featured), refusing unless the code already
 *                                                  equals the choices.
 *   --task <id> --status                           FREE.
 *
 * Items: ['src', K] generates subject K's source photo (images.generate, JPEG, no input image);
 * [id, 'A'|'B', K] renders a new style's variant on subject K; [id, 'S', K] renders a style's
 * current code prompt on subject K (a subject move); [id, <letter>, K] renders a variant of an
 * existing style's prompt (DATA.restyles, task 0020), which may also be kept as it is.
 * The key is read through lib/env.ts only.
 *
 *   node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/render-jobs.mjs --task 0019 --plan 1
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import { IMAGE_MODEL, IMAGE_QUALITY, IMAGE_SIZE, sniffImageType, uploadFilename } from '../lib/image-constraints.ts'
import { getCartoonStyle, isCartoonStyleId, CLOSING } from '../lib/cartoon-styles.ts'
import { stylePreviewPath, PREVIEW_SUBJECTS, PREVIEW_SOURCES } from '../lib/style-previews.ts'
import { getEnv } from '../lib/env.ts'

/** Hard upper bounds; a data file may set lower ceilings, never higher. */
const MAX_BATCH_CEILING_USD = 0.5
const MAX_TASK_CEILING_USD = 3.0
const ESTIMATE_PER_RENDER_USD = 0.0219
const RATES = { text_input_per_m: 5, image_input_per_m: 8, image_output_per_m: 30 }
const PREVIEW_ENCODING = { output_format: 'webp', output_compression: 80 }
const SOURCE_ENCODING = { output_format: 'jpeg' }
const CLIENT_TIMEOUT_MS = 300000
const FEATURED_WIDTH = 480
const FEATURED_QUALITY = 72

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = path.join(ROOT, 'lib', 'preview-manifest.json')
const abs = (rel) => path.join(ROOT, ...rel.split('/'))
function fail(message) { console.error('render-jobs: ' + message); process.exit(1) }
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

const argv = process.argv.slice(2)
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined }
const TASK = String(val('--task') || '')
if (!/^[0-9]{4}$/.test(TASK)) fail('--task <four digits> is required')
const DATA_REL = 'data/render-jobs-' + TASK + '.json'
if (!fs.existsSync(abs(DATA_REL))) fail(DATA_REL + ' does not exist')
const DATA = JSON.parse(fs.readFileSync(abs(DATA_REL), 'utf8'))
if (DATA.task !== TASK) fail(DATA_REL + ' is for task ' + DATA.task)
const BATCH_CEILING_USD = Math.min(Number(DATA.ceilings && DATA.ceilings.batch), MAX_BATCH_CEILING_USD)
const TASK_CEILING_USD = Math.min(Number(DATA.ceilings && DATA.ceilings.task), MAX_TASK_CEILING_USD)
if (!(BATCH_CEILING_USD > 0) || !(TASK_CEILING_USD > 0)) fail(DATA_REL + ' has no valid ceilings')
const CHOICES_REL = 'reports/' + TASK + '-choices.json'
const TRIAL_DIR_REL = 'assets/trials/' + TASK
const BKEY = 'batches_' + TASK

function loadManifest() {
  const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  if (m.model !== IMAGE_MODEL) fail('lib/preview-manifest.json was written for ' + m.model + ', not ' + IMAGE_MODEL)
  m.discarded = m.discarded || []
  m.trials = m.trials || {}
  m[BKEY] = m[BKEY] || {}
  return m
}
const saveManifest = (m) => fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + '\n')
const taskRecords = (m) => [...Object.values(m.trials), ...m.discarded].filter((r) => r && r.task === TASK && r.batch)
const spent = (rs) => rs.reduce((s, r) => s + (typeof r.cost_usd === 'number' ? r.cost_usd : 0), 0)
const taskSpent = (m) => spent(taskRecords(m))
const batchSpent = (m, n) => spent(taskRecords(m).filter((r) => r.batch === n))

const keyOf = (item) => (item[0] === 'src' ? 'src.' + item[1] : item.join('.'))
const isSource = (item) => item[0] === 'src'
const trialFile = (item) => (isSource(item) ? DATA.sources[item[1]].path : TRIAL_DIR_REL + '/' + keyOf(item) + '.webp')
const accepted = (m, n) => !!(m[BKEY][n] && m[BKEY][n].accepted_at)
function sourceBatchOf(k) { for (let n = 1; n <= DATA.batches.length; n++) if (DATA.batches[n - 1].some((it) => isSource(it) && it[1] === k)) return n; return 0 }

/** Every subject's source: the code's (approved earlier), or this task's accepted generation. */
function sources(m) {
  const out = {}
  for (const [k, s] of Object.entries(PREVIEW_SOURCES)) {
    if (!fs.existsSync(abs(s.path))) fail('source ' + k + ' is missing')
    const bytes = fs.readFileSync(abs(s.path))
    const h = sha256(bytes)
    if (h.indexOf(s.sha256_prefix) !== 0) fail('source ' + k + ' hashes to ' + h.slice(0, 12) + ', not the approved ' + s.sha256_prefix)
    out[k] = { path: s.path, sha256: h, bytes }
  }
  for (const k of Object.keys(DATA.sources || {})) {
    if (out[k]) continue
    const n = sourceBatchOf(k)
    const r = m.trials['src.' + k]
    if (!n || !accepted(m, n) || !r || !fs.existsSync(abs(r.file))) continue
    const bytes = fs.readFileSync(abs(r.file))
    if (sha256(bytes) !== r.sha256 || r.sha256 !== m[BKEY][n].sources[k]) fail('source ' + k + ' changed since it was accepted')
    out[k] = { path: r.file, sha256: r.sha256, bytes }
  }
  return out
}

function promptOf(item) {
  if (isSource(item)) { const s = DATA.sources[item[1]]; if (!s) fail('no source ' + item[1]); return s.prompt }
  const [id, v] = item
  if (v === 'A' || v === 'B') {
    const ns = (DATA.newStyles || {})[id]
    if (!ns || !ns.variants[v]) fail(id + ' has no variant ' + v)
    return ns.variants[v] + ' ' + CLOSING[ns.closing]
  }
  if (v === 'S') { if (!isCartoonStyleId(id)) fail(id + ' is not a style'); return getCartoonStyle(id).prompt }
  const rs = (DATA.restyles || {})[id]
  if (rs && rs.variants[v]) {
    if (!isCartoonStyleId(id)) fail(id + ' is not a style')
    return rs.variants[v] + ' ' + CLOSING[rs.closing]
  }
  fail('unknown variant ' + v)
}
const isRestyle = (id) => Object.prototype.hasOwnProperty.call(DATA.restyles || {}, id)
/** The values --choose accepts for a new style or a restyle. */
const choicesFor = (id) => (isRestyle(id) ? [...Object.keys(DATA.restyles[id].variants), 'keep'] : ['A', 'B'])

function planOf(m, n) {
  if (!(n >= 1 && n <= DATA.batches.length)) fail('batch must be 1..' + DATA.batches.length)
  const src = sources(m)
  const items = DATA.batches[n - 1].map((item) => {
    const prompt = promptOf(item)
    if (isSource(item)) return { item, key: keyOf(item), subject: item[1], source_sha256: null, prompt }
    const k = item[2]
    if (!src[k]) fail(keyOf(item) + ': subject ' + k + ' has no approved source yet')
    return { item, key: keyOf(item), subject: k, source: src[k].path, source_sha256: src[k].sha256, prompt }
  })
  const hash = sha256(Buffer.from(JSON.stringify(items.map((i) => [i.key, i.subject, i.source_sha256, i.prompt]))))
  return { items, hash, src }
}

function resultHash(m, n) {
  const shas = []
  for (const item of DATA.batches[n - 1]) {
    const r = m.trials[keyOf(item)]
    if (!r || r.task !== TASK || r.batch !== n) return null
    if (!fs.existsSync(abs(r.file)) || sha256(fs.readFileSync(abs(r.file))) !== r.sha256) return null
    shas.push(r.sha256)
  }
  return sha256(Buffer.from(shas.join('')))
}
const hexPrefix = (v, what) => { const p = String(v || '').toLowerCase(); if (p.length < 12 || !/^[0-9a-f]+$/.test(p)) fail(what + ' needs at least 12 hex characters'); return p }

function runPlan(n) {
  const m = loadManifest()
  const { items, hash } = planOf(m, n)
  console.log('task ' + TASK + ' batch ' + n + ': ' + items.length + ' render(s), estimated ' + usd(items.length * ESTIMATE_PER_RENDER_USD))
  for (const i of items) console.log('\n' + i.key + (i.source ? '  [subject ' + i.subject + ': ' + i.source + ']' : '  [new source photo]') + '\n  ' + i.prompt)
  console.log('\nspent in task ' + TASK + ' so far: ' + usd(taskSpent(m)) + ' of ' + usd(TASK_CEILING_USD) + '; batch ceiling ' + usd(BATCH_CEILING_USD))
  console.log('PLAN HASH ' + hash)
}

async function runRender(n, approvedPlan, only) {
  const m = loadManifest()
  for (let k = 1; k < n; k++) {
    const acc = m[BKEY][k]
    if (!acc || !acc.accepted_at || resultHash(m, k) !== acc.result_sha256) fail('batch ' + k + ' has no accepted, unchanged result; batch ' + n + ' cannot start')
  }
  const { items, hash, src } = planOf(m, n)
  const prefix = hexPrefix(approvedPlan, '--approved-plan')
  if (hash.indexOf(prefix) !== 0) fail('--approved-plan ' + prefix + ' is not the plan hash of batch ' + n + ' (' + hash.slice(0, 12) + '...); run --plan ' + n + ' and have it approved again')
  if (accepted(m, n)) fail('batch ' + n + ' is already accepted; it is not rendered again')
  if (only && !items.find((i) => i.key === only)) fail('--only ' + only + ' is not in batch ' + n)
  const todo = items.filter((i) => {
    if (only) return i.key === only
    const r = m.trials[i.key]
    return !(r && r.batch === n && fs.existsSync(abs(r.file)) && sha256(fs.readFileSync(abs(r.file))) === r.sha256)
  })
  fs.mkdirSync(abs(TRIAL_DIR_REL), { recursive: true })
  const openai = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY, timeout: CLIENT_TIMEOUT_MS, maxRetries: 0 })
  for (const i of todo) {
    if (batchSpent(m, n) + ESTIMATE_PER_RENDER_USD > BATCH_CEILING_USD) fail('STOP before ' + i.key + ': batch ' + n + ' would pass ' + usd(BATCH_CEILING_USD) + ' (spent ' + usd(batchSpent(m, n)) + '). Ask the operator.')
    if (taskSpent(m) + ESTIMATE_PER_RENDER_USD > TASK_CEILING_USD) fail('STOP before ' + i.key + ': task ' + TASK + ' would pass ' + usd(TASK_CEILING_USD) + ' (spent ' + usd(taskSpent(m)) + '). Ask the operator.')
    const at = now()
    const started = Date.now()
    let result
    try {
      if (isSource(i.item)) {
        result = await openai.images.generate({ model: IMAGE_MODEL, prompt: i.prompt, size: IMAGE_SIZE, quality: IMAGE_QUALITY, ...SOURCE_ENCODING })
      } else {
        const s = src[i.subject]
        result = await openai.images.edit({ image: await toFile(s.bytes, uploadFilename('image/jpeg'), { type: 'image/jpeg' }), model: IMAGE_MODEL, prompt: i.prompt, size: IMAGE_SIZE, quality: IMAGE_QUALITY, ...PREVIEW_ENCODING })
      }
    } catch (err) {
      m.last_error = { mode: 'render-jobs', task: TASK, key: i.key, batch: n, at, message: String((err && err.message) || err) }
      saveManifest(m)
      fail(i.key + ' failed: ' + m.last_error.message)
    }
    const b64 = result.data && result.data[0] && result.data[0].b64_json
    if (!b64) { m.last_error = { mode: 'render-jobs', task: TASK, key: i.key, batch: n, at, message: 'no image returned' }; saveManifest(m); fail(i.key + ': no image returned') }
    const out = Buffer.from(b64, 'base64')
    const want = isSource(i.item) ? 'image/jpeg' : 'image/webp'
    if (sniffImageType(new Uint8Array(out)) !== want) { m.last_error = { mode: 'render-jobs', task: TASK, key: i.key, batch: n, at, message: 'not ' + want }; saveManifest(m); fail(i.key + ': not ' + want + '; nothing written') }
    const usage = result.usage ?? null
    const cost = costOf(usage)
    const old = m.trials[i.key]
    if (old) m.discarded.push({ role: 'trial ' + i.key, replaced_at: at, ...old })
    const rel = trialFile(i.item)
    fs.mkdirSync(path.dirname(abs(rel)), { recursive: true })
    fs.writeFileSync(abs(rel), out)
    m.trials[i.key] = { file: rel, sha256: sha256(out), kind: isSource(i.item) ? 'source' : 'render', id: isSource(i.item) ? null : i.item[0], variant: isSource(i.item) ? null : i.item[1], subject: i.subject, input_sha256: i.source_sha256, prompt_sha256: sha256(Buffer.from(i.prompt)), task: TASK, batch: n, plan_sha256: hash, request: { size: IMAGE_SIZE, quality: IMAGE_QUALITY, ...(isSource(i.item) ? SOURCE_ENCODING : PREVIEW_ENCODING) }, response_quality: result.quality ?? null, response_size: result.size ?? null, usage, cost_usd: cost, latency_ms: Date.now() - started, at }
    m.last_error = null
    saveManifest(m)
    console.log(i.key.padEnd(34) + usd(cost).padStart(12) + '   batch ' + usd(batchSpent(m, n)) + '   task ' + usd(taskSpent(m)))
    if (typeof cost !== 'number') fail(i.key + ' recorded no usage; stopping')
    if (m.trials[i.key].response_quality !== IMAGE_QUALITY) fail(i.key + ': the provider reported quality ' + m.trials[i.key].response_quality + '; stopping')
  }
  const rh = resultHash(m, n)
  console.log('\nbatch ' + n + ': ' + (rh ? 'complete' : 'incomplete') + '; batch ' + usd(batchSpent(m, n)) + ', task ' + usd(taskSpent(m)))
  if (rh) {
    for (const i of items) console.log('  ' + i.key.padEnd(34) + m.trials[i.key].sha256)
    console.log('RESULT HASH ' + rh)
  }
}

const parseList = (v) => (v ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : [])

function runAccept(n, result, reject, choose) {
  const m = loadManifest()
  if (!(n >= 1 && n <= DATA.batches.length)) fail('batch must be 1..' + DATA.batches.length)
  const prefix = hexPrefix(result, '--result')
  const rh = resultHash(m, n)
  if (!rh) fail('batch ' + n + ' is not completely rendered, or a file changed since')
  if (rh.indexOf(prefix) !== 0) fail('--result ' + prefix + " is not batch " + n + "'s result hash (" + rh.slice(0, 12) + '...)')
  const items = DATA.batches[n - 1]
  const rej = parseList(reject)
  const ch = {}
  for (const pair of parseList(choose)) { const [id, c] = pair.split('='); ch[id] = c }
  const decisions = {}
  const srcs = {}
  for (const id of rej) if (!items.some((it) => it[0] === id && it[1] === 'S')) fail('--reject ' + id + ' is not a subject move in batch ' + n)
  for (const id of Object.keys(ch)) if (!items.some((it) => it[0] === id && !isSource(it) && it[1] !== 'S')) fail('--choose ' + id + ' is not a new style or a restyle in batch ' + n)
  for (const it of items) {
    if (isSource(it)) { srcs[it[1]] = m.trials[keyOf(it)].sha256; continue }
    if (it[1] === 'S') decisions[it[0]] = rej.indexOf(it[0]) >= 0 ? 'reject' : 'accept'
    else if (isRestyle(it[0])) { const ok = choicesFor(it[0]); if (ok.indexOf(ch[it[0]]) < 0) fail('--choose needs ' + it[0] + '=' + ok.join(', ')); decisions[it[0]] = ch[it[0]] }
    else { if (['A', 'B'].indexOf(ch[it[0]]) < 0) fail('--choose needs ' + it[0] + '=A or B'); decisions[it[0]] = ch[it[0]] }
  }
  m[BKEY][n] = { result_sha256: rh, accepted_prefix: prefix, accepted_at: now(), decisions, sources: srcs }
  saveManifest(m)
  console.log('batch ' + n + ' accepted: ' + rh + '\n' + JSON.stringify({ decisions, sources: srcs }))
}

/** The final choices, from the accepted batches; null until every batch is accepted. */
function choicesOf(m) {
  for (let n = 1; n <= DATA.batches.length; n++) if (!accepted(m, n)) return null
  const out = { sources: {}, newStyles: {}, moves: {} }
  if (DATA.restyles) out.restyles = {}
  for (let n = 1; n <= DATA.batches.length; n++) {
    const acc = m[BKEY][n]
    for (const it of DATA.batches[n - 1]) {
      if (isSource(it)) { out.sources[it[1]] = { path: DATA.sources[it[1]].path, sha256: acc.sources[it[1]] }; continue }
      const [id, v, k] = it
      if (v !== 'S' && isRestyle(id)) {
        const rs = DATA.restyles[id]
        if (acc.decisions[id] === 'keep') out.restyles[id] = { choice: 'keep', subject: PREVIEW_SUBJECTS[id] }
        else if (acc.decisions[id] === v && k === rs.subject) {
          const t = m.trials[keyOf(it)]
          out.restyles[id] = { choice: v, subject: k, body: rs.variants[v], prompt: promptOf(it), trial: t.file, trial_sha256: t.sha256 }
        }
      } else if (v === 'S') {
        const t = m.trials[keyOf(it)]
        out.moves[id] = acc.decisions[id] === 'accept' ? { choice: 'S', subject: k, trial: t.file, trial_sha256: t.sha256 } : { choice: 'keep', subject: PREVIEW_SUBJECTS[id] }
      } else if (acc.decisions[id] === v && k === DATA.newStyles[id].subject) {
        const t = m.trials[keyOf(it)]
        out.newStyles[id] = { choice: v, subject: k, body: DATA.newStyles[id].variants[v], prompt: promptOf(it), trial: t.file, trial_sha256: t.sha256 }
      }
    }
  }
  return out
}

function runFinalize() {
  const m = loadManifest()
  const c = choicesOf(m)
  if (!c) fail('not every batch is accepted')
  for (const id of Object.keys(DATA.newStyles || {})) if (!c.newStyles[id]) fail(id + ' has no chosen render on its subject')
  for (const id of Object.keys(DATA.restyles || {})) if (!c.restyles[id]) fail(id + ' has no decision')
  fs.mkdirSync(abs('reports'), { recursive: true })
  fs.writeFileSync(abs(CHOICES_REL), JSON.stringify({ task: TASK, ...c }, null, 2) + '\n')
  console.log('written ' + CHOICES_REL)
  for (const [k, s] of Object.entries(c.sources)) console.log('  source ' + k + ' ' + s.path + ' ' + s.sha256.slice(0, 12))
  for (const [id, x] of Object.entries(c.newStyles)) console.log('  new    ' + id + ' ' + x.choice + ' on ' + x.subject)
  for (const [id, x] of Object.entries(c.moves)) console.log('  move   ' + id.padEnd(22) + x.choice + ' -> ' + x.subject)
  for (const [id, x] of Object.entries(c.restyles || {})) console.log('  restyle ' + id.padEnd(21) + x.choice + ' -> ' + x.subject)
}

async function runPromote() {
  const m = loadManifest()
  const c = choicesOf(m)
  if (!c) fail('not every batch is accepted')
  const saved = JSON.parse(fs.readFileSync(abs(CHOICES_REL), 'utf8'))
  const savedC = { sources: saved.sources, newStyles: saved.newStyles, moves: saved.moves }
  if (c.restyles) savedC.restyles = saved.restyles
  if (JSON.stringify(savedC) !== JSON.stringify(c)) fail(CHOICES_REL + ' does not match the accepted batches; run --finalize')
  const bad = []
  for (const [k, s] of Object.entries(c.sources)) if (!PREVIEW_SOURCES[k] || PREVIEW_SOURCES[k].path !== s.path || s.sha256.indexOf(PREVIEW_SOURCES[k].sha256_prefix) !== 0) bad.push('PREVIEW_SOURCES.' + k + ' is not ' + s.path + ' at ' + s.sha256.slice(0, 12))
  for (const [id, x] of Object.entries(c.newStyles)) {
    if (!isCartoonStyleId(id) || getCartoonStyle(id).prompt !== x.prompt) bad.push(id + ': the code prompt is not the chosen ' + x.choice)
    if (PREVIEW_SUBJECTS[id] !== x.subject) bad.push(id + ': PREVIEW_SUBJECTS is not ' + x.subject)
  }
  for (const [id, x] of Object.entries(c.moves)) if (PREVIEW_SUBJECTS[id] !== x.subject) bad.push(id + ': PREVIEW_SUBJECTS is ' + PREVIEW_SUBJECTS[id] + ', not ' + x.subject)
  for (const [id, x] of Object.entries(c.restyles || {})) {
    if (x.choice !== 'keep' && getCartoonStyle(id).prompt !== x.prompt) bad.push(id + ': the code prompt is not the chosen ' + x.choice)
    if (PREVIEW_SUBJECTS[id] !== x.subject) bad.push(id + ': PREVIEW_SUBJECTS is ' + PREVIEW_SUBJECTS[id] + ', not ' + x.subject)
  }
  if (bad.length) fail('apply the choices to the code first: ' + bad.join('; '))
  let n = 0
  const promote = (id, x) => {
    const t = m.trials[[id, x.choice === 'S' ? 'S' : x.choice, x.subject].join('.')]
    const bytes = fs.readFileSync(abs(t.file))
    if (sha256(bytes) !== t.sha256) fail(t.file + ' changed since it was rendered')
    if (m.previews[id] && m.previews[id].sha256 === t.sha256) return
    const old = m.previews[id]
    if (old) m.discarded.push({ role: 'preview ' + id, replaced_at: now(), ...old })
    const rel = 'public' + stylePreviewPath(id, 'full')
    fs.writeFileSync(abs(rel), bytes)
    m.previews[id] = { file: rel, sha256: t.sha256, input_sha256: t.input_sha256, subject: t.subject, task: TASK, from_trial: [id, t.variant, t.subject].join('.'), prompt_sha256: t.prompt_sha256, cost_usd: 0, at: now() }
    n++
  }
  for (const [id, x] of Object.entries(c.newStyles)) promote(id, x)
  for (const [id, x] of Object.entries(c.moves)) if (x.choice === 'S') promote(id, x)
  for (const [id, x] of Object.entries(c.restyles || {})) if (x.choice !== 'keep') promote(id, x)
  m.webCopies = m.webCopies || {}
  for (const w of DATA.webCopies || []) {
    const s = c.sources[w.subject] ? { path: c.sources[w.subject].path, sha256: c.sources[w.subject].sha256 } : { path: PREVIEW_SOURCES[w.subject].path, sha256: sha256(fs.readFileSync(abs(PREVIEW_SOURCES[w.subject].path))) }
    const out = await sharp(fs.readFileSync(abs(s.path))).resize(FEATURED_WIDTH, FEATURED_WIDTH).webp({ quality: FEATURED_QUALITY, effort: 6 }).toBuffer()
    fs.mkdirSync(path.dirname(abs(w.path)), { recursive: true })
    fs.writeFileSync(abs(w.path), out)
    m.webCopies[w.path] = { subject: w.subject, from: s.path, from_sha256: s.sha256, sha256: sha256(out), bytes: out.length, width: FEATURED_WIDTH, quality: FEATURED_QUALITY, task: TASK }
  }
  m.featured = m.featured || {}
  for (const f of DATA.featured || []) {
    const wc = m.webCopies[f.before]
    if (!wc || wc.subject !== f.subject) fail('featured ' + f.style + ': ' + f.before + ' is not a web copy of subject ' + f.subject)
    m.featured[f.style] = { before: f.before, before_sha256: wc.sha256, from: wc.from, from_sha256: wc.from_sha256, width: wc.width, quality: wc.quality, task: TASK }
  }
  saveManifest(m)
  console.log('promoted ' + n + ' preview(s); web copies ' + (DATA.webCopies || []).length + '; featured ' + (DATA.featured || []).length)
}

function runStatus() {
  const m = loadManifest()
  for (let n = 1; n <= DATA.batches.length; n++) console.log('batch ' + n + ': ' + DATA.batches[n - 1].length + ' item(s), ' + (accepted(m, n) ? 'accepted ' + m[BKEY][n].result_sha256.slice(0, 12) : 'not accepted') + ', spent ' + usd(batchSpent(m, n)))
  console.log('task ' + TASK + ': spent ' + usd(taskSpent(m)) + ' of ' + usd(TASK_CEILING_USD))
}

if (argv.includes('--plan')) runPlan(Number(val('--plan')))
else if (argv.includes('--render')) await runRender(Number(val('--render')), val('--approved-plan'), val('--only'))
else if (argv.includes('--accept')) runAccept(Number(val('--accept')), val('--result'), val('--reject'), val('--choose'))
else if (argv.includes('--finalize')) runFinalize()
else if (argv.includes('--promote')) await runPromote()
else if (argv.includes('--status')) runStatus()
else fail('choose --plan, --render, --accept, --finalize, --promote or --status')
