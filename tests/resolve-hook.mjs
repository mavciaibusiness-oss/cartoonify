import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = new URL('../', import.meta.url)

function findFile(base) {
  for (const candidate of [base, base + '.ts', base + '/index.ts']) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  let base = null
  if (specifier.startsWith('@/')) {
    base = fileURLToPath(new URL(specifier.slice(2), root))
  } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    base = fileURLToPath(new URL(specifier, context.parentURL))
  }
  if (base !== null) {
    const found = findFile(base)
    if (found !== null) return nextResolve(pathToFileURL(found).href, context)
  }
  return nextResolve(specifier, context)
}
