/**
 * The 0.3.0 inputs read for what they mean. Pure, so the suite proves each
 * spelling a host hands over; `index.ts` may export nothing but the control.
 */

import type { Layout } from './components/HierarchyViewControl';

/**
 * A TwoOptions input. A blank one arrives as `null` on a form — the
 * manifest's `default-value` never does (SPEC.md C5) — and the hub's harness
 * hands one over as the string `"false"`, which `Boolean()` reads as on.
 */
export function asBoolean(raw: unknown): boolean {
    return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

/** `layout`: the chart only when asked for; blank (`null`, C5) or anything else is the tree. */
export const asLayout = (raw: unknown): Layout => (raw === 'chart' ? 'chart' : 'tree');
