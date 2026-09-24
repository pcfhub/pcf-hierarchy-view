/**
 * A Web API row → a `Node`. Pure, and written against the row shape both
 * routes share: the primary key under its logical name, a lookup as
 * `_<column>_value`, and a formatted value under the column's
 * `@OData.Community.Display.V1.FormattedValue` annotation when the server
 * sent one.
 */

import { bareId, COUNT_ALIAS } from './fetchXml';
import { Node, QueryShape } from './types';

export const FORMATTED = '@OData.Community.Display.V1.FormattedValue';

/** A row as the Web API hands it over: anything under string keys. */
export type Row = Record<string, unknown>;

/**
 * The text a card shows for one column. The formatted value first — a
 * currency with its symbol, a choice as its label, a lookup as its name — the
 * raw value as a string when there is none, and `''` for a null, which a
 * FetchXML result does not even carry.
 */
export function formatted(row: Row, column: string): string {
    const candidates = [
        row[`${column}${FORMATTED}`],
        row[`_${column}_value${FORMATTED}`],
        row[column],
        row[`_${column}_value`],
    ];

    for (const value of candidates) {
        if (value !== null && value !== undefined && value !== '') {
            return typeof value === 'string' ? value : String(value);
        }
    }

    return '';
}

/** The parent's id off the lookup column, or `null` at the top. */
export const parentIdOf = (row: Row, column: string): string | null => bareId(row[`_${column}_value`]);

/**
 * The `CountChildren` aggregate, or `null` when the row has none — the
 * fallback route asks for none. Read leniently:
 * the probe decides whether the server sends a number or a string (P3).
 */
export function childCount(row: Row): number | null {
    const value = row[COUNT_ALIAS];

    if (value === null || value === undefined || value === '') {
        return null;
    }

    const count = Number(value);

    return Number.isFinite(count) && count >= 0 ? count : null;
}

/** One row → one node, or `null` for a row with no usable id. */
export function toNode(row: Row, q: QueryShape): Node | null {
    const id = bareId(row[q.primaryId]);

    if (id === null) {
        return null;
    }

    return {
        id,
        name: formatted(row, q.primaryName),
        parentId: parentIdOf(row, q.column),
        details: q.details.map((column) => ({ column, text: formatted(row, column) })),
        childCount: childCount(row),
    };
}

/** Every usable node in a result, in the order the server sent them. */
export const toNodes = (rows: Row[] | undefined, q: QueryShape): Node[] =>
    (rows ?? []).map((row) => toNode(row, q)).filter((node): node is Node => node !== null);
