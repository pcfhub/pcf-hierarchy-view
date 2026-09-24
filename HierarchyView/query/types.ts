/**
 * What every query needs to know about the table, decided once per mount from
 * the bound lookup and the entity metadata. Every member is a logical name
 * that has passed `isLogicalName`, so a query built from it cannot carry
 * anything but `[a-z0-9_]`.
 */
export interface QueryShape {
    /** The table's logical name — `account`. */
    entity: string;
    /** Its primary key column — `accountid`. */
    primaryId: string;
    /** Its primary name column — `name`. */
    primaryName: string;
    /** The bound lookup's logical name — the column children are filtered on. */
    column: string;
    /** Extra columns shown on a card, already filtered to logical names. */
    details: string[];
}

/** One record as the tree holds it, whichever route it arrived by. */
export interface Node {
    /** Bare lower-case GUID. */
    id: string;
    name: string;
    /** Bare lower-case GUID of the parent, or `null` at the top. */
    parentId: string | null;
    /** In `details` order, one entry per column, formatted; `''` for a null. */
    details: { column: string; text: string }[];
    /**
     * How many children the server says this node has, or `null` when the
     * route cannot know — the fallback route.
     */
    childCount: number | null;
}

/** Which of the three ways the tree is being read. */
export type Route = 'fetchxml' | 'odata';
