/**
 * The ancestor chain, put in order. `eq-or-above` answers the record and every
 * ancestor as a set; the tree wants them top-most first. Pure.
 */

import { Node } from './types';

/**
 * `rows` (any order, possibly with strangers in it) → the chain from the
 * top-most ancestor down to `recordId`, inclusive.
 *
 * Follows `parentId` upward from the record. Stops at the first node whose
 * parent is `null`, whose parent is not in `rows` (a parent the user cannot
 * read — the chain honestly starts there), or that has already been visited
 * (a cycle in the data, which Dataverse forbids and this still survives).
 * An empty array means the record itself was not in `rows`.
 */
export function orderChain(rows: Node[], recordId: string): Node[] {
    const byId = new Map<string, Node>();

    rows.forEach((node) => {
        byId.set(node.id, node);
    });

    const chain: Node[] = [];
    const seen = new Set<string>();
    let current = byId.get(recordId);

    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        chain.push(current);
        current = current.parentId === null ? undefined : byId.get(current.parentId);
    }

    return chain.reverse();
}
