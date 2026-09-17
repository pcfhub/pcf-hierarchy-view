/**
 * **TEMPORARY. Delete this file and the import in `index.ts` before 0.1.0 is
 * built.** It ships no behaviour. It exists to answer the questions under
 * *Measured — the 0.0.1 probe* in `SPEC.md` that only a real form can — whether
 * the PCF Web API accepts a FetchXML query and how it wants it encoded, what a
 * hierarchical operator returns and what it refuses, and what a bound
 * Lookup.Simple looks like from inside a field control.
 *
 * Every answer is printed into the control itself, so the person on the form
 * needs no developer tools, and mirrored to the console under one tag. The
 * context is read through a getter on every pass, never parked (the dead-
 * snapshot lesson from Data Table 0.5.0). One active question — P8, opening a
 * record — sits behind a button because it navigates away.
 */

import * as React from 'react';
import { IInputs } from './generated/ManifestTypes';

/* eslint-disable @typescript-eslint/no-explicit-any */

const TAG = '[hierarchy-view probe 0.0.1]';

export interface ProbeProps {
    context: () => ComponentFramework.Context<IInputs>;
    /** updateView passes so far, counted by the class. */
    passes: number;
}

type Log = (line: string) => void;

const short = (value: unknown, max = 600): string => {
    let text: string;
    try {
        text = JSON.stringify(value, (_k, v) => (typeof v === 'function' ? '[function]' : v), 1) ?? String(value);
    } catch {
        text = String(value);
    }
    return text.length > max ? `${text.slice(0, max)}… (${text.length} chars)` : text;
};

const fault = (e: unknown): string => {
    const o = e as any;
    return short({
        ctor: o?.constructor?.name,
        errorCode: o?.errorCode,
        code: o?.code,
        message: o?.message,
        title: o?.title,
        keys: o && typeof o === 'object' ? Object.keys(o) : undefined,
    });
};

const bare = (id: string): string => id.replace(/[{}]/g, '').toLowerCase();

const fetchXml = (entity: string, attrs: string[], filter: string, extra = ''): string =>
    `<fetch>` +
    `<entity name='${entity}'>` +
    attrs.map((a) => `<attribute name='${a}'/>`).join('') +
    extra +
    `<filter>${filter}</filter>` +
    `</entity>` +
    `</fetch>`;

async function run(ctx: () => ComponentFramework.Context<IInputs>, log: Log): Promise<void> {
    const c = ctx() as any;
    const parameter = c.parameters?.value;

    // ---- P6 / P9: the bound lookup as the control sees it -------------------
    log(`P6 parameters.value keys: ${short(parameter ? Object.keys(parameter) : 'ABSENT')}`);
    log(`P6 type=${short(parameter?.type)} raw=${short(parameter?.raw)} security=${short(parameter?.security)} error=${short(parameter?.error)}`);
    const attributes = parameter?.attributes;
    log(`P6 attributes keys: ${short(attributes ? Object.keys(attributes) : attributes)}`);
    log(`P6 attributes.LogicalName=${short(attributes?.LogicalName)} DisplayName=${short(attributes?.DisplayName)} Targets=${short(attributes?.Targets)} Type=${short(attributes?.Type)}`);
    let target = '';
    try {
        target = typeof parameter?.getTargetEntityType === 'function' ? parameter.getTargetEntityType() : '(no method)';
        log(`P9 getTargetEntityType() = ${short(target)}; raw[0].entityType = ${short(parameter?.raw?.[0]?.entityType)}; getViewId = ${short(typeof parameter?.getViewId === 'function' ? parameter.getViewId() : '(no method)')}`);
    } catch (e) {
        log(`P9 getTargetEntityType THREW ${fault(e)}`);
    }
    if (!target || target === '(no method)') {
        target = parameter?.raw?.[0]?.entityType ?? 'account';
    }
    const column: string = attributes?.LogicalName ?? 'parentaccountid';

    // ---- P7: the record's own identity ------------------------------------
    const info = c.mode?.contextInfo;
    log(`P7 mode.contextInfo = ${short(info)}; mode keys: ${short(Object.keys(c.mode ?? {}))}`);
    const recordId = info?.entityId ? bare(String(info.entityId)) : '';
    if (!recordId) {
        log('P7 no entityId — the rest needs a saved record. Save, then reload the form.');
    }

    // ---- P11: metadata ------------------------------------------------------
    let pk = `${target}id`;
    let nameAttr = 'name';
    try {
        if (typeof c.utils?.getEntityMetadata === 'function') {
            const t0 = performance.now();
            const md = await c.utils.getEntityMetadata(target);
            log(`P11 getEntityMetadata(${target}) in ${Math.round(performance.now() - t0)} ms: PrimaryIdAttribute=${short(md?.PrimaryIdAttribute)} PrimaryNameAttribute=${short(md?.PrimaryNameAttribute)} EntitySetName=${short(md?.EntitySetName)} ownKeys=${short(Object.keys(md ?? {}))}`);
            pk = md?.PrimaryIdAttribute ?? pk;
            nameAttr = md?.PrimaryNameAttribute ?? nameAttr;
        } else {
            log('P11 utils.getEntityMetadata ABSENT');
        }
    } catch (e) {
        log(`P11 getEntityMetadata THREW ${fault(e)}`);
    }

    // ---- P5: is the lookup hierarchical -------------------------------------
    const clientUrl: string | undefined =
        (typeof c.page?.getClientUrl === 'function' ? c.page.getClientUrl() : undefined) ??
        (globalThis as any).Xrm?.Utility?.getGlobalContext?.()?.getClientUrl?.();
    log(`P5 clientUrl from page=${short(typeof c.page?.getClientUrl === 'function' ? c.page.getClientUrl() : '(no page.getClientUrl)')} resolved=${short(clientUrl)}`);
    if (clientUrl) {
        const url = `${clientUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${target}')/OneToManyRelationships?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,IsHierarchical`;
        try {
            const t0 = performance.now();
            const res = await fetch(url, { headers: { Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }, credentials: 'same-origin' });
            const ms = Math.round(performance.now() - t0);
            const body = await res.json();
            const rows: any[] = body?.value ?? [];
            const self = rows.filter((r) => r.ReferencingEntity === target);
            log(`P5 OneToManyRelationships ${res.status} in ${ms} ms, ${rows.length} rows, ${self.length} self-referential: ${short(self.map((r) => ({ col: r.ReferencingAttribute, hier: r.IsHierarchical, schema: r.SchemaName })))}`);
        } catch (e) {
            log(`P5 fetch THREW ${fault(e)}`);
        }
    }

    const webAPI = c.webAPI;
    if (!webAPI || typeof webAPI.retrieveMultipleRecords !== 'function') {
        log(`webAPI = ${short(webAPI ? Object.keys(webAPI) : webAPI)} — no retrieveMultipleRecords, P1–P4/P10 skipped`);
        return;
    }
    if (!recordId) {
        return;
    }

    const attrs = [pk, nameAttr, column];
    const count = `<attribute name='${pk}' rowaggregate='CountChildren' alias='children'/>`;

    // ---- P1 / P2 / P3: fetchXml, encoded then raw ----------------------------
    const chainXml = fetchXml(target, attrs, `<condition attribute='${pk}' operator='eq-or-above' value='${recordId}'/>`, count);
    for (const [label, options] of [['encoded', `?fetchXml=${encodeURIComponent(chainXml)}`], ['raw', `?fetchXml=${chainXml}`]] as const) {
        try {
            const t0 = performance.now();
            const r = await webAPI.retrieveMultipleRecords(target, options);
            const first = r.entities?.[0];
            log(`P1 ${label} fetchXml eq-or-above: OK in ${Math.round(performance.now() - t0)} ms, ${r.entities?.length} rows; result keys=${short(Object.keys(r))}`);
            log(`P2 first row keys: ${short(first ? Object.keys(first) : first)}`);
            log(`P3 children alias: ${short(first?.children)} (${typeof first?.children}); all: ${short(r.entities?.map((e: any) => ({ id: e[pk], name: e[nameAttr], parent: e[`_${column}_value`], children: e.children })))}`);
        } catch (e) {
            log(`P1 ${label} fetchXml eq-or-above REFUSED ${fault(e)}`);
        }
    }

    // ---- P3b: does rowaggregate need aggregate='true'? Plain attributes only.
    try {
        const r = await webAPI.retrieveMultipleRecords(target, `?fetchXml=${encodeURIComponent(fetchXml(target, attrs, `<condition attribute='${pk}' operator='eq-or-above' value='${recordId}'/>`))}`);
        log(`P3b eq-or-above without rowaggregate: ${r.entities?.length} rows`);
    } catch (e) {
        log(`P3b eq-or-above without rowaggregate REFUSED ${fault(e)}`);
    }

    // ---- P4: a hierarchical operator on a lookup that is not hierarchical --
    const other = target === 'account' ? 'masterid' : column;
    try {
        const r = await webAPI.retrieveMultipleRecords(target, `?fetchXml=${encodeURIComponent(fetchXml(target, [pk, nameAttr], `<condition attribute='${other}' operator='eq-or-above' value='${recordId}'/>`))}`);
        log(`P4 eq-or-above on ${other}: OK?! ${r.entities?.length} rows`);
    } catch (e) {
        log(`P4 eq-or-above on ${other} REFUSED ${fault(e)}`);
    }
    try {
        const r = await webAPI.retrieveMultipleRecords(target, `?fetchXml=${encodeURIComponent(fetchXml(target, [pk, nameAttr], `<condition attribute='${pk}' operator='eq-or-above' value='${recordId}'/>`.replace(pk, other)))}`);
        log(`P4b eq-or-above with attribute=${other} (lookup column, not pk): OK?! ${r.entities?.length} rows`);
    } catch (e) {
        log(`P4b eq-or-above attribute=${other} REFUSED ${fault(e)}`);
    }

    // ---- P10: children of the parent (self + siblings), page size 1 --------
    const parentId = parameter?.raw?.[0]?.id ? bare(parameter.raw[0].id) : recordId;
    try {
        const r = await webAPI.retrieveMultipleRecords(target, `?fetchXml=${encodeURIComponent(fetchXml(target, attrs, `<condition attribute='${column}' operator='eq' value='${parentId}'/>`, `${count}<order attribute='${nameAttr}'/>`))}`, 1);
        log(`P10 children of ${parentId} maxPageSize=1: ${r.entities?.length} rows; keys=${short(Object.keys(r))}; nextLink=${short((r as any).nextLink)}; cookie=${short((r as any).fetchXmlPagingCookie, 200)}`);
    } catch (e) {
        log(`P10 children fetchXml REFUSED ${fault(e)}`);
    }

    // ---- P12: the fallback route, OData ------------------------------------
    try {
        const r = await webAPI.retrieveMultipleRecords(target, `?$select=${attrs.join(',')}&$filter=_${column}_value eq ${parentId}&$orderby=${nameAttr} asc`, 50);
        const first = r.entities?.[0];
        log(`P12 OData children: ${r.entities?.length} rows; first keys=${short(first ? Object.keys(first) : first)}`);
    } catch (e) {
        log(`P12 OData children REFUSED ${fault(e)}`);
    }
    try {
        const r = await webAPI.retrieveRecord(target, parentId, `?$select=${attrs.join(',')}`);
        log(`P12 retrieveRecord(parent): keys=${short(Object.keys(r))}`);
    } catch (e) {
        log(`P12 retrieveRecord REFUSED ${fault(e)}`);
    }

    // ---- P13: under, the other direction, for the count of the subtree ------
    try {
        const r = await webAPI.retrieveMultipleRecords(target, `?fetchXml=${encodeURIComponent(fetchXml(target, [pk], `<condition attribute='${pk}' operator='under' value='${recordId}'/>`))}`);
        log(`P13 under ${recordId}: ${r.entities?.length} descendants`);
    } catch (e) {
        log(`P13 under REFUSED ${fault(e)}`);
    }

    log('done — P8 is the button.');
}

export const Probe: React.FC<ProbeProps> = (props) => {
    const [lines, setLines] = React.useState<string[]>([]);
    const log = React.useCallback((line: string) => {
        console.log(TAG, line);
        setLines((prev) => [...prev, line]);
    }, []);

    React.useEffect(() => {
        log('probe start');
        run(props.context, log).catch((e) => log(`probe THREW ${fault(e)}`));
        // Run once; the context getter always reads the latest.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const open = (): void => {
        const c = props.context() as any;
        const raw = c.parameters?.value?.raw?.[0];
        const nav = c.navigation;
        log(`P8 navigation keys: ${short(nav ? Object.keys(nav) : nav)}; openForm ${typeof nav?.openForm}`);
        if (!raw) {
            log('P8 no parent on this record — set a parent, save, reload, press again');
            return;
        }
        try {
            const p = nav.openForm({ entityName: raw.entityType, entityId: bare(raw.id) });
            log(`P8 openForm called → ${short(p)}; then=${typeof p?.then}`);
            p?.then?.((r: unknown) => log(`P8 openForm resolved ${short(r)}`), (e: unknown) => log(`P8 openForm rejected ${fault(e)}`));
        } catch (e) {
            log(`P8 openForm THREW ${fault(e)}`);
        }
    };

    return React.createElement(
        'div',
        { style: { fontFamily: 'Consolas, monospace', fontSize: 12, padding: 8 } },
        React.createElement('div', null, `${TAG} updateView passes: ${props.passes}`),
        React.createElement('button', { type: 'button', onClick: open, style: { margin: '6px 0' } }, 'P8: open the parent record with navigation.openForm'),
        React.createElement('pre', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 } }, lines.join('\n')),
    );
};
