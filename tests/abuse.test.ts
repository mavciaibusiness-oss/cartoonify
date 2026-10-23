import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ERROR_MESSAGES, handleCartoonify, type HandlerDeps } from '@/lib/cartoonify-handler'
import { MAX_FILE_BYTES } from '@/lib/image-constraints'
import { DAILY_GLOBAL_CAP, HOURLY_LIMIT_PER_IP } from '@/lib/limits'
import { createCounters, createMemoryStore } from '@/lib/rate-limit'

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function pngBytes(size = 64): Uint8Array {
  const bytes = new Uint8Array(size)
  bytes.set(PNG_HEAD)
  return bytes
}

type Fakes = {
  deps: HandlerDeps
  calls: { turnstile: number; moderate: number; edit: number }
}

function makeFakes(over: { flagged?: boolean; tokenOk?: (t: string) => boolean } = {}): Fakes {
  const calls = { turnstile: 0, moderate: 0, edit: 0 }
  const now = new Date('2026-10-23T10:15:00Z')
  const deps: HandlerDeps = {
    now: () => now,
    hasOpenAIKey: () => true,
    failClosed: () => false,
    clientIp: (request) => request.headers.get('x-real-ip') ?? 'unknown',
    verifyTurnstile: async (token) => {
      calls.turnstile += 1
      return over.tokenOk ? over.tokenOk(token) : token.startsWith('ok-')
    },
    counters: createCounters(createMemoryStore(() => now.getTime()), 'test', 'test-secret'),
    moderate: async () => {
      calls.moderate += 1
      return over.flagged === true
    },
    editImage: async () => {
      calls.edit += 1
      return { ok: true, b64: 'AAAA' }
    },
  }
  return { deps, calls }
}

type Options = {
  bytes?: Uint8Array
  type?: string
  consent?: string | null
  token?: string | null
  ip?: string
}

function makeRequest(o: Options = {}): Request {
  const form = new FormData()
  form.append('image', new Blob([(o.bytes ?? pngBytes()) as BlobPart], { type: o.type ?? 'image/png' }), 'photo.png')
  form.append('style', 'classic')
  if (o.consent !== null) form.append('consent', o.consent ?? 'yes')
  if (o.token !== null) form.append('cf-turnstile-response', o.token ?? 'ok-1')
  return new Request('http://localhost/api/cartoonify', {
    method: 'POST',
    body: form,
    headers: { 'x-real-ip': o.ip ?? '198.51.100.1' },
  })
}

async function codeOf(response: Response): Promise<{ status: number; code?: string; message?: string }> {
  const body = (await response.json()) as { code?: string; message?: string }
  return { status: response.status, code: body.code, message: body.message }
}

test('rejects the 11th request from one IP within an hour', async () => {
  const { deps, calls } = makeFakes()
  for (let i = 1; i <= HOURLY_LIMIT_PER_IP; i++) {
    const response = await handleCartoonify(makeRequest({ ip: '203.0.113.7', token: 'ok-' + i }), deps)
    assert.equal(response.status, 200)
  }
  const editsBefore = calls.edit
  const result = await codeOf(await handleCartoonify(makeRequest({ ip: '203.0.113.7', token: 'ok-x' }), deps))
  assert.equal(result.status, 429)
  assert.equal(result.code, 'RATE_LIMITED')
  assert.equal(result.message, ERROR_MESSAGES.RATE_LIMITED)
  assert.equal(calls.edit, editsBefore)
  assert.equal(calls.moderate, HOURLY_LIMIT_PER_IP)
})

test('does not call OpenAI when the daily cap is full', async () => {
  const { deps, calls } = makeFakes()
  for (let i = 0; i < DAILY_GLOBAL_CAP; i++) {
    assert.equal(await deps.counters.reserveDaily(deps.now()), true)
  }
  const result = await codeOf(await handleCartoonify(makeRequest(), deps))
  assert.equal(result.status, 429)
  assert.equal(result.code, 'DAILY_CAP')
  assert.equal(calls.moderate, 0)
  assert.equal(calls.edit, 0)
  // The refused request undid its own increment: one slot is still full-cap, not over.
  assert.equal(await deps.counters.reserveDaily(deps.now()), false)
})

test('rejects a missing or invalid Turnstile token', async () => {
  const { deps, calls } = makeFakes()
  const missing = await codeOf(await handleCartoonify(makeRequest({ token: null }), deps))
  assert.deepEqual([missing.status, missing.code], [403, 'CAPTCHA_FAILED'])
  assert.equal(calls.turnstile, 0)

  const invalid = await codeOf(await handleCartoonify(makeRequest({ token: 'bad-1' }), deps))
  assert.deepEqual([invalid.status, invalid.code], [403, 'CAPTCHA_FAILED'])
  assert.equal(calls.turnstile, 1)

  const tooLong = await codeOf(await handleCartoonify(makeRequest({ token: 'ok-' + 'x'.repeat(2100) }), deps))
  assert.equal(tooLong.code, 'CAPTCHA_FAILED')
  assert.equal(calls.turnstile, 1)
  assert.equal(calls.moderate + calls.edit, 0)
})

test('rejects a request without consent', async () => {
  const { deps, calls } = makeFakes()
  for (const consent of [null, 'no', '']) {
    const result = await codeOf(await handleCartoonify(makeRequest({ consent }), deps))
    assert.deepEqual([result.status, result.code], [400, 'CONSENT_REQUIRED'])
    assert.equal(result.message, ERROR_MESSAGES.CONSENT_REQUIRED)
  }
  assert.equal(calls.turnstile + calls.moderate + calls.edit, 0)
})

test('rejects a wrong file type and an oversize file', async () => {
  const { deps, calls } = makeFakes()
  const notImage = await codeOf(
    await handleCartoonify(makeRequest({ bytes: new TextEncoder().encode('this is not an image'), type: 'image/png' }), deps),
  )
  assert.deepEqual([notImage.status, notImage.code], [400, 'INVALID_TYPE'])

  const gif = await codeOf(await handleCartoonify(makeRequest({ bytes: pngBytes(), type: 'image/gif' }), deps))
  assert.deepEqual([gif.status, gif.code], [400, 'INVALID_TYPE'])

  const big = await codeOf(await handleCartoonify(makeRequest({ bytes: pngBytes(MAX_FILE_BYTES + 1) }), deps))
  assert.deepEqual([big.status, big.code], [400, 'FILE_TOO_LARGE'])

  assert.equal(calls.turnstile + calls.moderate + calls.edit, 0)
})

test('does not call image edit when moderation flags the image', async () => {
  const { deps, calls } = makeFakes({ flagged: true })
  const result = await codeOf(await handleCartoonify(makeRequest(), deps))
  assert.deepEqual([result.status, result.code], [422, 'CONTENT_REJECTED'])
  assert.equal(calls.moderate, 1)
  assert.equal(calls.edit, 0)
  // The daily slot was refunded: the whole cap is still available.
  for (let i = 0; i < DAILY_GLOBAL_CAP; i++) {
    assert.equal(await deps.counters.reserveDaily(deps.now()), true)
  }
})

test('fails closed when the service is not configured', async () => {
  const { deps, calls } = makeFakes()
  deps.failClosed = () => true
  const result = await codeOf(await handleCartoonify(makeRequest(), deps))
  assert.deepEqual([result.status, result.code], [503, 'SERVICE_UNAVAILABLE'])
  assert.equal(calls.turnstile + calls.moderate + calls.edit, 0)
})
