/**
 * Where nodes come from: one interface, three sources. The component asks
 * `loadChain()` once and `loadChildren(id)` per open node, and never knows
 * which route answered — so the routes can be swapped by the tests and by the
 * hub's demo without a branch in the rendering.
 *
 * The Web API is taken as the narrowest interface the two live routes use,
 * so the suite can hand in the rig's `context.webAPI` and assert the exact
 * calls.
 */

import { orderChain } from '../query/chain';
import { ancestorsFetchXml, childrenFetchXml, childrenOData, queryString, recordSelect } from '../query/fetchXml';
import { Row, toNode, toNodes } from '../query/records';
import { Node, QueryShape, Route } from '../query/types';

export interface QueryResult {
    entities: Row[];
    nextLink?: string;
    fetchXmlPagingCookie?: string;
}

export interface WebApiReader {
    retrieveMultipleRecords(entity: string, options?: string, maxPageSize?: number): Promise<QueryResult>;
    retrieveRecord(entity: string, id: string, options?: string): Promise<Row>;
}

export interface ChildrenResult {
    children: Node[];
    /** The node has more children than were loaded. */
    truncated: boolean;
}

export interface HierarchySource {
    route: Route;
    /** Top-most ancestor first, the current record last; empty if it was not found. */
    loadChain(): Promise<Node[]>;
    loadChildren(id: string): Promise<ChildrenResult>;
}

/** How far the fallback route walks before deciding the data is a loop. */
export const MAX_WALK = 20;

/**
 * The one readable sentence in a Web API rejection. The platform rejects with
 * a plain object whose `message` is the server's explanation; anything else
 * (an `Error`, a string, `null` from an older client) is rendered as text
 * rather than as `[object Object]`.
 */
export function faultMessage(error: unknown): string {
    if (error === null || error === undefined) {
        return '';
    }

    if (typeof error === 'string') {
        return error;
    }

    const message = (error as { message?: unknown }).message;

    return typeof message === 'string' ? message : String(error);
}

/** Cut a result at `max` and say whether anything was cut, by either signal the server gives. */
function page(nodes: Node[], result: QueryResult, max: number): ChildrenResult {
    const more = Boolean(result.nextLink) || Boolean(result.fetchXmlPagingCookie) || nodes.length > max;

    return { children: nodes.slice(0, max), truncated: more };
}

export interface LiveOptions {
    webAPI: WebApiReader;
    q: QueryShape;
    recordId: string;
    /** The record's own parent, off the bound lookup — the fallback route's first step up. */
    parentId: string | null;
    maxChildren: number;
}

/** The hierarchical route: FetchXML, `eq-or-above`, `CountChildren`. */
export function createFetchXmlSource(o: LiveOptions): HierarchySource {
    return {
        route: 'fetchxml',
        loadChain: () =>
            o.webAPI
                .retrieveMultipleRecords(o.q.entity, queryString(ancestorsFetchXml(o.q, o.recordId)))
                .then((result) => orderChain(toNodes(result.entities, o.q), o.recordId)),
        loadChildren: (id) =>
            o.webAPI
                .retrieveMultipleRecords(o.q.entity, queryString(childrenFetchXml(o.q, id)), o.maxChildren)
                .then((result) => page(toNodes(result.entities, o.q), result, o.maxChildren)),
    };
}

/**
 * The fallback route: the record by `retrieveRecord`, then its parent, then
 * the parent's parent, one call per level up to `MAX_WALK`; children by an
 * OData `$filter`. A parent that cannot be read — no access, or deleted under
 * the lookup — ends the chain there rather than failing it: the tree honestly
 * starts at the last record the user may see.
 */
export function createODataSource(o: LiveOptions): HierarchySource {
    const read = (id: string): Promise<Node | null> =>
        o.webAPI.retrieveRecord(o.q.entity, id, recordSelect(o.q)).then((row) => toNode(row, o.q));

    return {
        route: 'odata',
        loadChain: async () => {
            const current = await read(o.recordId);

            if (current === null) {
                return [];
            }

            const chain: Node[] = [current];
            const seen = new Set<string>([current.id]);
            // The lookup already told us the parent; the row confirms it.
            let next = current.parentId ?? o.parentId;

            while (next !== null && !seen.has(next) && chain.length < MAX_WALK) {
                seen.add(next);

                let parent: Node | null;

                try {
                    parent = await read(next);
                } catch {
                    parent = null;
                }

                if (parent === null) {
                    break;
                }

                chain.unshift(parent);
                next = parent.parentId;
            }

            return chain;
        },
        loadChildren: (id) =>
            o.webAPI
                .retrieveMultipleRecords(o.q.entity, childrenOData(o.q, id), o.maxChildren)
                .then((result) => page(toNodes(result.entities, o.q), result, o.maxChildren)),
    };
}
