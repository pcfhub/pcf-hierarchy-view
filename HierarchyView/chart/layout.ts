/**
 * 0.3.0's org chart, as arithmetic: where each card goes and the lines
 * between them, from the same rows the tree draws. Pure — no DOM, no React —
 * so the suite proves the geometry and the component only places what comes
 * back.
 *
 * The rows are `visibleRows()` — depth first, an open node's children under
 * it — so the chart and the tree agree on what is on show, and the keyboard
 * walks both in the same order.
 *
 * Two shapes of family:
 *
 * - **A team that has teams under it** is laid out side by side: each
 *   child's subtree as wide as it needs, the parent centred over its
 *   children, an elbow from the parent's foot across the children's heads.
 * - **A team of leaves** — two or more children, none of them open — hangs
 *   in a column under the parent instead, each card on a short branch off
 *   one trunk. A manager with twelve reports is then one card wide rather
 *   than twelve, which is what keeps a real org chart readable in a form
 *   section; this is the "hanging" layout org-chart tools use for the last
 *   level.
 */

export interface ChartRow {
    id: string;
    /** 0 at the top of what is drawn. */
    depth: number;
    expanded: boolean;
}

export interface ChartSizes {
    cardWidth: number;
    cardHeight: number;
    /** Between two subtrees side by side. */
    gapX: number;
    /** Between a parent's foot and its children's heads. */
    gapY: number;
    /** How far a hanging column sits in from its parent's left edge. */
    indent: number;
    /** Between two cards in a hanging column. */
    stackGap: number;
}

/**
 * `stackGap` leaves room for a hanging card's chevron, which sits half below
 * its lower edge: at 12 it touched the next card in the column.
 */
export const DEFAULT_SIZES: ChartSizes = { cardWidth: 216, cardHeight: 72, gapX: 16, gapY: 32, indent: 24, stackGap: 20 };

export interface ChartBox {
    id: string;
    x: number;
    y: number;
    /** The row's index in the rows given: the order focus and the screen reader walk. */
    index: number;
}

/** A straight segment of connector, axis-aligned. */
export interface ChartLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface ChartLayout {
    width: number;
    height: number;
    boxes: ChartBox[];
    lines: ChartLine[];
}

interface Family {
    index: number;
    row: ChartRow;
    children: Family[];
    /** Laid out as a hanging column. */
    hangs: boolean;
    /** The width the subtree takes. */
    span: number;
}

/** The rows back into the tree they were flattened from: each row's parent is the last row one level up. */
function families(rows: readonly ChartRow[]): Family[] {
    const roots: Family[] = [];
    const stack: Family[] = [];

    rows.forEach((row, index) => {
        const family: Family = { index, row, children: [], hangs: false, span: 0 };

        while (stack.length > 0 && stack[stack.length - 1].row.depth >= row.depth) {
            stack.pop();
        }
        if (stack.length === 0) {
            roots.push(family);
        } else {
            stack[stack.length - 1].children.push(family);
        }
        stack.push(family);
    });

    return roots;
}

function measure(f: Family, s: ChartSizes): number {
    f.children.forEach((c) => measure(c, s));
    f.hangs = f.children.length >= 2 && f.children.every((c) => c.children.length === 0);

    if (f.children.length === 0) {
        f.span = s.cardWidth;
    } else if (f.hangs) {
        f.span = Math.max(s.cardWidth, s.indent + s.cardWidth);
    } else {
        const row = f.children.reduce((sum, c) => sum + c.span, 0) + s.gapX * (f.children.length - 1);
        f.span = Math.max(s.cardWidth, row);
    }

    return f.span;
}

/**
 * Where every row goes. `rtl` mirrors the whole chart, so the first child is
 * on the right, as the form reads.
 */
export function layoutChart(rows: readonly ChartRow[], sizes: Partial<ChartSizes> = {}, rtl = false): ChartLayout {
    const s: ChartSizes = { ...DEFAULT_SIZES, ...sizes };
    const boxes: ChartBox[] = [];
    const lines: ChartLine[] = [];
    let height = 0;

    const place = (f: Family, left: number, y: number): number => {
        // Returns the card's x, so a parent can centre over its children.
        let x: number;

        if (f.children.length === 0) {
            x = left + (f.span - s.cardWidth) / 2;
        } else if (f.hangs) {
            x = left + (f.span - (s.indent + s.cardWidth)) / 2;
            const trunk = x + s.indent / 2;
            const top = y + s.cardHeight;
            let childY = top + s.gapY / 2;
            let lastMid = top;

            f.children.forEach((c) => {
                boxes.push({ id: c.row.id, x: x + s.indent, y: childY, index: c.index });
                lastMid = childY + s.cardHeight / 2;
                lines.push({ x1: trunk, y1: lastMid, x2: x + s.indent, y2: lastMid });
                height = Math.max(height, childY + s.cardHeight);
                childY += s.cardHeight + s.stackGap;
            });
            lines.push({ x1: trunk, y1: top, x2: trunk, y2: lastMid });
        } else {
            const childY = y + s.cardHeight + s.gapY;
            const used = f.children.reduce((sum, c) => sum + c.span, 0) + s.gapX * (f.children.length - 1);
            let cursor = left + (f.span - used) / 2;
            const heads: number[] = [];

            f.children.forEach((c) => {
                heads.push(place(c, cursor, childY) + s.cardWidth / 2);
                cursor += c.span + s.gapX;
            });

            const mid = (heads[0] + heads[heads.length - 1]) / 2;
            x = mid - s.cardWidth / 2;
            const bar = y + s.cardHeight + s.gapY / 2;
            lines.push({ x1: mid, y1: y + s.cardHeight, x2: mid, y2: bar });
            if (heads.length > 1) {
                lines.push({ x1: heads[0], y1: bar, x2: heads[heads.length - 1], y2: bar });
            }
            heads.forEach((h) => lines.push({ x1: h, y1: bar, x2: h, y2: childY }));
        }

        boxes.push({ id: f.row.id, x, y, index: f.index });
        height = Math.max(height, y + s.cardHeight);

        return x;
    };

    const roots = families(rows);
    roots.forEach((r) => measure(r, s));
    let left = 0;
    roots.forEach((r) => {
        place(r, left, 0);
        left += r.span + s.gapX;
    });
    const width = roots.length === 0 ? 0 : left - s.gapX;

    boxes.sort((a, b) => a.index - b.index);

    if (rtl) {
        boxes.forEach((b) => (b.x = width - b.x - s.cardWidth));
        lines.forEach((l) => {
            l.x1 = width - l.x1;
            l.x2 = width - l.x2;
        });
    }

    return { width, height, boxes, lines };
}

/**
 * The `scrollLeft` that puts a box's centre in the middle of a scroller
 * `viewWidth` wide, held inside what the canvas can scroll.
 */
export function centreOn(layout: ChartLayout, id: string, viewWidth: number, cardWidth = DEFAULT_SIZES.cardWidth): number {
    const box = layout.boxes.find((b) => b.id === id);

    if (!box || layout.width <= viewWidth) {
        return 0;
    }

    const wanted = box.x + cardWidth / 2 - viewWidth / 2;

    return Math.max(0, Math.min(layout.width - viewWidth, Math.round(wanted)));
}
