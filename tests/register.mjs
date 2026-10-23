import { register } from 'node:module'

// Maps "@/x" and extensionless relative imports to .ts files, so the handler
// and its imports run under Node's built-in type stripping with no new tool.
register('./resolve-hook.mjs', import.meta.url)
