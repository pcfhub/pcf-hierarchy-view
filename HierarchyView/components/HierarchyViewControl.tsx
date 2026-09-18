import * as React from 'react';
import { Button, FluentProvider, Spinner, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { faultMessage, HierarchySource } from '../data/HierarchyData';
import { initialState, pendingLoads, reduce, relativeDepth, visibleRows, VisibleRow } from '../tree/reducer';

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
    badSample: string;
    retry: string;
    showAll: string;
    notFound: string;
}

/** What the control has decided about the host, before any query runs. */
export type Mode = 'live' | 'sample' | 'not-available' | 'save-first' | 'not-a-lookup' | 'no-access' | 'bad-sample';

export interface IProps {
    mode: Mode;
    /**
     * Where nodes come from, resolved lazily because the live route has to
     * ask the metadata two questions first. `null` in every mode but `live`
     * and `sample`.
     */
    resolve: (() => Promise<HierarchySource>) | null;
    /**
     * Changes whenever anything the tree was built from changes — the record,
     * the target, the column, the detail columns, the depth, the page size,
     * the sample — and the tree starts over. This is how an input changed
     * after `init` (the hub's preset switch) reaches the component.
     */
    sourceKey: string;
    currentId: string;
    initialDepth: number;
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

        if (!resolve || (mode !== 'live' && mode !== 'sample')) {
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
    const strings = props.strings;

    if (!props.visible) {
        return null;
    }

    const theme = props.theme ?? (props.dark ? webDarkTheme : webLightTheme);
    const className = [
        'HierarchyView',
        props.dark ? 'HierarchyView--dark' : '',
        narrow || (props.allocatedWidth !== null && props.allocatedWidth < NARROW_BELOW) ? 'HierarchyView--narrow' : '',
    ].filter(Boolean).join(' ');

    const message = (text: string, role?: 'alert'): React.ReactElement => (
        <p className="HierarchyView-message" role={role}>{text}</p>
    );

    let body: React.ReactNode;

    switch (mode) {
        case 'no-access': body = message(strings.noAccess); break;
        case 'not-available': body = message(strings.notAvailable); break;
        case 'save-first': body = message(strings.saveFirst); break;
        case 'not-a-lookup': body = message(strings.notALookup); break;
        case 'bad-sample': body = message(strings.badSample, 'alert'); break;
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
            } else {
                body = (
                    <ul className="HierarchyView-tree" role="tree" aria-label={props.label || undefined}>
                        {rows.map((row) => (
                            <TreeRow
                                key={row.node.id}
                                row={row}
                                strings={strings}
                                openRecord={props.openRecord}
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
    const canOpen = props.openRecord !== null && !row.isCurrent;
    const classes = [
        'HierarchyView-item',
        row.isCurrent ? 'HierarchyView-item--current' : '',
        row.isAncestor ? 'HierarchyView-item--ancestor' : '',
    ].filter(Boolean).join(' ');

    const open = (): void => {
        if (props.openRecord) {
            props.openRecord(node.id).catch(() => undefined);
        }
    };

    return (
        <li
            className={classes}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-expanded={row.hasChildren === 'no' ? undefined : row.expanded}
            aria-current={row.isCurrent ? 'true' : undefined}
            style={{ '--HierarchyView-depth': row.depth } as React.CSSProperties}
        >
            <div className="HierarchyView-row">
                {canToggle ? (
                    <Button
                        appearance="subtle"
                        size="small"
                        className={`HierarchyView-toggle${row.expanded ? ' HierarchyView-toggle--open' : ''}`}
                        aria-label={fill(row.expanded ? strings.collapse : strings.expand, name)}
                        icon={<Chevron />}
                        onClick={() => props.onToggle(node.id)}
                    />
                ) : (
                    <span className="HierarchyView-toggle HierarchyView-toggle--none" aria-hidden="true" />
                )}

                <div className="HierarchyView-card">
                    <div className="HierarchyView-title">
                        {canOpen ? (
                            <button type="button" className="HierarchyView-open" onClick={open} aria-label={fill(strings.open, name)}>
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
                    <Button appearance="transparent" size="small" className="HierarchyView-showall" onClick={() => props.onShowAll(node.id)}>
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
                    <Button appearance="transparent" size="small" onClick={() => props.onRetry(node.id)}>{strings.retry}</Button>
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
