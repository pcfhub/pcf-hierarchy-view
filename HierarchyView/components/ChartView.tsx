import * as React from 'react';
import { Avatar, Button, Spinner } from '@fluentui/react-components';
import { ChartLayout, layoutChart } from '../chart/layout';
import { canOpen } from '../tree/keyboard';
import { VisibleRow } from '../tree/reducer';
import type { Strings } from './HierarchyViewControl';

/** Space round the drawing inside the scroller, so a focus ring is never clipped. */
export const CHART_PAD = 8;
export const CARD_WIDTH = 216;

/**
 * Every card is one height, so a level is one line and the connectors are
 * straight: the name, each detail column, the footer, and room for a picture.
 */
export function cardHeight(details: number, showImage: boolean): number {
    const text = 20 + Math.min(3, details) * 16;
    const head = Math.max(showImage ? 32 : 0, text);

    return head + 44;
}

export interface ChartProps {
    rows: VisibleRow[];
    positions: { posInSet: number; setSize: number }[];
    /** The id each row's element carries, for `aria-activedescendant`. */
    domId: (id: string) => string;
    activeId: string | null;
    /** Changes when the tree starts over: the chart centres on the record once per key. */
    sourceKey: string;
    currentId: string;
    isRTL: boolean;
    showImage: boolean;
    imageUrl: (node: VisibleRow['node']) => string | undefined;
    label: string;
    strings: Strings;
    canOpenRecord: boolean;
    containerProps: React.HTMLAttributes<HTMLDivElement> & { ref: React.Ref<HTMLDivElement> };
    onSelect: (id: string, event?: React.MouseEvent) => void;
    onToggle: (id: string) => void;
    onRetry: (id: string) => void;
    onShowAll: (id: string) => void;
    onOpen: (id: string) => void;
    fill: (template: string, value: string | number) => string;
}

/** A card's chevron hangs this far below its lower edge; the canvas leaves room for it under the last row. */
const TOGGLE_OVERHANG = 12;

const Chevron = (): React.ReactElement => (
    <svg className="HierarchyView-chevron" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path
            fill="currentColor"
            d="M7.65 4.15c.2-.2.5-.2.7 0l5.49 5.46c.21.22.21.57 0 .78l-5.49 5.46a.5.5 0 0 1-.7-.7L12.8 10 7.65 4.85a.5.5 0 0 1 0-.7Z"
        />
    </svg>
);

/**
 * 0.3.0's org chart. The drawing is a canvas **placed absolutely** inside a
 * `width: 100%` scroller — measured on the form (SPEC.md C1): an in-flow
 * canvas widens the control past its section, and `allocatedWidth` is the
 * field's whole cell, label and all, so the root does not take it. Out of
 * the flow, the scroller is exactly the control's column and the chart
 * scrolls sideways inside it.
 *
 * The scroller is `dir="ltr"` whatever the user's direction: the layout
 * mirrors itself for right-to-left (`layoutChart(…, rtl)`), and an RTL
 * scroller's `scrollLeft` counts the other way in every browser differently.
 * Each card takes the user's direction back for its text.
 */
export function ChartView(props: ChartProps): React.ReactElement {
    const { rows, strings, showImage } = props;
    const scroller = React.useRef<HTMLDivElement>(null);
    const [viewWidth, setViewWidth] = React.useState(0);
    /*
     * Whether the person has moved the view — scrolled it, pressed a key in
     * it, pressed on it. Until they have, the chart keeps the record in the
     * middle as the tree grows: on the form the first draw is the chain alone,
     * and the second level arriving a moment later made it 696px wide in a
     * 538px column with the record 79px off-centre (0.3.0 walkthrough, W5).
     * Once they have, nothing moves under them.
     */
    const touched = React.useRef(false);
    const lastSet = React.useRef<number | null>(null);
    const details = rows.reduce((most, row) => Math.max(most, row.node.details.filter((d) => d.text !== '').length), 0);
    const height = cardHeight(details, showImage);

    const layout: ChartLayout = React.useMemo(
        () => layoutChart(
            rows.map((row) => ({ id: row.node.id, depth: row.depth, expanded: row.expanded })),
            { cardWidth: CARD_WIDTH, cardHeight: height },
            props.isRTL,
        ),
        [rows, height, props.isRTL],
    );

    React.useEffect(() => {
        const element = scroller.current;

        if (!element || typeof ResizeObserver !== 'function') {
            return undefined;
        }

        const observer = new ResizeObserver(() => setViewWidth(element.clientWidth));

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    React.useEffect(() => {
        touched.current = false;
        lastSet.current = null;
    }, [props.sourceKey]);

    /*
     * The record the form is open on, in the middle of the view, by
     * `scrollLeft` alone, which moves nothing but the scroller (C2) — never
     * `scrollIntoView` here: that scrolls the form too.
     */
    React.useEffect(() => {
        const element = scroller.current;
        const box = layout.boxes.find((b) => b.id === props.currentId);

        if (!element || !box || viewWidth === 0 || touched.current) {
            return;
        }

        const total = layout.width + 2 * CHART_PAD;
        const wanted = box.x + CHART_PAD + CARD_WIDTH / 2 - viewWidth / 2;
        const target = total <= viewWidth ? 0 : Math.max(0, Math.min(total - viewWidth, Math.round(wanted)));

        lastSet.current = target;
        element.scrollLeft = target;
    }, [layout, viewWidth, props.currentId, props.sourceKey]);

    // A scroll that is not ours is the person's.
    const onScroll = (): void => {
        const element = scroller.current;

        if (element && (lastSet.current === null || Math.abs(element.scrollLeft - lastSet.current) > 1)) {
            touched.current = true;
        }
    };
    const touch = (): void => {
        touched.current = true;
    };

    const total = layout.width + 2 * CHART_PAD;
    const overflows = viewWidth > 0 && total > viewWidth;
    // A chart narrower than its view sits in the middle of it, as an org chart is read.
    const offset = viewWidth > total ? Math.floor((viewWidth - total) / 2) : 0;
    const canvasHeight = layout.height + 2 * CHART_PAD + TOGGLE_OVERHANG;
    const path = layout.lines
        .map((l) => `M${l.x1 + CHART_PAD} ${l.y1 + CHART_PAD}H${l.x2 + CHART_PAD}V${l.y2 + CHART_PAD}`)
        .join('');

    return (
        <div
            {...props.containerProps}
            className="HierarchyView-chart"
            role="tree"
            aria-label={props.label || undefined}
            onKeyDownCapture={touch}
            onMouseDownCapture={touch}
        >
            <div
                className="HierarchyView-chartScroll"
                dir="ltr"
                ref={scroller}
                onScroll={onScroll}
                // A horizontal scrollbar takes its height from inside the box; leave it room.
                style={{ height: canvasHeight + (overflows ? 18 : 0) }}
            >
                <div className="HierarchyView-canvas" style={{ left: offset, width: total, height: canvasHeight }}>
                    <svg className="HierarchyView-lines" width={total} height={canvasHeight} aria-hidden="true" focusable="false">
                        <path d={path} />
                    </svg>
                    {layout.boxes.map((box) => {
                        const row = rows[box.index];

                        return (
                            <ChartCard
                                key={row.node.id}
                                row={row}
                                left={box.x + CHART_PAD}
                                top={box.y + CHART_PAD}
                                height={height}
                                position={props.positions[box.index]}
                                domId={props.domId(row.node.id)}
                                active={props.activeId === row.node.id}
                                dir={props.isRTL ? 'rtl' : undefined}
                                image={showImage ? props.imageUrl(row.node) ?? null : undefined}
                                strings={strings}
                                canOpenRecord={props.canOpenRecord}
                                fill={props.fill}
                                onSelect={props.onSelect}
                                onToggle={props.onToggle}
                                onRetry={props.onRetry}
                                onShowAll={props.onShowAll}
                                onOpen={props.onOpen}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

interface CardProps {
    row: VisibleRow;
    left: number;
    top: number;
    height: number;
    position: { posInSet: number; setSize: number };
    domId: string;
    active: boolean;
    dir: 'rtl' | undefined;
    /** `undefined`: pictures are off. `null`: on, and this record has none — its initials. */
    image: string | null | undefined;
    strings: Strings;
    canOpenRecord: boolean;
    fill: (template: string, value: string | number) => string;
    onSelect: (id: string, event?: React.MouseEvent) => void;
    onToggle: (id: string) => void;
    onRetry: (id: string) => void;
    onShowAll: (id: string) => void;
    onOpen: (id: string) => void;
}

/**
 * One card. Its buttons are mouse targets only (`tabIndex={-1}`): the chart
 * is one tab stop and the keys do what they do (tree/keyboard.ts).
 */
export function ChartCard(props: CardProps): React.ReactElement {
    const { row, strings, fill } = props;
    const { node } = row;
    const name = node.name || '—';
    const toggles = canOpen(row) && !row.partial;
    const canOpenThis = props.canOpenRecord && !row.isCurrent;
    const shown = node.details.filter((detail) => detail.text !== '');
    const classes = [
        'HierarchyView-node',
        row.isCurrent ? 'HierarchyView-node--current' : '',
        props.active ? 'HierarchyView-node--active' : '',
    ].filter(Boolean).join(' ');

    let foot: React.ReactNode = null;

    if (row.loading) {
        foot = (
            <>
                <Spinner size="extra-tiny" aria-hidden="true" />
                <span>{strings.loading}</span>
            </>
        );
    } else if (row.failed !== null) {
        foot = (
            <>
                <span className="HierarchyView-foot--failed" title={fill(strings.loadFailed, row.failed)}>{fill(strings.loadFailed, row.failed)}</span>
                <Button appearance="transparent" size="small" tabIndex={-1} className="HierarchyView-link" onClick={() => props.onRetry(node.id)}>{strings.retry}</Button>
            </>
        );
    } else if (row.partial) {
        foot = <Button appearance="transparent" size="small" tabIndex={-1} className="HierarchyView-link" onClick={() => props.onShowAll(node.id)}>{strings.showAll}</Button>;
    } else if (row.truncated && row.expanded) {
        foot = <span>{fill(strings.truncated, row.loadedCount)}</span>;
    } else if (node.childCount !== null && node.childCount > 0) {
        foot = <span>{fill(strings.children, node.childCount)}</span>;
    }

    return (
        <div
            id={props.domId}
            className={classes}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-setsize={props.position.setSize}
            aria-posinset={props.position.posInSet}
            aria-expanded={canOpen(row) ? row.expanded : undefined}
            aria-selected={props.active}
            aria-current={row.isCurrent ? 'true' : undefined}
            dir={props.dir}
            style={{ left: props.left, top: props.top, width: CARD_WIDTH, height: props.height }}
            onMouseDown={(event) => props.onSelect(node.id, event)}
        >
            <div className="HierarchyView-nodeHead">
                {props.image !== undefined && (
                    <Avatar className="HierarchyView-avatar" size={32} name={node.name} image={props.image ? { src: props.image, alt: '' } : undefined} aria-hidden="true" />
                )}
                <div className="HierarchyView-nodeText">
                    {canOpenThis ? (
                        <button type="button" tabIndex={-1} className="HierarchyView-open HierarchyView-nodeName" onClick={() => props.onOpen(node.id)} title={name}>
                            {name}
                        </button>
                    ) : (
                        <span className="HierarchyView-name HierarchyView-nodeName" title={name}>{name}</span>
                    )}
                    {shown.slice(0, 3).map((detail) => (
                        <span key={detail.column} className="HierarchyView-nodeDetail" title={detail.text}>{detail.text}</span>
                    ))}
                </div>
            </div>
            <div className="HierarchyView-nodeFoot">
                {row.isCurrent && <span className="HierarchyView-badge HierarchyView-badge--current">{strings.current}</span>}
                {foot}
            </div>
            {toggles && (
                <Button
                    appearance="outline"
                    size="small"
                    shape="circular"
                    tabIndex={-1}
                    className={`HierarchyView-nodeToggle${row.expanded ? ' HierarchyView-nodeToggle--open' : ''}`}
                    aria-label={fill(row.expanded ? strings.collapse : strings.expand, name)}
                    icon={<Chevron />}
                    onClick={() => props.onToggle(node.id)}
                />
            )}
        </div>
    );
}
