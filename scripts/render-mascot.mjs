/**
 * Task 0025: the ProToolHub Cartoon mascot, rendered with OpenAI behind operator gates.
 *
 *   --plan                                         FREE. The four prompts, the estimate and the PLAN HASH.
 *   --render --approved-plan <hex> [--only <A-D>]  PAID. Renders every candidate not yet rendered, or the one
 *                                                  named by --only again. Refuses unless the plan hash matches
 *                                                  and the next call stays under the ceiling.
 *   --choose <A-D>                                 FREE. Records the operator's choice (all four must exist).
 *   --promote                                      FREE. Writes public/brand/mascot-480.webp and mascot-240.webp
 *                                                  from the chosen candidate and records their hashes.
 *   --status                                       FREE.
 *
 * The key is read through lib/env.ts only and is never printed.
 *   node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/render-mascot.mjs --plan
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_REL = 'data/mascot-0025.json'
const REPORT_REL = 'reports/0025-mascot.json'
const OUT_DIR_REL = 'assets/mascot/0025'
const WEB = [
  { rel: 'public/brand/mascot-480.webp', size: 480, maxBytes: 60000 },
  { rel: 'public/brand/mascot-240.webp', size: 240, maxBytes: 20000 },
]
const HARD_CEILING_USD = 1.0
const RATES = { text_input_per_m: 5, image_input_per_m: 8, image_output_per_m: 30 }
const IDS = ['A', 'B', 'C', 'D']
const QUALITIES = [86, 78, 70, 62, 54]

const abs = (rel) => path.join(ROOT, ...rel.split('/'))
function fail(message) { console.error('render-mascot: ' + message); process.exit(1) }
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex')
const usd = (n) => (typeof n === 'number' ? n.toFixed(4) + ' USD' : 'unknown')
function costOf(usage) {
  if (!usage || typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') return null
  const d = usage.input_tokens_details || {}
  const text = typeof d.text_tokens === 'number' ? d.text_tokens : 0
  const image = typeof d.image_tokens === 'number' ? d.image_tokens : usage.input_tokens - text
  return Math.round(((text * RATES.text_input_per_m + image * RATES.image_input_per_m + usage.output_tokens * RATES.image_output_per_m) / 1e6) * 1e6) / 1e6
}

const DATA_TEXT = fs.readFileSync(abs(DATA_REL), 'utf8').split('\r\n').join('\n')
const DATA = JSON.parse(DATA_TEXT)
const PLAN_HASH = sha256(DATA_TEXT)
const CEILING = Math.min(Number(DATA.ceiling_usd), HARD_CEILING_USD)
const ESTIMATE = Number(DATA.estimate_usd_per_image)
if (!(CEILING > 0) || !(ESTIMATE > 0)) fail(DATA_REL + ' has no valid ceiling or estimate')
if (!Array.isArray(DATA.candidates) || DATA.candidates.map((c) => c.id).join() !== IDS.join()) fail(DATA_REL + ' must hold candidates A, B, C, D in that order')
const promptOf = (id) => DATA.base_prompt + ' ' + DATA.candidates.find((c) => c.id === id).prompt

function load() {
  if (!fs.existsSync(abs(REPORT_REL))) return { task: DATA.task, plan_sha256: PLAN_HASH, ceiling_usd: CEILING, candidates: {}, discarded: [], chosen: null, promoted: null }
  return JSON.parse(fs.readFileSync(abs(REPORT_REL), 'utf8'))
}
function save(r) {
  fs.mkdirSync(path.dirname(abs(REPORT_REL)), { recursive: true })
  fs.writeFileSync(abs(REPORT_REL), JSON.stringify(r, null, 2) + '\n')
}
const spent = (r) => Object.values(r.candidates).concat(r.discarded).reduce((s, c) => s + (typeof c.cost_usd === 'number' ? c.cost_usd : 0), 0)
function checkFile(c) {
  if (!fs.existsSync(abs(c.file))) fail(c.file + ' is missing')
  if (sha256(fs.readFileSync(abs(c.file))) !== c.sha256) fail(c.file + ' does not match its recorded hash')
}

const args = process.argv.slice(2)
const has = (name) => args.indexOf(name) >= 0
const value = (name) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : null }

function plan() {
  console.log('task ' + DATA.task + ': ' + DATA.purpose)
  console.log('size ' + DATA.size + ', quality ' + DATA.quality + ', background ' + DATA.background + ', PNG')
  for (const id of IDS) console.log('\n' + id + ': ' + promptOf(id))
  console.log('\nestimate: ' + IDS.length + ' x ' + usd(ESTIMATE) + ' = ' + usd(IDS.length * ESTIMATE) + '; ceiling ' + usd(CEILING))
  console.log('PLAN HASH ' + PLAN_HASH)
}

async function render() {
  if (value('--approved-plan') !== PLAN_HASH) fail('the approved plan hash does not match; run --plan and approve its PLAN HASH')
  const only = value('--only')
  if (only !== null && IDS.indexOf(only) < 0) fail('--only takes A, B, C or D')
  const r = load()
  if (r.plan_sha256 !== PLAN_HASH) fail(REPORT_REL + ' was written for another plan')
  if (r.chosen) fail('a candidate is already chosen; nothing more is rendered')
  const todo = only ? [only] : IDS.filter((id) => !r.candidates[id])
  if (!todo.length) { console.log('all four candidates are rendered; use --only <id> to render one again'); return }
  if (spent(r) + ESTIMATE > CEILING) fail('the next render would pass the ceiling of ' + usd(CEILING) + ' (spent ' + usd(spent(r)) + ')')
  const { getEnv } = await import('../lib/env.ts')
  const { IMAGE_MODEL } = await import('../lib/image-constraints.ts')
  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY, timeout: 300000, maxRetries: 0 })
  fs.mkdirSync(abs(OUT_DIR_REL), { recursive: true })
  for (const id of todo) {
    if (spent(r) + ESTIMATE > CEILING) fail('the next render would pass the ceiling of ' + usd(CEILING) + ' (spent ' + usd(spent(r)) + ')')
    const prompt = promptOf(id)
    const started = Date.now()
    const result = await openai.images.generate({ model: IMAGE_MODEL, prompt, size: DATA.size, quality: DATA.quality, background: DATA.background, output_format: 'png' })
    const b64 = result && result.data && result.data[0] && result.data[0].b64_json
    if (!b64) fail(id + ': the answer holds no image')
    const out = Buffer.from(b64, 'base64')
    const rel = OUT_DIR_REL + '/' + id + '.png'
    if (r.candidates[id]) r.discarded.push(Object.assign({ id }, r.candidates[id]))
    fs.writeFileSync(abs(rel), out)
    const usage = result.usage ?? null
    const cost = costOf(usage)
    r.candidates[id] = { file: rel, sha256: sha256(out), prompt_sha256: sha256(Buffer.from(prompt)), model: IMAGE_MODEL, size: DATA.size, quality: DATA.quality, background: DATA.background, usage, cost_usd: cost, latency_ms: Date.now() - started, at: new Date().toISOString() }
    save(r)
    console.log(id + '  ' + rel + '  ' + usd(cost) + '   spent ' + usd(spent(r)) + ' of ' + usd(CEILING))
    if (typeof cost !== 'number') fail(id + ' recorded no usage; stopping')
    if (spent(r) > CEILING) fail('spent ' + usd(spent(r)) + ', over the ceiling; stopping')
  }
  console.log('look at ' + OUT_DIR_REL + '/ and choose with --choose <A-D>')
}

function choose() {
  const id = value('--choose')
  if (IDS.indexOf(id) < 0) fail('--choose takes A, B, C or D')
  const r = load()
  for (const x of IDS) { if (!r.candidates[x]) fail('candidate ' + x + ' is not rendered; the operator chooses among all four'); checkFile(r.candidates[x]) }
  r.chosen = id
  r.promoted = null
  save(r)
  console.log('chosen: ' + id + '; now run --promote')
}

async function promote() {
  const r = load()
  if (!r.chosen) fail('no candidate is chosen')
  const c = r.candidates[r.chosen]
  checkFile(c)
  const src = fs.readFileSync(abs(c.file))
  const files = {}
  for (const w of WEB) {
    let out = null
    for (const q of QUALITIES) {
      const b = await sharp(src).resize(w.size, w.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: q, alphaQuality: 90, effort: 6 }).toBuffer()
      if (b.length <= w.maxBytes) { out = b; break }
    }
    if (!out) fail(w.rel + ' stays over ' + w.maxBytes + ' bytes at quality ' + QUALITIES[QUALITIES.length - 1])
    fs.mkdirSync(path.dirname(abs(w.rel)), { recursive: true })
    fs.writeFileSync(abs(w.rel), out)
    files[w.rel] = { sha256: sha256(out), bytes: out.length, size: w.size }
    console.log(w.rel + '  ' + out.length + ' bytes')
  }
  r.promoted = { from: r.chosen, files, at: new Date().toISOString() }
  save(r)
}

function status() {
  const r = load()
  for (const id of IDS) console.log(id + ': ' + (r.candidates[id] ? r.candidates[id].file + '  ' + usd(r.candidates[id].cost_usd) : 'not rendered'))
  console.log('spent ' + usd(spent(r)) + ' of ' + usd(CEILING) + '; chosen ' + (r.chosen || 'none') + '; promoted ' + (r.promoted ? 'yes' : 'no'))
}

async function main() {
  if (has('--plan')) return plan()
  if (has('--render')) return render()
  if (has('--choose')) return choose()
  if (has('--promote')) return promote()
  if (has('--status')) return status()
  fail('say --plan, --render, --choose, --promote or --status')
}
main().catch((e) => fail(e && e.message ? e.message : String(e)))
