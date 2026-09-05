/**
 * Single source of truth for the cartoon style presets, used by both
 * components/cartoonify-form.tsx (client) and app/api/cartoonify/route.ts
 * (server) — the same shape as lib/image-constraints.ts. Neither of those
 * files may restate a style id, a label or a prompt of its own.
 *
 * The prompts are product copy, not secrets, so this file is safe to bundle
 * client-side. That is not what makes the allow-list a control: the control is
 * that the server maps an incoming id through CARTOON_STYLES and rejects
 * anything not in it, so a caller can never supply prompt text of its own.
 *
 * Every preset is an original description of a drawing technique. No preset
 * names, imitates or alludes to a studio, a franchise or a character.
 */

export type CartoonStyle = {
  /** Stable wire value. Sent in FormData and matched against this list. */
  readonly id: string
  /** Turkish label shown to the visitor. */
  readonly name: string
  /** One line under the label, so the choice means something before the render. */
  readonly description: string
  /** The instruction sent upstream. Never accepted from the client. */
  readonly prompt: string
}

/**
 * `classic` carries the exact prompt this route sent before styles existed, so
 * a request with no `style` field — every client older than this change —
 * produces the same output it always did. Do not edit that prompt string.
 */
export const CARTOON_STYLES = [
  {
    id: 'classic',
    name: 'Klasik Karikatür',
    description: 'Canlı renkler ve temiz hatlarla dengeli bir çizgi film görünümü.',
    prompt:
      'Bu fotoğrafı canlı renkli, temiz hatlı bir karikatür/çizgi film çizimine dönüştür. Konuyu ve kompozisyonu koru, yalnızca çizim üslubunu değiştir.',
  },
  {
    id: 'soft-pastel',
    name: 'Yumuşak Pastel',
    description: 'Suluboya dokusunda, pastel tonlarda yumuşak bir illüstrasyon.',
    prompt:
      'Bu fotoğrafı yumuşak pastel tonlarda, suluboya dokusunda bir illüstrasyona dönüştür. Kenarlar yumuşak ve dağılan fırça izleri şeklinde olsun, renk geçişleri hafif ve soluk kalsın, koyu kontur kullanma. Konuyu ve kompozisyonu koru, yalnızca çizim üslubunu değiştir.',
  },
  {
    id: 'bold-ink',
    name: 'Kalın Mürekkep',
    description: 'Kalın siyah konturlar ve düz renk alanlarıyla yüksek kontrast.',
    prompt:
      'Bu fotoğrafı kalın siyah mürekkep konturları ve düz, gölgesiz renk alanlarıyla yüksek kontrastlı bir çizime dönüştür. Ara tonlar yerine keskin ışık-gölge ayrımı kullan, çizgi kalınlığı belirgin olsun. Konuyu ve kompozisyonu koru, yalnızca çizim üslubunu değiştir.',
  },
  {
    id: 'retro-print',
    name: 'Retro Baskı',
    description: 'Eski matbaa baskısı gibi noktalı doku ve sınırlı sıcak palet.',
    prompt:
      'Bu fotoğrafı eski matbaa baskısını andıran bir çizime dönüştür: görünür noktalı tram dokusu, hafif kaymış renk katmanları, kirli beyaz kâğıt zemin ve turuncu, hardal, koyu mavi ile sınırlı sıcak bir palet. Konuyu ve kompozisyonu koru, yalnızca çizim üslubunu değiştir.',
  },
  {
    id: 'paper-cutout',
    name: 'Kâğıt Kesme',
    description: 'Üst üste yerleştirilmiş renkli kâğıt parçalarından kolaj etkisi.',
    prompt:
      'Bu fotoğrafı elle kesilmiş renkli kâğıt parçalarından yapılmış bir kolaja dönüştür. Biçimler sade ve düz renkli olsun, kenarlar hafif düzensiz kesilmiş görünsün, katmanlar arasında yumuşak gölgeler bulunsun. Konuyu ve kompozisyonu koru, yalnızca çizim üslubunu değiştir.',
  },
] as const satisfies readonly CartoonStyle[]

export type CartoonStyleId = (typeof CARTOON_STYLES)[number]['id']

/** Applied when a request sends no `style` field at all. */
export const DEFAULT_CARTOON_STYLE_ID: CartoonStyleId = 'classic'

/** The allow-list test. Anything this rejects never reaches the upstream call. */
export function isCartoonStyleId(value: unknown): value is CartoonStyleId {
  return (
    typeof value === 'string' &&
    CARTOON_STYLES.some((style) => style.id === value)
  )
}

/** Resolves an id already known to be in the allow-list to its preset. */
export function getCartoonStyle(id: CartoonStyleId): CartoonStyle {
  const style = CARTOON_STYLES.find((candidate) => candidate.id === id)
  // Unreachable while the argument is a CartoonStyleId; kept so a future
  // widening of the type fails loudly here rather than sending `undefined`
  // upstream as a prompt.
  if (!style) {
    throw new Error('Unknown cartoon style id: ' + id)
  }
  return style
}
