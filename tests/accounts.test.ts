import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { ERROR_MESSAGES, handleCartoonify, type BeginResult, type HandlerDeps } from '@/lib/cartoonify-handler'
import { createCounters, createMemoryStore } from '@/lib/rate-limit'
import { watermarkPng } from '@/lib/watermark'
import { keyedHash, safeNext, validEmail } from '@/lib/accounts'

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function pngBytes(size = 64): Uint8Array {
  const bytes = new Uint8Array(size)
  bytes.set(PNG_HEAD)
  return bytes
}

type Wallet = { free: number; paid: number }

type Fakes = {
  deps: HandlerDeps
  wallet: Wallet
  calls: { moderate: number; edit: number; begin: number; complete: string[]; refund: Array<[string, string]>; mark: number }
}

function makeFakes(
  over: { signedIn?: boolean; wallet?: Wallet; flagged?: boolean; editFails?: boolean; beginThrows?: boolean } = {},
): Fakes {
  const wallet: Wallet = over.wallet ?? { free: 0, paid: 5 }
  const calls: Fakes['calls'] = { moderate: 0, edit: 0, begin: 0, complete: [], refund: [], mark: 0 }
  const kinds = new Map<string, 'free' | 'paid'>()
  const now = new Date('2026-10-26T10:15:00Z')
  const deps: HandlerDeps = {
    now: () => now,
    hasOpenAIKey: () => true,
    failClosed: () => false,
    clientIp: () => '198.51.100.1',
    verifyTurnstile: async (token) => token.startsWith('ok-'),
    counters: createCounters(createMemoryStore(() => now.getTime()), 'test', 'test-secret'),
    moderate: async () => {
      calls.moderate += 1
      return over.flagged === true
    },
    editImage: async () => {
      calls.edit += 1
      return over.editFails ? { ok: false, unreachable: false } : { ok: true, b64: 'AAAA' }
    },
    accountsConfigured: () => true,
    getUser: async () => (over.signedIn === false ? null : { id: 'user-1', email: 'user@example.com' }),
    credits: {
      begin: async (): Promise<BeginResult> => {
        calls.begin += 1
        if (over.beginThrows) throw new Error('database down')
        const kind = wallet.paid >= 1 ? 'paid' : wallet.free >= 1 ? 'free' : null
        if (kind === null) return { ok: false, free: wallet.free, paid: wallet.paid }
        wallet[kind] -= 1
        const id = 'conv-' + calls.begin
        kinds.set(id, kind)
        return { ok: true, conversionId: id, kind, free: wallet.free, paid: wallet.paid }
      },
      complete: async (id) => {
        calls.complete.push(id)
      },
      refund: async (id, reason) => {
        calls.refund.push([id, reason])
        const kind = kinds.get(id)
        if (kind) wallet[kind] += 1
        return true
      },
    },
    watermark: async (b64) => {
      calls.mark += 1
      return 'MARKED-' + b64
    },
  }
  return { deps, wallet, calls }
}

function makeRequest(token = 'ok-1'): Request {
  const form = new FormData()
  form.append('image', new Blob([pngBytes() as BlobPart], { type: 'image/png' }), 'photo.png')
  form.append('style', 'classic')
  form.append('consent', 'yes')
  form.append('cf-turnstile-response', token)
  return new Request('http://localhost/api/cartoonify', { method: 'POST', body: form })
}

async function read(response: Response): Promise<Record<string, unknown> & { status: number }> {
  return { status: response.status, ...((await response.json()) as Record<string, unknown>) }
}

test('rejects a conversion without a signed-in user', async () => {
  const { deps, calls } = makeFakes({ signedIn: false })
  const result = await read(await handleCartoonify(makeRequest(), deps))
  assert.equal(result.status, 401)
  assert.equal(result.code, 'AUTH_REQUIRED')
  assert.equal(result.message, ERROR_MESSAGES.AUTH_REQUIRED)
  assert.equal(calls.begin + calls.moderate + calls.edit, 0)
})

test('answers 503 and spends nothing when sign-in cannot be checked', async () => {
  const { deps, calls } = makeFakes()
  deps.getUser = async () => {
    throw new Error('auth unreachable')
  }
  const result = await read(await handleCartoonify(makeRequest(), deps))
  assert.deepEqual([result.status, result.code], [503, 'SERVICE_UNAVAILABLE'])
  assert.equal(calls.begin + calls.moderate + calls.edit, 0)
})

test('returns NO_CREDITS without calling OpenAI when the wallet is empty', async () => {
  const { deps, calls } = makeFakes({ wallet: { free: 0, paid: 0 } })
  const result = await read(await handleCartoonify(makeRequest(), deps))
  assert.deepEqual([result.status, result.code], [402, 'NO_CREDITS'])
  assert.deepEqual(result.balance, { free: 0, paid: 0 })
  assert.equal(calls.moderate + calls.edit, 0)
  // The daily slot went back: the same request can be tried again and meets the same wallet check.
  const again = await read(await handleCartoonify(makeRequest('ok-2'), deps))
  assert.equal(again.code, 'NO_CREDITS')
})

test('answers 503 without calling OpenAI when the database cannot reserve', async () => {
  const { deps, calls } = makeFakes({ beginThrows: true })
  const result = await read(await handleCartoonify(makeRequest(), deps))
  assert.deepEqual([result.status, result.code], [503, 'SERVICE_UNAVAILABLE'])
  assert.equal(calls.moderate + calls.edit, 0)
})

test('refunds the credit when moderation flags the image', async () => {
  const { deps, wallet, calls } = makeFakes({ flagged: true })
  const result = await read(await handleCartoonify(makeRequest(), deps))
  assert.deepEqual([result.status, result.code, result.refunded], [422, 'CONTENT_REJECTED', true])
  assert.deepEqual(calls.refund, [['conv-1', 'content_rejected']])
  assert.equal(wallet.paid, 5)
  assert.equal(calls.edit, 0)
  assert.deepEqual(calls.complete, [])
})

test('refunds the credit when the image edit fails', async () => {
  const { deps, wallet, calls } = makeFakes({ editFails: true })
  const result = await read(await handleCartoonify(makeRequest(), deps))
  assert.deepEqual([result.status, result.code, result.refunded], [502, 'UPSTREAM_ERROR', true])
  assert.deepEqual(calls.refund, [['conv-1', 'upstream_error']])
  assert.equal(wallet.paid, 5)
  assert.deepEqual(calls.complete, [])
})

test('refunds the credit when the watermark fails', async () => {
  const { deps, wallet, calls } = makeFakes({ wallet: { free: 2, paid: 0 } })
  deps.watermark = async () => {
    throw new Error('sharp failed')
  }
  const result = await read(await handleCartoonify(makeRequest(), deps))
  assert.deepEqual([result.status, result.code, result.refunded], [500, 'PROCESSING_FAILED', true])
  assert.deepEqual(calls.refund, [['conv-1', 'processing_failed']])
  assert.equal(wallet.free, 2)
})

test('still delivers the image when the completion record fails', async () => {
  const { deps } = makeFakes()
  deps.credits.complete = async () => {
    throw new Error('database down')
  }
  const result = await read(await handleCartoonify(makeRequest(), deps))
  assert.equal(result.status, 200)
  assert.equal(result.ok, true)
})

test('spends paid credits before free credits', async () => {
  const { deps, calls } = makeFakes({ wallet: { free: 1, paid: 1 } })
  const first = await read(await handleCartoonify(makeRequest('ok-1'), deps))
  assert.deepEqual([first.credit, first.balance], ['paid', { free: 1, paid: 0 }])
  const second = await read(await handleCartoonify(makeRequest('ok-2'), deps))
  assert.deepEqual([second.credit, second.balance], ['free', { free: 0, paid: 0 }])
  assert.equal(calls.complete.length, 2)
})

test('watermarks a free conversion and leaves a paid one untouched', async () => {
  const { deps, calls } = makeFakes({ wallet: { free: 1, paid: 1 } })
  const paid = await read(await handleCartoonify(makeRequest('ok-1'), deps))
  assert.deepEqual([paid.credit, paid.watermarked, paid.image], ['paid', false, 'data:image/png;base64,AAAA'])
  assert.equal(calls.mark, 0)
  const free = await read(await handleCartoonify(makeRequest('ok-2'), deps))
  assert.deepEqual([free.credit, free.watermarked, free.image], ['free', true, 'data:image/png;base64,MARKED-AAAA'])

  // The real mark: same size, the bottom-right corner changes, the top-left does not.
  const source = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 136, g: 170, b: 68 } } })
    .png()
    .toBuffer()
  const marked = Buffer.from(await watermarkPng(source.toString('base64')), 'base64')
  const a = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const b = await sharp(marked).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.deepEqual([b.info.width, b.info.height], [400, 300])
  let corner = 0
  let topLeft = 0
  for (let y = 0; y < 300; y++) {
    for (let x = 0; x < 400; x++) {
      const i = (y * 400 + x) * 3
      const differs = a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]
      if (differs && x >= 240 && y >= 225) corner += 1
      if (differs && x < 200 && y < 150) topLeft += 1
    }
  }
  assert.ok(corner > 400, 'the corner carries the mark')
  assert.equal(topLeft, 0)
})

test('keeps the sign-in helpers strict', () => {
  assert.equal(safeNext('/en/workshop'), '/en/workshop')
  assert.equal(safeNext('//evil.example'), '/workshop')
  assert.equal(safeNext('https://evil.example/'), '/workshop')
  assert.equal(validEmail(' a@b.co '), 'a@b.co')
  for (const bad of ['', 'a@b', 'two@at@x.com', 'sp ace@x.com', '@x.com', 'x'.repeat(250) + '@x.com']) {
    assert.equal(validEmail(bad), null, bad)
  }
  const hash = keyedHash('secret-one', 'ip', '203.0.113.5')
  assert.match(hash, /^[0-9a-f]{64}$/)
  assert.notEqual(hash, keyedHash('secret-one', 'device', '203.0.113.5'))
  assert.notEqual(hash, keyedHash('secret-two', 'ip', '203.0.113.5'))
})
