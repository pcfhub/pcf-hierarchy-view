/**
 * `sampleData` → nodes. The input is a maker-typed JSON string, so this
 * never throws and never trusts a field: a record without a usable `id` is
 * dropped, a `parentId` naming no record makes a root, `childCount` is read
 * only when it is a non-negative number.
 *
 *   { "current": "c1",
 *     "records": [ { "id": "r1", "name": "Contoso", "parentId": null },
 *                  { "id": "c1", "name": "Contoso West", "parentId": "r1",
 *                    "details": { "City": "Seattle" }, "childCount": 2 } ] }
 *
 * Ids here are any non-empty strings, not GUIDs — the demo's are `c1` and
 * `r1` — which is why the tree never assumes a GUID shape itself.
 */

import { Node } from '../query/types';

export interface SampleTree {
    currentId: string;
    nodes: Node[];
}

export type SampleResult = { ok: true; tree: SampleTree } | { ok: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string =>
    value === null || value === undefined ? '' : typeof value === 'string' ? value : String(value);

export function parseSampleData(raw: string | null | undefined): SampleResult {
    if (typeof raw !== 'string' || raw.trim() === '') {
        return { ok: false };
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false };
    }

    if (!isRecord(parsed) || !Array.isArray(parsed.records)) {
        return { ok: false };
    }

    const nodes: Node[] = [];
    const ids = new Set<string>();

    parsed.records.forEach((entry) => {
        if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id === '' || ids.has(entry.id)) {
            return;
        }

        ids.add(entry.id);

        const details = isRecord(entry.details)
            ? Object.keys(entry.details).slice(0, 3).map((column) => ({ column, text: text((entry.details as Record<string, unknown>)[column]) }))
            : [];
        const count = typeof entry.childCount === 'number' && Number.isFinite(entry.childCount) && entry.childCount >= 0
            ? Math.floor(entry.childCount)
            : null;

        nodes.push({
            id: entry.id,
            name: text(entry.name),
            parentId: typeof entry.parentId === 'string' && entry.parentId !== '' ? entry.parentId : null,
            details,
            childCount: count,
        });
    });

    // A parent nobody listed is no parent: the record is a root.
    nodes.forEach((node) => {
        if (node.parentId !== null && !ids.has(node.parentId)) {
            node.parentId = null;
        }
    });

    const currentId = typeof parsed.current === 'string' && ids.has(parsed.current) ? parsed.current : nodes[0]?.id;

    if (!currentId) {
        return { ok: false };
    }

    return { ok: true, tree: { currentId, nodes } };
}
