/**
 * The profile page's pure parts: the account error texts, the deletion
 * confirmation check, and the refund state of an order. No imports, no
 * environment, no network: the routes, the page and the tests all load it.
 */

/** Byte-equal to tr.errors for the same codes (criterion 120 compares them). */
export const ACCOUNT_ERROR_MESSAGES = {
  CONFIRM_REQUIRED: 'Hesap silme onaylanmadı.',
  CONVERSION_IN_PROGRESS: 'Bir dönüşüm sürüyor. Bir dakika sonra tekrar deneyin.',
} as const

export type AccountErrorCode = keyof typeof ACCOUNT_ERROR_MESSAGES

export type RefundState = 'none' | 'partial' | 'full'

export type AccountPurchase = { at: string; pack: string; credits: number; refund: RefundState }
export type AccountConversion = { at: string; style: string; kind: 'free' | 'paid' }

export type AccountOverview = {
  free: number
  paid: number
  purchases: AccountPurchase[]
  conversions: AccountConversion[]
}

/** True only for a JSON object whose `confirm` is exactly the string DELETE. Other keys are ignored. */
export function isDeleteConfirmation(body: unknown): boolean {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  return (body as Record<string, unknown>).confirm === 'DELETE'
}

/** `none` when nothing was refunded, `full` when the whole net amount was, otherwise `partial`. */
export function refundState(net: number, refunded: number): RefundState {
  if (!(refunded > 0)) return 'none'
  if (refunded >= net) return 'full'
  return 'partial'
}
