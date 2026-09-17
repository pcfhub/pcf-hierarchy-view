import * as React from 'react';
import { IInputs, IOutputs } from './generated/ManifestTypes';
import { HierarchyViewControl, IProps, Mode, Strings } from './components/HierarchyViewControl';
import { createFetchXmlSource, createODataSource, createSampleSource, HierarchySource } from './data/HierarchyData';
import { isHierarchical, readHost } from './platform';
import { parseDetailColumns } from './query/fetchXml';
import { QueryShape } from './query/types';
import { parseSampleData } from './sample/parseSampleData';

/** What `initialDepth` and `maxChildren` are clamped to: a form is not a place to load a whole tree. */
const DEPTH_MAX = 5;
const CHILDREN_MIN = 1;
const CHILDREN_MAX = 250;

const clamp = (raw: number | null | undefined, fallback: number, min: number, max: number): number =>
    typeof raw === 'number' && Number.isFinite(raw) ? Math.min(max, Math.max(min, Math.floor(raw))) : fallback;

/**
 * A virtual (React) field control bound to a self-referential lookup. It
 * never writes: `getOutputs` is empty, and the only thing it does with the
 * bound value is read the parent off it.
 *
 * `updateView` runs on every change to anything bound, so everything the tree
 * is built from is folded into one `sourceKey`, and the component starts over
 * only when that string changes. The `resolve` function handed down is
 * memoised on the same key, because it is a dependency of the component's
 * effect and a fresh closure per pass would restart the load per pass.
 */
export class HierarchyView implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private resolved: { key: string; resolve: () => Promise<HierarchySource> } | null = null;

    public init(context: ComponentFramework.Context<IInputs>): void {
        // Ask for width changes; without this `allocatedWidth` is -1 forever.
        // Guarded because the hub's harness has no such method.
        if (typeof context.mode.trackContainerResize === 'function') {
            context.mode.trackContainerResize(true);
        }
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        const host = readHost(context);
        const inputs = context.parameters;
        const initialDepth = clamp(inputs.initialDepth?.raw, 1, 0, DEPTH_MAX);
        const maxChildren = clamp(inputs.maxChildren?.raw, 50, CHILDREN_MIN, CHILDREN_MAX);
        const sampleRaw = inputs.sampleData?.raw ?? '';
        const details = parseDetailColumns(inputs.detailColumns?.raw, [host.column]);
        const strings = this.strings(context);

        let mode: Mode;
        let currentId = host.recordId ?? '';
        let resolve: (() => Promise<HierarchySource>) | null = null;
        let key: string;

        if (!host.readable) {
            mode = 'no-access';
            key = mode;
        } else if (sampleRaw.trim() !== '') {
            // The demo route: a tree the maker typed, and no query at all.
            const sample = parseSampleData(sampleRaw);

            if (sample.ok) {
                mode = 'sample';
                currentId = sample.tree.currentId;
                key = `sample|${initialDepth}|${sampleRaw}`;
                resolve = this.memo(key, () => Promise.resolve(createSampleSource(sample.tree)));
            } else {
                mode = 'bad-sample';
                key = mode;
            }
        } else if (host.webAPI === null) {
            mode = 'not-available';
            key = mode;
        } else if (host.target === '' || host.column === '') {
            mode = 'not-a-lookup';
            key = mode;
        } else if (host.recordId === null) {
            mode = 'save-first';
            key = mode;
        } else {
            mode = 'live';
            key = ['live', host.target, host.column, host.recordId, host.parentId ?? '', details.join(','), initialDepth, maxChildren, host.clientUrl ?? ''].join('|');

            const { webAPI, target, column, recordId, parentId, clientUrl, primaryColumns } = host;

            resolve = this.memo(key, async () => {
                const primary = primaryColumns
                    ? await primaryColumns(target).catch(() => ({ primaryId: `${target}id`, primaryName: 'name' }))
                    : { primaryId: `${target}id`, primaryName: 'name' };
                const q: QueryShape = {
                    entity: target,
                    primaryId: primary.primaryId,
                    primaryName: primary.primaryName,
                    column,
                    details: details.filter((name) => name !== primary.primaryId && name !== primary.primaryName),
                };
                // No client URL means no metadata read, and no metadata read
                // means the route that works everywhere.
                const hierarchical = clientUrl !== null && await isHierarchical(clientUrl, target, column);
                const options = { webAPI, q, recordId, parentId, maxChildren };

                return hierarchical ? createFetchXmlSource(options) : createODataSource(options);
            });
        }

        const props: IProps = {
            mode,
            resolve,
            sourceKey: key,
            currentId,
            initialDepth,
            openRecord: host.openRecord,
            visible: host.visible,
            label: host.label,
            isRTL: host.isRTL,
            theme: context.fluentDesignLanguage?.tokenTheme,
            dark: host.dark,
            allocatedWidth: host.allocatedWidth,
            strings,
        };

        return React.createElement(HierarchyViewControl, props);
    }

    /** The control writes nothing. An empty bag is "no change" on every host. */
    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        this.resolved = null;
    }

    private memo(key: string, make: () => Promise<HierarchySource>): () => Promise<HierarchySource> {
        if (this.resolved === null || this.resolved.key !== key) {
            let promise: Promise<HierarchySource> | null = null;

            this.resolved = {
                key,
                resolve: () => {
                    promise = promise ?? make();
                    return promise;
                },
            };
        }

        return this.resolved.resolve;
    }

    private strings(context: ComponentFramework.Context<IInputs>): Strings {
        const s = (name: string): string => context.resources.getString(`HierarchyView_${name}`);

        return {
            noAccess: s('NoAccess'),
            notAvailable: s('NotAvailable'),
            saveFirst: s('SaveFirst'),
            notALookup: s('NotALookup'),
            loading: s('Loading'),
            noChildren: s('NoChildren'),
            expand: s('Expand'),
            collapse: s('Collapse'),
            open: s('Open'),
            children: s('Children'),
            truncated: s('Truncated'),
            loadFailed: s('LoadFailed'),
            current: s('Current'),
            badSample: s('BadSample'),
            retry: s('Retry'),
            showAll: s('ShowAll'),
            notFound: s('NotFound'),
        };
    }
}
