/**
 * Everything read off `context`, in one file, each read guarded — because
 * every member here is one a host can withhold: `webAPI` and `utils` behind
 * optional features, `contextInfo` and `page` undocumented, the lookup's two
 * methods absent on the hub's harness. The rest of the control is written
 * against what this file returns, never against `context`.
 */

import { IInputs } from './generated/ManifestTypes';
import { bareId, isLogicalName } from './query/fetchXml';
import { WebApiReader } from './data/HierarchyData';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PrimaryColumns {
    primaryId: string;
    primaryName: string;
}

export interface HostReading {
    /** `context.webAPI` when it has the two read methods; `null` on canvas or a declined feature. */
    webAPI: WebApiReader | null;
    /** The lookup's target table, or `''` when nothing says. */
    target: string;
    /** The bound column's logical name, or `''` when the host publishes no metadata. */
    column: string;
    /** The record this control sits on, bare and lower-case, or `null` on an unsaved record. */
    recordId: string | null;
    /** The record's parent, off the bound lookup, or `null` at the top. */
    parentId: string | null;
    /** The organisation URL a metadata `fetch` starts from, or `null`. */
    clientUrl: string | null;
    /** Opens a record, or `null` when the host cannot. */
    openRecord: ((id: string) => Promise<void>) | null;
    /** Reads the table's primary columns, or `null` without the Utility feature. */
    primaryColumns: ((target: string) => Promise<PrimaryColumns>) | null;
    /** The maker's label, for the accessible name. */
    label: string;
    readable: boolean;
    visible: boolean;
    isRTL: boolean;
    /** `true`, `false`, or `undefined` for a host that publishes no theme. */
    dark: boolean | undefined;
    allocatedWidth: number | null;
}

/**
 * `getTargetEntityType()` is the only way to know the target — no manifest
 * attribute carries it — with `raw[0].entityType` as the fallback for a host
 * whose property bag has no methods (the hub's harness). Copied from
 * `pcf-lookup-search`, which measured all three states.
 */
export function resolveTarget(parameter: any): string {
    if (parameter && typeof parameter.getTargetEntityType === 'function') {
        try {
            const target = parameter.getTargetEntityType();

            if (typeof target === 'string' && target) {
                return target.toLowerCase();
            }
        } catch {
            // A host that has the method and cannot answer it.
        }
    }

    const fromValue = parameter?.raw?.[0]?.entityType;

    return typeof fromValue === 'string' ? fromValue.toLowerCase() : '';
}

/** `attributes.LogicalName`, when it is a logical name. */
export function resolveBoundColumn(parameter: any): string {
    const name = parameter?.attributes?.LogicalName;

    return typeof name === 'string' && isLogicalName(name.toLowerCase()) ? name.toLowerCase() : '';
}

/** `mode.contextInfo.entityId` — undocumented, so read through a cast and never required. */
export function resolveRecordId(context: ComponentFramework.Context<IInputs>): string | null {
    const info = (context.mode as any)?.contextInfo;

    return bareId(info?.entityId);
}

/**
 * `page.getClientUrl()` first — not in the typings, present on a model-driven
 * form, and the only honest answer on an on-premises organisation whose URL
 * carries the organisation in the path — then the `Xrm` global, then `null`.
 * Same order as `pcf-data-table` 0.5.0.
 */
export function lookupClientUrl(context: ComponentFramework.Context<IInputs>): string | null {
    const page = (context as any).page;

    try {
        const fromPage = typeof page?.getClientUrl === 'function' ? page.getClientUrl() : undefined;

        if (typeof fromPage === 'string' && fromPage !== '') {
            return fromPage.replace(/\/$/, '');
        }
    } catch {
        // Fall through to the global.
    }

    try {
        const xrm = (globalThis as any).Xrm;
        const fromGlobal = xrm?.Utility?.getGlobalContext?.()?.getClientUrl?.();

        if (typeof fromGlobal === 'string' && fromGlobal !== '') {
            return fromGlobal.replace(/\/$/, '');
        }
    } catch {
        // No global either.
    }

    return null;
}

/**
 * Whether the bound lookup's relationship is hierarchical, asked of
 * `EntityDefinitions(…)/OneToManyRelationships` with a same-origin `fetch` —
 * `context.webAPI` addresses records, not metadata. **Any failure answers
 * `false`**: a refused or unreachable metadata read means the fallback route,
 * which works everywhere, never an error the user sees. Cached per table for
 * the life of the page, because the answer does not change under a form.
 */
const hierarchicalCache = new Map<string, Promise<boolean>>();

export function isHierarchical(clientUrl: string, target: string, column: string): Promise<boolean> {
    const key = `${clientUrl}|${target}|${column}`;
    const cached = hierarchicalCache.get(key);

    if (cached) {
        return cached;
    }

    const url = `${clientUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${encodeURIComponent(target)}')`
        + '/OneToManyRelationships?$select=ReferencingAttribute,ReferencedEntity,ReferencingEntity,IsHierarchical';

    const answer = (typeof fetch === 'function'
        ? fetch(url, {
            headers: { Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
            credentials: 'same-origin',
        })
        : Promise.reject(new Error('fetch is not available')))
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((body: any) => {
            const rows: any[] = Array.isArray(body?.value) ? body.value : [];

            return rows.some((row) =>
                String(row.ReferencingAttribute ?? '').toLowerCase() === column
                && String(row.ReferencingEntity ?? '').toLowerCase() === target
                && String(row.ReferencedEntity ?? '').toLowerCase() === target
                && row.IsHierarchical === true);
        })
        .catch(() => false);

    hierarchicalCache.set(key, answer);

    return answer;
}

/** For the suite, and for a page that changes environment under the control — which no form does. */
export function forgetHierarchical(): void {
    hierarchicalCache.clear();
}

/**
 * `getEntityMetadata` resolves with a class instance whose public surface is
 * prototype getters — read by name, never through `Object.keys`.
 */
function primaryColumnsReader(context: ComponentFramework.Context<IInputs>): HostReading['primaryColumns'] {
    const utils = (context as any).utils;

    if (typeof utils?.getEntityMetadata !== 'function') {
        return null;
    }

    return (target: string) =>
        utils.getEntityMetadata(target).then((metadata: any) => {
            const primaryId = String(metadata?.PrimaryIdAttribute ?? '').toLowerCase();
            const primaryName = String(metadata?.PrimaryNameAttribute ?? '').toLowerCase();

            return {
                primaryId: isLogicalName(primaryId) ? primaryId : `${target}id`,
                primaryName: isLogicalName(primaryName) ? primaryName : 'name',
            };
        });
}

export function readHost(context: ComponentFramework.Context<IInputs>): HostReading {
    const parameter: any = context.parameters.value;
    const webAPI: any = (context as any).webAPI;
    const navigation: any = (context as any).navigation;
    const security = parameter?.security;
    const target = resolveTarget(parameter);
    const width = context.mode.allocatedWidth;

    return {
        webAPI:
            webAPI
            && typeof webAPI.retrieveMultipleRecords === 'function'
            && typeof webAPI.retrieveRecord === 'function'
                ? (webAPI as WebApiReader)
                : null,
        target,
        column: resolveBoundColumn(parameter),
        recordId: resolveRecordId(context),
        parentId: bareId(parameter?.raw?.[0]?.id),
        clientUrl: lookupClientUrl(context),
        openRecord:
            typeof navigation?.openForm === 'function' && target
                ? (id: string) => navigation.openForm({ entityName: target, entityId: id }).then(() => undefined)
                : null,
        primaryColumns: primaryColumnsReader(context),
        label: context.mode.label,
        // Compared against `false`, never read as a boolean — an unmapped
        // optional binding is `{}` and a column with no profile is `undefined`.
        readable: security?.readable !== false,
        visible: context.mode.isVisible,
        isRTL: context.userSettings.isRTL,
        dark: (context as any).fluentDesignLanguage?.isDarkTheme,
        allocatedWidth: typeof width === 'number' && width > 0 ? width : null,
    };
}
