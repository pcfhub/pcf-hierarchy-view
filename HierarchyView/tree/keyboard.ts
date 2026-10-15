/**
 * 0.3.0's keyboard: the WAI-ARIA tree pattern from the template's shared
 * `lib/tree-keys`, applied to this tree's rows and reducer. Both layouts walk
 * the same rows in the same order, so one function serves the tree and the
 * org chart. Pure, so the suite proves every key; the component only applies
 * what comes back.
 *
 * Until 0.3.0 the tree had no keyboard of its own — each row's chevron and
 * name were Tab stops, forty rows forty stops. Now the tree is one stop and
 * the arrows move inside it (the skill's *A tree or a list of your own: one
 * tab stop, arrows inside*; the keys were measured reaching a control on this
 * form by pcf-code-editor's 1.6.9 probe).
 *
 * Two of this tree's own affordances sit on keys the pattern already has:
 *
 * - **`*` opens every sibling** — and on a row whose parent is an ancestor
 *   showing only its path child, the siblings are exactly what *Show all
 *   children* loads, so `*` loads them too.
 * - **→ on a node whose children could not be read** asks again, as *Retry*
 *   does: → is "show me what is under this".
 */

import { VisibleRow } from './reducer';
import { parentIndex, Press, TreeRow, treeKey } from '../lib/tree-keys/keys';
import { Buffer, isTypeAhead, nextBuffer, typeAhead } from '../lib/tree-keys/typeAhead';

export type KeyEffect = { type: 'toggle'; id: string } | { type: 'showAll'; id: string } | { type: 'retry'; id: string };

export interface KeyOutcome {
    focus: number;
    /** Reducer actions, in order. */
    effects: KeyEffect[];
    /** A record to open: Enter on any row but the current record's. */
    open: string | null;
    /** The key was the tree's — `preventDefault()` it. */
    handled: boolean;
    /** Type-ahead's search so far, for the next key. */
    buffer: Buffer | null;
}

/** Whether a row can open or close: it has children or might, or it shows only its path child. */
export const canOpen = (row: VisibleRow): boolean => row.partial || row.hasChildren !== 'no';

/** The rows as the shared map reads them. */
export function asTreeRows(rows: readonly VisibleRow[]): TreeRow[] {
    return rows.map((row) => ({
        id: row.node.id,
        level: row.depth + 1,
        expanded: canOpen(row) ? row.expanded : undefined,
        name: row.node.name,
    }));
}

/**
 * `aria-posinset` and `aria-setsize` for each row, among the siblings on
 * show — a flat list has no nesting for the browser to count from.
 */
export function positions(rows: readonly VisibleRow[]): { posInSet: number; setSize: number }[] {
    const tree = asTreeRows(rows);
    const parents = tree.map((_, i) => parentIndex(tree, i));
    const sizes = new Map<number, number>();
    const out = parents.map((parent) => {
        const posInSet = (sizes.get(parent) ?? 0) + 1;
        sizes.set(parent, posInSet);
        return { posInSet, setSize: 0 };
    });

    out.forEach((position, i) => {
        position.setSize = sizes.get(parents[i]) ?? 1;
    });

    return out;
}

/** What `press` does with the focus on `rows[focus]`. `now` is the clock type-ahead's buffer reads. */
export function onTreeKey(
    rows: readonly VisibleRow[],
    focus: number,
    press: Press,
    buffer: Buffer | null,
    now: number,
    page = 10,
): KeyOutcome {
    const none: KeyOutcome = { focus, effects: [], open: null, handled: false, buffer };

    if (rows.length === 0) {
        return none;
    }

    const at = Math.max(0, Math.min(focus, rows.length - 1));
    const tree = asTreeRows(rows);

    if (isTypeAhead(press)) {
        const next = nextBuffer(buffer, press.key, now);
        const found = typeAhead(tree, at, next.text);

        return { focus: found >= 0 ? found : at, effects: [], open: null, handled: true, buffer: next };
    }

    if (press.key === 'ArrowRight' && !press.ctrl && !press.meta && !press.alt && rows[at].failed !== null) {
        return { focus: at, effects: [{ type: 'retry', id: rows[at].node.id }], open: null, handled: true, buffer: null };
    }

    const result = treeKey(tree, at, press, page);

    if (!result.handled || result.action === 'copy') {
        // Ctrl+C is the browser's here: there is no path to copy, and a selected name is the user's.
        return { ...none, buffer: null };
    }

    const effects: KeyEffect[] = [...result.open, ...result.close].map((id) => ({ type: 'toggle', id }));

    if (press.key === '*') {
        const parent = parentIndex(tree, at);

        if (parent >= 0 && rows[parent].partial) {
            effects.push({ type: 'showAll', id: rows[parent].node.id });
        }
    }

    const row = rows[result.focus];
    const open = result.action === 'activate' && !row.isCurrent ? row.node.id : null;

    return { focus: result.focus, effects, open, handled: true, buffer: null };
}
