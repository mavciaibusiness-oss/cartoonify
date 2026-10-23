import OpenAI, { toFile } from 'openai'
import { handleCartoonify, type HandlerDeps } from '@/lib/cartoonify-handler'
import { getAbuseEnv, getEnv, hasOpenAIKey } from '@/lib/env'
import {
  IMAGE_MODEL,
  IMAGE_QUALITY,
  IMAGE_SIZE,
  MODERATION_MODEL,
  uploadFilename,
} from '@/lib/image-constraints'
import {
  clientIp,
  createCounters,
  createMemoryStore,
  createUpstashStore,
  type CounterStore,
} from '@/lib/rate-limit'
import {
  TURNSTILE_SITEVERIFY_URL,
  TURNSTILE_TEST_SECRET,
  verifyTurnstileToken,
} from '@/lib/turnstile'

// Rendered per request, never cached — this route calls a paid upstream API
// with visitor-supplied bytes. next.route_force_dynamic.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Derived from maxDuration so the transport budget cannot drift from the
// route's own ceiling again — see task 0002 finding 11. Never a literal.
const UPSTREAM_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.75)
const PROBE_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.1)
const MODERATION_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.15)
const UPSTREAM_MAX_RETRIES = 0

// In-process counters for preview and local runs without Redis (decision D1).
// Plain state, not a client: one per process, and not shared between instances.
let memoryStore: CounterStore | null = null
let warnedMemory = false

function counterStore(redis: { url: string; token: string } | null): CounterStore {
  if (redis) return createUpstashStore(redis)
  if (!warnedMemory) {
    warnedMemory = true
    console.warn('cartoonify: no Redis configured; using in-process counters that are not shared between instances')
  }
  if (!memoryStore) memoryStore = createMemoryStore()
  return memoryStore
}

function buildDeps(): HandlerDeps {
  const abuse = getAbuseEnv()
  const secret = abuse.isProduction
    ? abuse.turnstileSecret
    : (abuse.turnstileSecret ?? TURNSTILE_TEST_SECRET)
  const secretUsable = secret !== null && !(abuse.isProduction && secret === TURNSTILE_TEST_SECRET)
  const verifyUrl = abuse.isProduction ? TURNSTILE_SITEVERIFY_URL : (abuse.turnstileVerifyUrl ?? TURNSTILE_SITEVERIFY_URL)
  const failClosed = abuse.isProduction && (abuse.redis === null || !secretUsable)

  return {
    now: () => new Date(),
    hasOpenAIKey,
    failClosed: () => failClosed,
    clientIp: (request) => clientIp(request.headers),
    verifyTurnstile: (token, ip) =>
      secret === null ? Promise.resolve(false) : verifyTurnstileToken({ secret, token, ip, url: verifyUrl }),
    counters: createCounters(
      counterStore(abuse.redis),
      'cartoonify:' + abuse.environment,
      abuse.redis ? abuse.redis.token : 'local-counters',
    ),
    moderate: async (dataUrl) => {
      const client = new OpenAI({
        apiKey: getEnv().OPENAI_API_KEY,
        timeout: MODERATION_TIMEOUT_MS,
        maxRetries: UPSTREAM_MAX_RETRIES,
      })
      const result = await client.moderations.create({
        model: MODERATION_MODEL,
        input: [{ type: 'image_url', image_url: { url: dataUrl } }],
      })
      const first = result.results[0]
      if (!first) throw new Error('moderation returned no result')
      return first.flagged === true
    },
    editImage: async ({ bytes, type, prompt }) => {
      try {
        // Client and key are constructed here, inside the handler, never at
        // module scope.
        const client = new OpenAI({
          apiKey: getEnv().OPENAI_API_KEY,
          timeout: UPSTREAM_TIMEOUT_MS,
          maxRetries: UPSTREAM_MAX_RETRIES,
        })
        const uploadable = await toFile(bytes, uploadFilename(type), { type })
        const result = await client.images.edit({
          image: uploadable,
          model: IMAGE_MODEL,
          prompt,
          size: IMAGE_SIZE,
          quality: IMAGE_QUALITY,
        })
        const b64 = result.data?.[0]?.b64_json
        if (!b64) return { ok: false, unreachable: false }
        return { ok: true, b64 }
      } catch (unknownError) {
        // Logged server-side for operators; never forwarded to the response body.
        console.error('cartoonify: upstream call failed', unknownError)
        if (unknownError instanceof OpenAI.APIConnectionError) {
          await logSmallBodyProbe()
          return { ok: false, unreachable: true }
        }
        return { ok: false, unreachable: false }
      }
    },
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleCartoonify(request, buildDeps())
}

// A large multipart upload can be cut mid-request by a provider that has
// already computed a rejection, so a transport error alone is not evidence of
// a transport problem (finding 12). This probe asks a small request what the
// large one structurally cannot: did any HTTP response arrive at all? It is
// diagnostics only — logged server-side, never surfaced to the caller — and
// it must never throw.
async function logSmallBodyProbe(): Promise<void> {
  try {
    const probeClient = new OpenAI({
      apiKey: getEnv().OPENAI_API_KEY,
      timeout: PROBE_TIMEOUT_MS,
      maxRetries: 0,
    })
    await probeClient.models.list()
    console.error('cartoonify: upstream probe result=reached status=200')
  } catch (probeError) {
    if (probeError instanceof OpenAI.APIConnectionError) {
      console.error('cartoonify: upstream probe result=unreachable', probeError)
    } else {
      const status = probeError instanceof OpenAI.APIError ? probeError.status : 'unknown'
      console.error('cartoonify: upstream probe result=reached status=' + String(status), probeError)
    }
  }
}
