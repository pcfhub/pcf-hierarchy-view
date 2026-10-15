import * as React from 'react';
import { Avatar, Button, FluentProvider, Spinner, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { faultMessage, HierarchySource } from '../data/HierarchyData';
import { Buffer } from '../lib/tree-keys/typeAhead';
import { canOpen, onTreeKey, positions } from '../tree/keyboard';
import { initialState, pendingLoads, reduce, relativeDepth, visibleRows, VisibleRow } from '../tree/reducer';
import { ChartView } from './ChartView';

/** Every sentence the control can show, already resolved from the .resx. */
export interface Strings {
    noAccess: string;
    notAvailable: string;
    saveFirst: string;
    notALookup: string;
    loading: string;
    noChildren: string;
    /** `{0}` is the record's name. */
    expand: string;
    collapse: string;
    open: string;
    /** `{0}` is a number. */
    children: string;
    truncated: string;
    /** `{0}` is the platform's message. */
    loadFailed: string;
    current: string;
    retry: string;
    showAll: string;
    notFound: string;
}

/** What the control has decided about the host, before any query runs. */
export type Mode = 'live' | 'not-available' | 'save-first' | 'not-a-lookup' | 'no-access';

/** 0.3.0: the indented tree, or the org chart — which is the tree again below `NARROW_BELOW`. */
export type Layout = 'tree' | 'chart';

export interface IProps {
    mode: Mode;
    /**
     * Where nodes come from, resolved lazily because the live route has to
     * ask the metadata two questions first. `null` in every mode but
     * `live`.
     */
    resolve: (() => Promise<HierarchySource>) | null;
    /**
     * Changes whenever anything the tree was built from changes — the record,
     * the target, the column, the detail columns, the depth, the page size —
     * and the tree starts over. This is how an input changed
     * after `init` (the hub's preset switch) reaches the component.
     */
    sourceKey: string;
    currentId: string;
    initialDepth: number;
    layout: Layout;
    /** Each card shows the record's picture, or its initials where it has none. */
    showImage: boolean;
    /** The organisation URL a picture's relative address is joined to, or `null`. */
    clientUrl: string | null;
    /** Opens a record, or `null` when the host cannot; never called for the current record. */
    openRecord: ((id: string) => Promise<void>) | null;
    visible: boolean;
    label: string;
    isRTL: boolean;
    theme: ComponentFramework.Theme | undefined;
    /** `true`, `false`, or `undefined` for a host that publishes no theme. */
    dark: boolean | undefined;
    allocatedWidth: number | null;
    strings: Strings;
}

/** `{0}` → the value. The .resx moves the placeholder per language; the code never assumes where. */
export const fill = (template: string, value: string | number): string => template.replace('{0}', String(value));

/**
 * Below this width the indent tightens from 24px to 16px so four levels still
 * fit. Measured off the root, never queried off the viewport. The details stay:
 * a two-column form section is under 480px, and hiding them there (0.1.0) hid
 * them on the form the control was built for.
 */
export const NARROW_BELOW = 480;

let instances = 0;

/** Rows a Page Up or Page Down moves: about a screenful of 36px rows. */
const PAGE = 10;

/**
 * A picture's address. The Web API answers it relative (`/Image/download.aspx?…`,
 * SPEC.md C3); joined to the organisation URL it loads on the form (C4).
 */
export const pictureUrl = (image: string | null, clientUrl: string | null): string | undefined =>
    image === null ? undefined : image.startsWith('/') && clientUrl ? `${clientUrl}${image}` : image;

/**
 * Fluent's 16px ChevronRight, as a path so it scales with the button and
 * follows `currentColor`. Rotated by CSS when the node is open, and mirrored
 * under `dir="rtl"`.
 */
const Chevron = (): React.ReactElement => (
    <svg className="HierarchyView-chevron" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path
            fill="currentColor"
            d="M7.65 4.15c.2-.2.5-.2.7 0l5.49 5.46c.21.22.21.57 0 .78l-5.49 5.46a.5.5 0 0 1-.7-.7L12.8 10 7.65 4.85a.5.5 0 0 1 0-.7Z"
        />
    </svg>
);

export function HierarchyViewControl(props: IProps): React.ReactElement | null {
    const [state, dispatch] = React.useReducer(reduce, props.currentId, initialState);
    const source = React.useRef<HierarchySource | null>(null);
    /*
     * Ids with a load in flight. The reducer marks them `loading` too, but a
     * dispatch from inside an effect re-runs the effect before the loop below
     * has finished, and a set the loop owns is what keeps the second run from
     * asking for the same children twice.
     */
    const inflight = React.useRef(new Set<string>());
    const rootRef = React.useRef<HTMLDivElement>(null);
    const [narrow, setNarrow] = React.useState(false);
    const { mode, resolve, sourceKey, initialDepth } = props;
    const instance = React.useRef(`HierarchyView-${(instances += 1)}`).current;
    const containerRef = React.useRef<HTMLDivElement & HTMLUListElement>(null);
    const [focusId, setFocusId] = React.useState<string | null>(null);
    const [focused, setFocused] = React.useState(false);
    const typed = React.useRef<Buffer | null>(null);

    /*
     * Start over whenever the source changes. The `alive` flag is what keeps a
     * slow answer for the previous key from landing in the new tree — the
     * hub's demo switches presets faster than a query resolves.
     */
    React.useEffect(() => {
        let alive = true;

        dispatch({ type: 'reset', currentId: props.currentId });
        source.current = null;
        inflight.current.clear();

        if (!resolve || mode !== 'live') {
            return undefined;
        }

        resolve()
            .then((resolved) => {
                if (!alive) {
                    return null;
                }

                source.current = resolved;

                return resolved.loadChain();
            })
            .then((chain) => {
                if (alive && chain !== null) {
                    dispatch({ type: 'chainLoaded', chain, initialDepth });
                }
            })
            .catch((error: unknown) => {
                if (alive) {
                    dispatch({ type: 'chainFailed', message: faultMessage(error) });
                }
            });

        return () => {
            alive = false;
        };
        // `currentId` and `initialDepth` are folded into `sourceKey` by index.ts.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceKey, mode, resolve]);

    /*
     * Load whatever is open and unloaded. Runs after every state change and
     * marks each node `loading` first, so a second pass finds nothing pending.
     */
    React.useEffect(() => {
        const current = source.current;

        if (!current || !state.ready) {
            return;
        }

        pendingLoads(state).forEach((id) => {
            if (inflight.current.has(id)) {
                return;
            }

            inflight.current.add(id);
            dispatch({ type: 'loading', id });

            const depth = relativeDepth(state, id);
            const expandChildren = depth !== null && depth >= 0 && depth + 1 < initialDepth;

            current
                .loadChildren(id)
                .then((result) => {
                    if (source.current === current) {
                        dispatch({ type: 'childrenLoaded', id, children: result.children, truncated: result.truncated, expandChildren });
                    }
                })
                .catch((error: unknown) => {
                    if (source.current === current) {
                        dispatch({ type: 'loadFailed', id, message: faultMessage(error) });
                    }
                })
                .then(() => {
                    inflight.current.delete(id);
                });
        });
    }, [state, initialDepth]);

    /*
     * Narrow is measured off the root's own width, never off a media query
     * (a form section on a wide screen can be narrow) and never with
     * `container-type` on the root (a shrink-to-fit parent collapses it to a
     * sliver — Calendar View 0.1.3 did that to every form).
     */
    React.useEffect(() => {
        const root = rootRef.current;

        if (!root || typeof ResizeObserver !== 'function') {
            return undefined;
        }

        const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? 0;

            setNarrow(width > 0 && width < NARROW_BELOW);
        });

        observer.observe(root);

        return () => observer.disconnect();
    }, []);

    const rows = React.useMemo(() => visibleRows(state), [state]);
    const places = React.useMemo(() => positions(rows), [rows]);
    const strings = props.strings;

    /*
     * The row that has the tree's focus: the one the keys last moved to, or —
     * before any key, or when that row has gone shut under a closed parent —
     * the record the form is open on.
     */
    let focusIndex = focusId === null ? -1 : rows.findIndex((row) => row.node.id === focusId);
    if (focusIndex < 0) {
        focusIndex = Math.max(0, rows.findIndex((row) => row.isCurrent));
    }
    const activeId = rows.length > 0 ? rows[focusIndex].node.id : null;
    const domId = (id: string): string => `${instance}-${id}`;

    // Keep the row a key moved to in sight — only while the tree has focus, so
    // a load or a re-render never scrolls the form under somebody reading it.
    React.useEffect(() => {
        if (!focused || activeId === null) {
            return;
        }
        const element = containerRef.current?.ownerDocument.getElementById(domId(activeId));
        element?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId, focused]);

    if (!props.visible) {
        return null;
    }

    const openRecord = (id: string): void => {
        if (props.openRecord) {
            props.openRecord(id).catch(() => undefined);
        }
    };

    const onKeyDown = (event: React.KeyboardEvent): void => {
        const outcome = onTreeKey(
            rows,
            focusIndex,
            { key: event.key, ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey },
            typed.current,
            Date.now(),
            PAGE,
        );

        if (!outcome.handled) {
            return;
        }

        event.preventDefault();
        typed.current = outcome.buffer;
        setFocusId(rows[outcome.focus].node.id);
        outcome.effects.forEach((effect) => dispatch(effect));
        if (outcome.open !== null) {
            openRecord(outcome.open);
        }
    };

    /*
     * A press on a row or a card selects it and keeps the keyboard on the
     * tree. Without the preventDefault, the chevron or Show all under the
     * pointer takes focus on mousedown — tabIndex -1 still does — and when it
     * unmounts, as Show all does, focus falls to the page and the arrows stop
     * (walkthrough on the form, 0.3.0). The tree is focused without scrolling
     * the form.
     */
    const select = (id: string, event?: React.MouseEvent): void => {
        if (event) {
            if (event.button !== 0) {
                return;
            }
            event.preventDefault();
            containerRef.current?.focus({ preventScroll: true });
        }
        setFocusId(id);
    };

    // The one tab stop, for either layout: the rows are never focused themselves.
    const containerProps = {
        ref: containerRef,
        tabIndex: 0,
        'aria-activedescendant': activeId === null ? undefined : domId(activeId),
        onKeyDown,
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
    };

    const theme = props.theme ?? (props.dark ? webDarkTheme : webLightTheme);
    const className = [
        'HierarchyView',
        props.dark ? 'HierarchyView--dark' : '',
        narrow || (props.allocatedWidth !== null && props.allocatedWidth < NARROW_BELOW) ? 'HierarchyView--narrow' : '',
    ].filter(Boolean).join(' ');
    // The chart needs room. Below the line it is the tree, measured off the
    // control's own width — allocatedWidth is the field's whole cell (C1).
    const chart = props.layout === 'chart' && !narrow;

    const message = (text: string, role?: 'alert'): React.ReactElement => (
        <p className="HierarchyView-message" role={role}>{text}</p>
    );

    let body: React.ReactNode;

    switch (mode) {
        case 'no-access': body = message(strings.noAccess); break;
        case 'not-available': body = message(strings.notAvailable); break;
        case 'save-first': body = message(strings.saveFirst); break;
        case 'not-a-lookup': body = message(strings.notALookup); break;
        default:
            if (!state.ready) {
                body = (
                    <p className="HierarchyView-message HierarchyView-message--busy">
                        <Spinner size="tiny" aria-hidden="true" />
                        <span>{strings.loading}</span>
                    </p>
                );
            } else if (state.error === 'not-found') {
                body = message(strings.notFound, 'alert');
            } else if (state.error !== null) {
                body = message(fill(strings.loadFailed, state.error), 'alert');
            } else if (chart) {
                body = (
                    <ChartView
                        rows={rows}
                        positions={places}
                        domId={domId}
                        activeId={activeId}
                        sourceKey={sourceKey}
                        currentId={props.currentId}
                        isRTL={props.isRTL}
                        showImage={props.showImage}
                        imageUrl={(node) => pictureUrl(node.image, props.clientUrl)}
                        label={props.label}
                        strings={strings}
                        canOpenRecord={props.openRecord !== null}
                        containerProps={containerProps}
                        onSelect={select}
                        onToggle={(id) => dispatch({ type: 'toggle', id })}
                        onRetry={(id) => dispatch({ type: 'retry', id })}
                        onShowAll={(id) => dispatch({ type: 'showAll', id })}
                        onOpen={openRecord}
                        fill={fill}
                    />
                );
            } else {
                body = (
                    <ul {...containerProps} className="HierarchyView-tree" role="tree" aria-label={props.label || undefined}>
                        {rows.map((row, index) => (
                            <TreeRow
                                key={row.node.id}
                                row={row}
                                strings={strings}
                                openRecord={props.openRecord}
                                domId={domId(row.node.id)}
                                active={row.node.id === activeId}
                                position={places[index]}
                                image={props.showImage ? pictureUrl(row.node.image, props.clientUrl) ?? null : undefined}
                                onSelect={select}
                                onToggle={(id) => dispatch({ type: 'toggle', id })}
                                onRetry={(id) => dispatch({ type: 'retry', id })}
                                onShowAll={(id) => dispatch({ type: 'showAll', id })}
                            />
                        ))}
                    </ul>
                );
            }
    }

    return (
        <FluentProvider theme={theme} dir={props.isRTL ? 'rtl' : 'ltr'} className={className}>
            <div className="HierarchyView-root" ref={rootRef}>
                {body}
            </div>
        </FluentProvider>
    );
}

export interface RowProps {
    row: VisibleRow;
    strings: Strings;
    openRecord: ((id: string) => Promise<void>) | null;
    /** The id `aria-activedescendant` names; unique per instance. */
    domId?: string;
    /** The row the tree's focus is on. */
    active?: boolean;
    position?: { posInSet: number; setSize: number };
    /** `undefined`: pictures are off. `null`: on, and this record has none — its initials. */
    image?: string | null;
    /** A press on the row: selects it, keeping the keyboard on the tree. */
    onSelect?: (id: string, event?: React.MouseEvent) => void;
    onToggle: (id: string) => void;
    onRetry: (id: string) => void;
    onShowAll: (id: string) => void;
}

/**
 * One node: a chevron (or its space), a card, and under the card whatever the
 * node has to say about its children — loading, a failure with a retry, a
 * truncation notice, the *show all* affordance of an ancestor.
 */
export function TreeRow(props: RowProps): React.ReactElement {
    const { row, strings } = props;
    const { node } = row;
    const name = node.name || '—';
    const canToggle = row.hasChildren !== 'no' && !row.partial;
    const canOpenRecord = props.openRecord !== null && !row.isCurrent;
    const classes = [
        'HierarchyView-item',
        row.isCurrent ? 'HierarchyView-item--current' : '',
        row.isAncestor ? 'HierarchyView-item--ancestor' : '',
        props.active ? 'HierarchyView-item--active' : '',
    ].filter(Boolean).join(' ');

    const open = (): void => {
        if (props.openRecord) {
            props.openRecord(node.id).catch(() => undefined);
        }
    };

    return (
        <li
            id={props.domId}
            className={classes}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-setsize={props.position?.setSize}
            aria-posinset={props.position?.posInSet}
            aria-expanded={canOpen(row) ? row.expanded : undefined}
            aria-selected={props.active}
            aria-current={row.isCurrent ? 'true' : undefined}
            style={{ '--HierarchyView-depth': row.depth } as React.CSSProperties}
            onMouseDown={(event) => props.onSelect?.(node.id, event)}
        >
            <div className="HierarchyView-row">
                {canToggle ? (
                    <Button
                        appearance="subtle"
                        size="small"
                        className={`HierarchyView-toggle${row.expanded ? ' HierarchyView-toggle--open' : ''}`}
                        aria-label={fill(row.expanded ? strings.collapse : strings.expand, name)}
                        icon={<Chevron />}
                        tabIndex={-1}
                        onClick={() => props.onToggle(node.id)}
                    />
                ) : (
                    <span className="HierarchyView-toggle HierarchyView-toggle--none" aria-hidden="true" />
                )}

                {props.image !== undefined && (
                    <Avatar
                        className="HierarchyView-avatar"
                        size={24}
                        name={node.name}
                        image={props.image ? { src: props.image, alt: '' } : undefined}
                        aria-hidden="true"
                    />
                )}
                <div className="HierarchyView-card">
                    <div className="HierarchyView-title">
                        {canOpenRecord ? (
                            <button type="button" tabIndex={-1} className="HierarchyView-open" onClick={open} aria-label={fill(strings.open, name)}>
                                {name}
                            </button>
                        ) : (
                            <span className="HierarchyView-name">{name}</span>
                        )}
                        {row.isCurrent && <span className="HierarchyView-badge HierarchyView-badge--current">{strings.current}</span>}
                        {node.childCount !== null && node.childCount > 0 && (
                            <span className="HierarchyView-badge" title={fill(strings.children, node.childCount)}>
                                {node.childCount}
                            </span>
                        )}
                    </div>
                    {node.details.some((detail) => detail.text !== '') && (
                        <div className="HierarchyView-details">
                            {node.details.filter((detail) => detail.text !== '').map((detail) => (
                                <span key={detail.column} className="HierarchyView-detail">{detail.text}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {row.partial && (
                <div className="HierarchyView-note">
                    <Button appearance="transparent" size="small" tabIndex={-1} className="HierarchyView-showall" onClick={() => props.onShowAll(node.id)}>
                        {strings.showAll}
                    </Button>
                </div>
            )}
            {row.loading && (
                <div className="HierarchyView-note HierarchyView-note--busy">
                    <Spinner size="tiny" aria-hidden="true" />
                    <span>{strings.loading}</span>
                </div>
            )}
            {row.failed !== null && (
                <div className="HierarchyView-note HierarchyView-note--failed" role="alert">
                    <span>{fill(strings.loadFailed, row.failed)}</span>
                    <Button appearance="transparent" size="small" tabIndex={-1} onClick={() => props.onRetry(node.id)}>{strings.retry}</Button>
                </div>
            )}
            {row.expanded && !row.loading && row.failed === null && row.hasChildren === 'no' && row.isCurrent && (
                <div className="HierarchyView-note HierarchyView-note--empty">{strings.noChildren}</div>
            )}
            {row.truncated && row.expanded && (
                <div className="HierarchyView-note">{fill(strings.truncated, row.loadedCount)}</div>
            )}
        </li>
    );
}
