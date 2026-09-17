/**
 * The tree's state and every transition it makes, as a pure reducer so the
 * smoke suite can drive it without React. The component owns *when* to load;
 * this owns what is known, what is open, and what is on screen.
 *
 * Two kinds of node are only partly known, and the distinction is the design:
 * an **ancestor** on the chain has one child the tree knows about — the next
 * node down the chain — and all its other children unloaded, so it renders
 * that one child with a *show all* affordance rather than a chevron; any
 * other expanded node with no children loaded is **pending**, and the
 * component loads it.
 */

import { Node } from '../query/types';

export interface TreeState {
    /** Every node seen, by id. */
    nodes: Record<string, Node>;
    /** Children ids per node, present only once loaded. */
    children: Record<string, string[]>;
    /** For a chain node whose children are not loaded: the one child on the path. */
    pathChild: Record<string, string>;
    expanded: Record<string, true>;
    loading: Record<string, true>;
    /** The platform's message, per node whose children could not be read. */
    failed: Record<string, string>;
    /** Nodes whose children were cut at `maxChildren`. */
    truncated: Record<string, true>;
    rootId: string | null;
    currentId: string;
    /** The chain has been answered, one way or the other. */
    ready: boolean;
    /** Why the chain could not be shown: the platform's message, or `not-found`. */
    error: string | null;
}

export type TreeAction =
    | { type: 'reset'; currentId: string }
    | { type: 'chainLoaded'; chain: Node[]; initialDepth: number }
    | { type: 'chainFailed'; message: string }
    | { type: 'loading'; id: string }
    | { type: 'childrenLoaded'; id: string; children: Node[]; truncated: boolean; expandChildren: boolean }
    | { type: 'loadFailed'; id: string; message: string }
    | { type: 'toggle'; id: string }
    | { type: 'retry'; id: string }
    | { type: 'showAll'; id: string };

export const initialState = (currentId: string): TreeState => ({
    nodes: {},
    children: {},
    pathChild: {},
    expanded: {},
    loading: {},
    failed: {},
    truncated: {},
    rootId: null,
    currentId,
    ready: false,
    error: null,
});

const without = <T>(bag: Record<string, T>, id: string): Record<string, T> => {
    const next = { ...bag };
    delete next[id];
    return next;
};

export function reduce(state: TreeState, action: TreeAction): TreeState {
    switch (action.type) {
        case 'reset':
            return initialState(action.currentId);

        case 'chainLoaded': {
            if (action.chain.length === 0) {
                return { ...state, ready: true, error: 'not-found' };
            }

            const nodes = { ...state.nodes };
            const pathChild: Record<string, string> = {};
            const expanded: Record<string, true> = {};

            action.chain.forEach((node, index) => {
                nodes[node.id] = node;

                if (index < action.chain.length - 1) {
                    pathChild[node.id] = action.chain[index + 1].id;
                    expanded[node.id] = true;
                }
            });

            const current = action.chain[action.chain.length - 1];

            if (action.initialDepth >= 1) {
                expanded[current.id] = true;
            }

            return {
                ...state,
                nodes,
                pathChild,
                expanded,
                rootId: action.chain[0].id,
                currentId: current.id,
                ready: true,
                error: null,
            };
        }

        case 'chainFailed':
            return { ...state, ready: true, error: action.message };

        case 'loading':
            return { ...state, loading: { ...state.loading, [action.id]: true } };

        case 'childrenLoaded': {
            const nodes = { ...state.nodes };
            const expanded = { ...state.expanded };

            action.children.forEach((child) => {
                // A child already known — the path child, or the current record
                // seen from its parent — keeps the fresher row.
                nodes[child.id] = child;

                if (action.expandChildren) {
                    expanded[child.id] = true;
                }
            });

            const parent = nodes[action.id];

            if (parent && !action.truncated) {
                // Now the count is known whichever route answered.
                nodes[action.id] = { ...parent, childCount: action.children.length };
            }

            return {
                ...state,
                nodes,
                expanded,
                children: { ...state.children, [action.id]: action.children.map((child) => child.id) },
                pathChild: without(state.pathChild, action.id),
                loading: without(state.loading, action.id),
                failed: without(state.failed, action.id),
                truncated: action.truncated
                    ? { ...state.truncated, [action.id]: true }
                    : without(state.truncated, action.id),
            };
        }

        case 'loadFailed':
            return {
                ...state,
                loading: without(state.loading, action.id),
                failed: { ...state.failed, [action.id]: action.message },
            };

        case 'toggle':
            return {
                ...state,
                expanded: state.expanded[action.id] ? without(state.expanded, action.id) : { ...state.expanded, [action.id]: true },
                // A failed load is retried by opening the node again.
                failed: state.expanded[action.id] ? state.failed : without(state.failed, action.id),
            };

        case 'retry':
            // Forget the failure; the node is still open, so it is pending again.
            return { ...state, failed: without(state.failed, action.id), expanded: { ...state.expanded, [action.id]: true } };

        case 'showAll':
            // Forget the one known child; the node becomes pending and loads all.
            return {
                ...state,
                pathChild: without(state.pathChild, action.id),
                expanded: { ...state.expanded, [action.id]: true },
                failed: without(state.failed, action.id),
            };

        default:
            return state;
    }
}

export type HasChildren = 'yes' | 'no' | 'unknown';

/** What the chevron can honestly say about a node. */
export function hasChildren(state: TreeState, id: string): HasChildren {
    const loaded = state.children[id];

    if (loaded) {
        return loaded.length > 0 || state.truncated[id] ? 'yes' : 'no';
    }

    if (state.pathChild[id]) {
        return 'yes';
    }

    const count = state.nodes[id]?.childCount;

    if (count === null || count === undefined) {
        return 'unknown';
    }

    return count > 0 ? 'yes' : 'no';
}

export interface VisibleRow {
    node: Node;
    /** 0 at the top of the chain. */
    depth: number;
    /** Depth relative to the current record: negative above it, 0 at it. */
    depthBelowCurrent: number;
    isCurrent: boolean;
    /** On the chain above the current record. */
    isAncestor: boolean;
    expanded: boolean;
    hasChildren: HasChildren;
    loading: boolean;
    failed: string | null;
    truncated: boolean;
    /** How many children are loaded — what a truncation notice counts. */
    loadedCount: number;
    /** Only the path child is shown; the node's other children are unloaded. */
    partial: boolean;
}

/** The ids above the current record, by following `parentId` through what is known. */
export function ancestorIds(state: TreeState): Set<string> {
    const out = new Set<string>();
    let cursor = state.nodes[state.currentId]?.parentId ?? null;

    while (cursor !== null && !out.has(cursor) && state.nodes[cursor]) {
        out.add(cursor);
        cursor = state.nodes[cursor].parentId;
    }

    return out;
}

/** The rows on screen, top to bottom, as a flat list a `role="tree"` renders. */
export function visibleRows(state: TreeState): VisibleRow[] {
    const rows: VisibleRow[] = [];

    if (state.rootId === null) {
        return rows;
    }

    const ancestors = ancestorIds(state);
    const currentDepth = ancestors.size;
    const seen = new Set<string>();

    const walk = (id: string, depth: number): void => {
        const node = state.nodes[id];

        if (!node || seen.has(id)) {
            return;
        }

        seen.add(id);

        const loaded = state.children[id];
        const partial = !loaded && Boolean(state.pathChild[id]);
        const expanded = Boolean(state.expanded[id]);

        rows.push({
            node,
            depth,
            depthBelowCurrent: depth - currentDepth,
            isCurrent: id === state.currentId,
            isAncestor: ancestors.has(id),
            expanded,
            hasChildren: hasChildren(state, id),
            loading: Boolean(state.loading[id]),
            failed: state.failed[id] ?? null,
            truncated: Boolean(state.truncated[id]),
            loadedCount: loaded ? loaded.length : 0,
            partial,
        });

        if (!expanded) {
            return;
        }

        const next = loaded ?? (state.pathChild[id] ? [state.pathChild[id]] : []);

        next.forEach((childId) => {
            walk(childId, depth + 1);
        });
    };

    walk(state.rootId, 0);

    return rows;
}

/**
 * Where `id` sits relative to the current record: 0 at it, positive below it
 * (its child is 1), negative above it, `null` when the two are not on one
 * line — a sibling's child, say. Decides how far the initial expansion goes.
 */
export function relativeDepth(state: TreeState, id: string): number | null {
    const climb = (from: string, to: string): number | null => {
        let depth = 0;
        let cursor: string | null = from;
        const seen = new Set<string>();

        while (cursor !== null && !seen.has(cursor)) {
            if (cursor === to) {
                return depth;
            }

            seen.add(cursor);
            cursor = state.nodes[cursor]?.parentId ?? null;
            depth += 1;
        }

        return null;
    };

    const below = climb(id, state.currentId);

    if (below !== null) {
        return below;
    }

    const above = climb(state.currentId, id);

    return above === null ? null : -above;
}

/**
 * The nodes the component should load now: open, unloaded, not partial, not
 * already loading or failed — and not known to be childless, because a query
 * for the children of a node the server already counted at zero is a round
 * trip that answers nothing.
 */
export const pendingLoads = (state: TreeState): string[] =>
    Object.keys(state.expanded).filter(
        (id) =>
            Boolean(state.nodes[id])
            && !state.children[id]
            && !state.pathChild[id]
            && !state.loading[id]
            && !state.failed[id]
            && hasChildren(state, id) !== 'no',
    );
