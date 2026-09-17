/**
 * The queries, as strings. Pure: nothing here touches `context`, so the smoke
 * suite drives every function directly and asserts the exact text a server
 * would receive.
 *
 * Two routes, one shape. The **hierarchical** route sends FetchXML through
 * `retrieveMultipleRecords`, because only FetchXML has `eq-or-above` (the
 * whole ancestor chain in one call) and `rowaggregate='CountChildren'` (a
 * chevron drawn only where there is something under it). The **fallback**
 * route sends OData, because a lookup nobody flagged as hierarchical refuses
 * the operators and still answers a `$filter`.
 */

import { QueryShape } from './types';

/** A Dataverse logical name: lower-case, starts with a letter, `[a-z0-9_]`. */
export const isLogicalName = (value: string): boolean => /^[a-z][a-z0-9_]*$/.test(value);

/**
 * An id as the tree spells it — braces off, case folded — or `null` for a
 * non-string or an empty one. The platform hands ids down in three spellings
 * (`{UPPER}`, `lower`, `UPPER`), and a query built from the wrong one
 * matches nothing without saying so. Lenient about the shape on purpose: the
 * rig's fixture and a maker's sample data use short ids, and only
 * `contextInfo` needs the strict reading below.
 */
export function bareId(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const bare = value.replace(/[{}]/g, '').trim().toLowerCase();

    return bare === '' ? null : bare;
}

/** The five characters XML cares about, in attribute values. */
export const escapeXml = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * `detailColumns` as the maker typed it → the logical names in it, at most
 * three, without duplicates and without the columns the card already shows.
 * Anything that is not a logical name is dropped rather than sent — a typo
 * costs one line on the card, not the whole query.
 */
export function parseDetailColumns(raw: string | null | undefined, exclude: string[]): string[] {
    const out: string[] = [];

    (raw ?? '').split(',').forEach((part) => {
        const name = part.trim().toLowerCase();

        if (isLogicalName(name) && exclude.indexOf(name) === -1 && out.indexOf(name) === -1 && out.length < 3) {
            out.push(name);
        }
    });

    return out;
}

/** Every column a card needs, once each, primary key first. */
export function selectColumns(q: QueryShape): string[] {
    const out = [q.primaryId, q.primaryName, q.column];

    q.details.forEach((column) => {
        if (out.indexOf(column) === -1) {
            out.push(column);
        }
    });

    return out;
}

/** The alias `CountChildren` arrives under. */
export const COUNT_ALIAS = 'children';

const attributesXml = (q: QueryShape): string =>
    selectColumns(q).map((column) => `<attribute name='${column}'/>`).join('')
    + `<attribute name='${q.primaryId}' rowaggregate='CountChildren' alias='${COUNT_ALIAS}'/>`;

/**
 * The record and every ancestor, in one call. Order is not asked for: the
 * chain is put in order client-side by following the parent lookup, because
 * the server has no "depth" to sort by.
 */
export const ancestorsFetchXml = (q: QueryShape, recordId: string): string =>
    `<fetch><entity name='${q.entity}'>${attributesXml(q)}`
    + `<filter><condition attribute='${q.primaryId}' operator='eq-or-above' value='${escapeXml(recordId)}'/></filter>`
    + `</entity></fetch>`;

/** One node's children, by name, each with its own child count. */
export const childrenFetchXml = (q: QueryShape, parentId: string): string =>
    `<fetch><entity name='${q.entity}'>${attributesXml(q)}`
    + `<filter><condition attribute='${q.column}' operator='eq' value='${escapeXml(parentId)}'/></filter>`
    + `<order attribute='${q.primaryName}'/>`
    + `</entity></fetch>`;

/**
 * Whether the FetchXML is URL-encoded inside `?fetchXml=`.
 *
 * The Client API reference says an OData query "should be encoded" and a
 * FetchXML one "should not be"; the PCF reference says only that the
 * `fetchXml` parameter takes the query. The 0.0.1 probe sends both spellings
 * (SPEC.md, P1) and this constant follows its answer. It is the one place the
 * decision lives.
 */
export const FETCHXML_ENCODED = false;

/** `?fetchXml=…`, in the spelling P1 chose. */
export const queryString = (xml: string): string =>
    `?fetchXml=${FETCHXML_ENCODED ? encodeURIComponent(xml) : xml}`;

/** The fallback route's children: an OData `$filter` on the lookup's `_value`. */
export const childrenOData = (q: QueryShape, parentId: string): string =>
    `?$select=${selectColumns(q).join(',')}`
    + `&$filter=_${q.column}_value eq ${encodeURIComponent(parentId)}`
    + `&$orderby=${q.primaryName} asc`;

/** The fallback route's one record: what `retrieveRecord` is asked for. */
export const recordSelect = (q: QueryShape): string => `?$select=${selectColumns(q).join(',')}`;
