---
title: Model-driven apps
description: Adding Hierarchy View to a form.
order: 4
---

# Using it on a model-driven form

:::steps
1. Open the form in the modern form designer.
2. Add — or select — the table's **parent lookup**: *Parent Account* on an
   account, *Parent* on a custom table.
3. Under **Components → Add component**, choose **Hierarchy View**.
4. Enable it for **Web**, **Phone** and **Tablet** as appropriate.
5. Optionally set **Layout** to *Org chart*, **Show pictures** on,
   **Detail columns** to the logical names you want under each record, and
   **Levels open at start**.
6. Save and publish.
:::

:::callout{type=info}
Put it in its own section if you can, with the label above the field or hidden.
The tree is as tall as the hierarchy is deep and as wide as the column it is in;
it works in a two-column section, where the indent tightens, and best across a
full-width one, where long names stop wrapping. The org chart wants the width
more: beside a label in a two-column section on a 1,000-pixel window the
field's column was 289 pixels on the test form, and below 480 the chart draws
the tree.
:::

## The column it binds

One lookup, and that lookup must point at the record's **own table** — a
self-referential `Lookup.Simple`. The control reads three things from it and
nothing else needs configuring:

- the **target table**, which is the table to read the hierarchy from;
- the **column's logical name**, which is what children are filtered on;
- the record's **own parent**, which is the first step up.

A lookup pointing at another table is refused with *This control needs a lookup
to the record's own table*, because a hierarchy across two tables is not one
the control can draw. A customer lookup (account or contact) is polymorphic and
is refused the same way.

## What the tree shows

From the top: every **ancestor**, each showing only the branch that leads down
to this record, with a *Show all children* action to see its other children.
Then **this record**, marked. Then its **children**, ordered by name, each with
a chevron where there is something beneath it — expanding one loads its
children, one level per click.

Click any name other than this record's to **open** that record on its own
form. The current record is not a link, because you are already on it.

## The two routes, and why you may or may not see counts

If the self-referential relationship is flagged **hierarchical** in the table's
relationship settings, the control reads the whole ancestor chain in one query
and each node arrives with its **child count**, shown as a badge. A chevron is
drawn only where the count is above zero.

If it is not flagged, the control walks up one record per level and loads
children by filtering on the lookup. Nothing says how many children a node
has until it is opened, so every node gets a chevron and an empty one loses it
after the first click. Flag the relationship to get the counts — it is a
checkbox on the one-to-many relationship, and Dataverse allows one hierarchical
relationship per table.

## Properties

| Property | Default | Notes |
| --- | --- | --- |
| Detail columns | *(none)* | Comma-separated logical names, up to three. Anything that is not a logical name is dropped. |
| Levels open at start | `1` | `0` shows this record's children collapsed; `1` shows them; deeper levels cost one query per node. Capped at 5. |
| Children per node | `50` | The page size per node. A node with more says *Showing the first N*. Between 1 and 250. |
| Layout | *Tree* | *Org chart* draws the hierarchy top down; below 480 pixels it draws the tree. Switching it redraws what is loaded and queries nothing. |
| Show pictures | Off | Each record's picture from the table's primary image column, initials where there is none. A table without an image column shows initials only. |

## The org chart

Each record is a card: its picture, its name, up to three detail columns, and a
line saying how many children it has, *Show all children* on an ancestor, or
that its children are loading. A card's chevron, on its lower edge, opens and
closes it.

A record whose children have children of their own lays them **side by side**,
itself centred over them. A record whose children are all closed lets them
**hang** in a column beneath it, one card wide however many there are — the
shape org charts give a team of direct reports. Open one of them and the family
spreads out side by side again.

The chart **scrolls sideways inside the control** when it is wider than the
column, and starts with this record in the middle, staying there as the first
levels load. Once you scroll, click or press a key in it, it stays where you
put it. The form itself never scrolls under it.

## Pictures

With **Show pictures** on, each card shows the record's picture from the
table's **primary image** column — the one its form header shows. That is
`entityimage` on most system tables, but a custom Image column can be made
primary, and the control reads which before it asks: on the test environment
account's was a custom column. A record without a picture shows its initials,
and a table with no image column at all shows initials only — the control asks
for no picture there rather than have the query refused.

Pictures are the 144-pixel thumbnails Dataverse keeps for every image, loaded
from the environment by the browser as the cards appear.

## The keyboard

Tab reaches the tree — or the chart — **once**; the rows are not separate stops.

| Key | Does |
| --- | --- |
| ↓ ↑ | The next or previous record on show, in tree order (in the chart: down a family, then across) |
| → | Opens a closed record; on an open one, moves to its first child |
| ← | Closes an open record; otherwise moves to its parent |
| Home, End, Page Up, Page Down | The first, the last, ten at a time |
| `*` | Opens every closed sibling; on a branch an ancestor shows alone, loads the rest of the family (*Show all children*) |
| Enter | Opens the record — not the one the form is on |
| A letter | Finds the next record whose name starts with what you type |

→ on a record whose children could not be read asks again. The keys are the
WAI-ARIA tree pattern's; a model-driven form lets every one of them through to
the control, and keeps Tab for moving between fields.

## Unsaved records

On a record that has not been saved yet there is no hierarchy to show, and the
control says so: *Save the record to see its hierarchy.*
