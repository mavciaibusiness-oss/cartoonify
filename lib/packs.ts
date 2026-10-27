/**
 * The three credit packs, for display only. What a buyer pays is the price of
 * the Polar product the server maps the pack to; what they receive is the
 * database's pack-to-credits constraint. The browser never sends a product
 * id, a price, a credit count or a user id. Client-safe: no imports.
 */
export const PACKS = [
  { id: 'p10', credits: 10, price: '$3.99' },
  { id: 'p30', credits: 30, price: '$9.99' },
  { id: 'p75', credits: 75, price: '$19.99' },
] as const

export type PackId = (typeof PACKS)[number]['id']
