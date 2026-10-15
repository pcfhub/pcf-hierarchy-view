/**
 * **TEMPORARY — the 0.2.9 probe. Delete this file and its two lines in
 * `index.ts` before 0.3.0 is built.** The control renders as 0.2.0 does; this
 * panel sits under it and asks the form what the org chart and the skill's
 * Web API action section rest on. SPEC.md, *Measured — the 0.2.9 probe*, has
 * the questions (C1–C5, A1–A4) and what each answer decides.
 *
 * Passive answers print on their own; the action questions need the
 * throwaway Custom API, so they sit behind `window.__hierarchyProbe`:
 *
 *   await __hierarchyProbe.setup()     // create pcfhub_ProbeEcho + the account-bound twin
 *   await __hierarchyProbe.actions()   // A1–A4
 *   await __hierarchyProbe.cleanup()   // delete both
 *   copy(__hierarchyProbe.dump())      // every line, for SPEC.md
 *
 * The context is read through a getter on every pass, never parked (the
 * dead-snapshot lesson from Data Table 0.5.0).
 */

import * as React from 'react';
import { IInputs } from './generated/ManifestTypes';

/* eslint-disable @typescript-eslint/no-explicit-any */

const TAG = '[hierarchy-view probe 0.2.10]';
const lines: string[] = [];
const listeners = new Set<() => void>();

function log(line: string): void {
    const stamped = `${new Date().toISOString().slice(11, 23)} ${line}`;
    lines.push(stamped);
    console.log(TAG, line);
    listeners.forEach((l) => l());
}

const short = (value: unknown, max = 500): string => {
    let text: string;
    try {
        text = JSON.stringify(value, (_k, v) => (typeof v === 'function' ? '[function]' : v)) ?? String(value);
    } catch {
        text = String(value);
    }
    return text.length > max ? `${text.slice(0, max)}… (${text.length} chars)` : text;
};

const fault = (e: unknown): string => {
    const o = e as any;
    return short({ ctor: o?.constructor?.name, errorCode: o?.errorCode, code: o?.code, message: o?.message, keys: o && typeof o === 'object' ? Object.keys(o) : undefined });
};

const bare = (id: string): string => id.replace(/[{}]/g, '').toLowerCase();

const ODATA = { Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' };

/** One request, every fact about the answer, never a throw. */
async function call(label: string, url: string, init: RequestInit): Promise<{ status: number; body: string }> {
    const t0 = performance.now();
    try {
        const res = await fetch(url, { credentials: 'same-origin', ...init });
        const body = await res.text();
        log(`${label}: ${res.status} ${res.statusText} in ${Math.round(performance.now() - t0)} ms; content-type=${short(res.headers.get('content-type'))} odata-version=${short(res.headers.get('odata-version'))} body=${short(body, 700)}`);
        return { status: res.status, body };
    } catch (e) {
        log(`${label}: THREW ${fault(e)}`);
        return { status: 0, body: '' };
    }
}

/** The nearest ancestor that scrolls vertically: the form's tab section, on a form. */
function scroller(from: HTMLElement | null): HTMLElement | null {
    for (let el = from?.parentElement ?? null; el; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
            return el;
        }
    }
    return null;
}

export interface ProbeProps {
    context: () => ComponentFramework.Context<IInputs>;
    passes: number;
}

export function Probe(props: ProbeProps): React.ReactElement {
    const [, redraw] = React.useState(0);
    const panel = React.useRef<HTMLDivElement>(null);
    const canvasScroller = React.useRef<HTMLDivElement>(null);
    const allocated = (props.context() as any).mode?.allocatedWidth;
    const held = typeof allocated === 'number' && allocated > 0 ? allocated : null;
    const [image, setImage] = React.useState<string | null>(null);
    const asked = React.useRef(false);
    const lastAllocated = React.useRef('');

    React.useEffect(() => {
        const l = (): void => redraw((n) => n + 1);
        listeners.add(l);
        return () => {
            listeners.delete(l);
        };
    }, []);

    // ---- every pass: allocated width/height, logged when they change ------
    {
        const c = props.context() as any;
        const now = `w=${c.mode?.allocatedWidth} h=${c.mode?.allocatedHeight}`;
        if (now !== lastAllocated.current) {
            lastAllocated.current = now;
            queueMicrotask(() => log(`C1 pass ${props.passes}: allocated ${now}; window ${window.innerWidth}`));
        }
    }

    // ---- C1: the canvas and the control's own widths, as the section moves -
    React.useEffect(() => {
        const box = canvasScroller.current;
        const root = panel.current;
        if (!box || !root || typeof ResizeObserver !== 'function') {
            return;
        }
        let last = '';
        const observer = new ResizeObserver(() => {
            const doc = document.documentElement;
            const section = root.closest('section') as HTMLElement | null;
            const now = `panel=${Math.round(root.getBoundingClientRect().width)} scroller client=${box.clientWidth} scroll=${box.scrollWidth} section=${section ? Math.round(section.getBoundingClientRect().width) : 'none'} page overflows=${doc.scrollWidth > doc.clientWidth}`;
            if (now !== last) {
                last = now;
                log(`C1 widths: ${now}`);
            }
        });
        observer.observe(box);
        observer.observe(root);
        return () => observer.disconnect();
    }, []);

    const centre = React.useCallback((why: string) => {
        const box = canvasScroller.current;
        const form = scroller(panel.current);
        if (!box) {
            return;
        }
        const before = { formTop: form?.scrollTop, formLeft: form?.scrollLeft, windowY: window.scrollY, boxLeft: box.scrollLeft };
        box.scrollLeft = 1800 - box.clientWidth / 2;
        requestAnimationFrame(() => {
            const after = { formTop: form?.scrollTop, formLeft: form?.scrollLeft, windowY: window.scrollY, boxLeft: box.scrollLeft };
            log(`C2 centre (${why}): form scroller=${form ? `${form.tagName}.${String(form.className).slice(0, 40)}` : 'none'} before=${short(before)} after=${short(after)} → form moved ${before.formTop !== after.formTop || before.formLeft !== after.formLeft || before.windowY !== after.windowY ? 'YES' : 'no'}`);
        });
    }, []);

    // ---- once: C5, C3, C4, and the first C2 ---------------------------------
    React.useEffect(() => {
        if (asked.current) {
            return;
        }
        asked.current = true;
        const c = props.context() as any;
        const p = c.parameters ?? {};

        log(`C5 layout: raw=${short(p.layout?.raw)} type=${short(p.layout?.type)} typeof=${typeof p.layout?.raw}; showImage: raw=${short(p.showImage?.raw)} typeof=${typeof p.showImage?.raw} type=${short(p.showImage?.type)}`);
        log(`webAPI retrieveRecord=${typeof c.webAPI?.retrieveRecord} retrieveMultipleRecords=${typeof c.webAPI?.retrieveMultipleRecords}; page.getClientUrl=${typeof c.page?.getClientUrl}`);
        // 0.2.9 set these from an async block before the window object existed, and threw silently.
        (window as any).__hierarchyProbe = (window as any).__hierarchyProbe ?? {};

        window.setTimeout(() => centre('mount + 1 s'), 1000);

        void (async () => {
            const info = c.mode?.contextInfo;
            const id = info?.entityId ? bare(String(info.entityId)) : '';
            const table = info?.entityTypeName ?? 'account';
            const webAPI = c.webAPI;
            let clientUrl = '';
            try {
                clientUrl = c.page?.getClientUrl?.() ?? '';
            } catch (e) {
                log(`getClientUrl THREW ${fault(e)}`);
            }
            (window as any).__hierarchyProbe.clientUrl = clientUrl;
            (window as any).__hierarchyProbe.recordId = id;
            if (!webAPI || !id) {
                log(`C3 skipped: webAPI=${Boolean(webAPI)} recordId=${short(id)}`);
                return;
            }

            // C3 — OData $select, on this record and on its table's first rows
            const urls: string[] = [];
            try {
                const row = await webAPI.retrieveRecord(table, id, '?$select=name,entityimage_url,entityimage_timestamp,entityimageid');
                log(`C3 OData retrieveRecord ${table}: keys=${short(Object.keys(row))} entityimage_url=${short(row.entityimage_url)} timestamp=${short(row.entityimage_timestamp)} entityimageid=${short(row.entityimageid)}`);
                if (row.entityimage_url) {
                    urls.push(row.entityimage_url);
                }
            } catch (e) {
                log(`C3 OData retrieveRecord ${table} REFUSED ${fault(e)}`);
            }
            for (const [entity, name] of [['account', 'name'], ['contact', 'fullname']]) {
                try {
                    const r = await webAPI.retrieveMultipleRecords(entity, `?$select=${name},entityimage_url&$orderby=modifiedon desc`, 25);
                    const withImage = r.entities.filter((e: any) => e.entityimage_url);
                    log(`C3 OData ${entity} ×${r.entities.length}: ${withImage.length} with an image; first=${short(withImage[0]?.entityimage_url ?? null)}; a null one reads ${short(r.entities.find((e: any) => !e.entityimage_url)?.entityimage_url)}`);
                    withImage.slice(0, 1).forEach((e: any) => urls.push(e.entityimage_url));
                } catch (e) {
                    log(`C3 OData ${entity} REFUSED ${fault(e)}`);
                }
                try {
                    const xml = `<fetch top='25'><entity name='${entity}'><attribute name='${name}'/><attribute name='entityimage_url'/><order attribute='modifiedon' descending='true'/></entity></fetch>`;
                    const r = await webAPI.retrieveMultipleRecords(entity, `?fetchXml=${encodeURIComponent(xml)}`);
                    const withImage = r.entities.filter((e: any) => e.entityimage_url);
                    log(`C3 FetchXML ${entity} ×${r.entities.length}: ${withImage.length} with an image; first=${short(withImage[0]?.entityimage_url ?? null)}; keys of a row=${short(Object.keys(r.entities[0] ?? {}))}`);
                } catch (e) {
                    log(`C3 FetchXML ${entity} REFUSED ${fault(e)}`);
                }
            }

            // C4 — does the URL load, as an <img> and as a fetch
            const url = urls[0];
            if (!url) {
                log('C4 skipped: no record with an image — set a picture on one account (click the avatar in the form header), save, reload.');
                return;
            }
            const absolute = /^https?:/i.test(url) ? url : `${clientUrl}${url.startsWith('/') ? '' : '/'}${url}`;
            log(`C4 url relative=${!/^https?:/i.test(url)} → ${absolute}`);
            setImage(absolute);
            await call('C4 fetch the image', absolute, { method: 'GET' }).then(() => undefined);
        })();
    }, [centre, props]);

    // ---- the window API: setup / actions / cleanup ---------------------------
    React.useEffect(() => {
        const api: any = (window as any).__hierarchyProbe ?? {};
        (window as any).__hierarchyProbe = api;
        const base = (): string => `${api.clientUrl || (props.context() as any).page?.getClientUrl?.()}/api/data/v9.2`;
        const json = { ...ODATA, 'Content-Type': 'application/json; charset=utf-8' };

        api.dump = (): string => lines.join('\n');

        api.setup = async (solution?: string): Promise<void> => {
            const param = (u: string) => ({ uniquename: u, name: u, displayname: u, description: 'Throwaway probe parameter', type: 10, isoptional: false });
            const prop = (u: string) => ({ uniquename: u, name: u, displayname: u, description: 'Throwaway probe property', type: 10 });
            const make = (uniquename: string, binding: number, entity?: string) => ({
                uniquename,
                name: uniquename,
                displayname: uniquename,
                description: 'Throwaway: measures a Web API action from a PCF control (pcf-hierarchy-view 0.2.9). Delete after the probe.',
                bindingtype: binding,
                ...(entity ? { boundentitylogicalname: entity } : {}),
                isfunction: false,
                allowedcustomprocessingsteptype: 0,
                CustomAPIRequestParameters: [param('Text')],
                CustomAPIResponseProperties: [prop('Echo')],
            });
            const headers = solution ? { ...json, 'MSCRM.SolutionUniqueName': solution } : json;
            await call('setup unbound pcfhub_ProbeEcho', `${base()}/customapis`, { method: 'POST', headers, body: JSON.stringify(make('pcfhub_ProbeEcho', 0)) });
            await call('setup bound pcfhub_ProbeEchoAccount', `${base()}/customapis`, { method: 'POST', headers, body: JSON.stringify(make('pcfhub_ProbeEchoAccount', 1, 'account')) });
            await call('setup check', `${base()}/customapis?$select=uniquename,bindingtype,isfunction&$filter=startswith(uniquename,'pcfhub_Probe')`, { headers: ODATA });
        };

        api.actions = async (): Promise<void> => {
            const id = api.recordId;
            const echo = `${base()}/pcfhub_ProbeEcho`;
            const body = JSON.stringify({ Text: 'hello from the probe' });
            log('A1 — unbound action, same-origin fetch');
            await call('A1a full headers + Content-Type', echo, { method: 'POST', headers: json, body });
            await call('A1b no Content-Type', echo, { method: 'POST', headers: ODATA, body });
            await call('A1c only Content-Type', echo, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
            await call('A1d credentials omit', echo, { method: 'POST', headers: json, body, credentials: 'omit' });
            log('A2 — bound action');
            const before = id ? await call('A4 modifiedon before', `${base()}/accounts(${id})?$select=modifiedon,versionnumber`, { headers: ODATA }) : null;
            await call('A2a bound, qualified', `${base()}/accounts(${id})/Microsoft.Dynamics.CRM.pcfhub_ProbeEchoAccount`, { method: 'POST', headers: json, body });
            await call('A2b bound, unqualified', `${base()}/accounts(${id})/pcfhub_ProbeEchoAccount`, { method: 'POST', headers: json, body });
            await call('A2c bound action called unbound', `${base()}/pcfhub_ProbeEchoAccount`, { method: 'POST', headers: json, body });
            const after = id ? await call('A4 modifiedon after', `${base()}/accounts(${id})?$select=modifiedon,versionnumber`, { headers: ODATA }) : null;
            log(`A4 record changed by the bound call: ${before && after ? String(before.body !== after.body) : 'unknown'}`);
            log('A3 — refusals');
            await call('A3a missing required parameter', echo, { method: 'POST', headers: json, body: '{}' });
            await call('A3b wrong type', echo, { method: 'POST', headers: json, body: JSON.stringify({ Text: 5 }) });
            await call('A3c unknown parameter', echo, { method: 'POST', headers: json, body: JSON.stringify({ Text: 'x', Nope: 1 }) });
            await call('A3d malformed body', echo, { method: 'POST', headers: json, body: '{not json' });
            await call('A3e no such action', `${base()}/pcfhub_NoSuchAction`, { method: 'POST', headers: json, body });
            await call('A3f GET on an action', echo, { method: 'GET', headers: ODATA });
            log(`A — webAPI members for comparison: ${short(Object.keys((props.context() as any).webAPI ?? {}))}`);
        };

        api.cleanup = async (): Promise<void> => {
            const found = await call('cleanup list', `${base()}/customapis?$select=customapiid,uniquename&$filter=startswith(uniquename,'pcfhub_Probe')`, { headers: ODATA });
            let rows: any[] = [];
            try {
                rows = JSON.parse(found.body).value ?? [];
            } catch {
                rows = [];
            }
            for (const row of rows) {
                await call(`cleanup delete ${row.uniquename}`, `${base()}/customapis(${row.customapiid})`, { method: 'DELETE', headers: ODATA });
            }
            await call('cleanup check', `${base()}/customapis?$select=uniquename&$filter=startswith(uniquename,'pcfhub_Probe')`, { headers: ODATA });
        };
    }, [props]);

    return (
        <div ref={panel} style={{ marginTop: 12, padding: 8, border: '1px dashed #c50f1f', font: '12px/1.4 Consolas, monospace' }}>
            <div style={{ fontWeight: 600 }}>{TAG} — temporary; see SPEC.md. Console: __hierarchyProbe.setup() / actions() / cleanup() / dump()</div>
            <div ref={canvasScroller} style={{ overflow: 'auto', border: '1px solid #8a8886', marginTop: 6, boxSizing: 'border-box', width: held === null ? undefined : held - 18, maxWidth: '100%' }}>
                <div style={{ position: 'relative', width: 2400, height: 90, background: 'repeating-linear-gradient(90deg, #f3f2f1 0 199px, #c8c6c4 199px 200px)' }}>
                    <div style={{ position: 'absolute', left: 1700, top: 20, width: 200, height: 50, background: '#0f6cbd', color: 'white', textAlign: 'center', lineHeight: '50px' }}>C2 target @1800</div>
                </div>
            </div>
            <button type="button" onClick={() => centre('button')} style={{ marginTop: 6 }}>C2 centre again</button>
            {image ? (
                <div style={{ marginTop: 6 }}>
                    C4 img:{' '}
                    <img
                        src={image}
                        alt="probe"
                        width={48}
                        height={48}
                        onLoad={(e) => log(`C4 <img> LOADED natural=${(e.target as HTMLImageElement).naturalWidth}×${(e.target as HTMLImageElement).naturalHeight}`)}
                        onError={() => log('C4 <img> FAILED (onerror)')}
                    />
                </div>
            ) : null}
            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto', margin: '6px 0 0' }}>{lines.join('\n')}</pre>
        </div>
    );
}
