/**
 * The committed list of style ids that have a rendered preview asset under
 * public/styles/. May be legitimately empty — see task 0004 §5.3: rendering
 * costs a paid upstream generation per style, so this is the operator's list
 * to grow, one id at a time, after the picker exists.
 *
 * The filename IS the binding: an id listed here must have a matching
 * public/styles/<id>.webp file, and every .webp file under public/styles/
 * must be listed here. There is no separate manifest. `scripts/check-styles.mjs`
 * keeps the two in exact agreement, in both directions.
 *
 * A style with no entry here falls back to a CSS swatch derived from its
 * group — see components/style-card.tsx and the `[data-style-group=...]`
 * rules in app/globals.css.
 */
export const STYLE_PREVIEW_IDS: readonly string[] = []
