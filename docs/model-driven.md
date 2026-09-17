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
5. Optionally set **Detail columns** to the logical names you want under each
   record, and **Levels open at start**.
6. Save and publish.
:::

:::callout{type=info}
Put it in its own section, full width. The tree is as tall as the hierarchy is
deep, and a narrow column hides the detail lines to keep four levels legible.
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
| Sample data (demo only) | *(blank)* | Leave blank on a real form. When set, the control renders this JSON tree and queries nothing — see [Examples](examples.md). |

## Unsaved records

On a record that has not been saved yet there is no hierarchy to show, and the
control says so: *Save the record to see its hierarchy.*
