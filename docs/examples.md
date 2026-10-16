---
title: Examples
description: Worked configurations of Hierarchy View.
order: 6
---

# Examples

## The account hierarchy, replacing the removed visualisation

Account's *Parent Account* relationship is hierarchical out of the box, so
this is the shortest configuration and the one most people want.

Place the control on **Parent Account**, then set:

| Property | Value |
| --- | --- |
| Detail columns | `address1_city, revenue` |
| Levels open at start | `1` |
| Children per node | `50` |

Opening *Contoso Deutschland GmbH* shows *Contoso Holdings* → *Contoso Europe*
above it, the record marked, and its subsidiaries beneath with their city and
annual revenue. Each ancestor carries a count and a *Show all children* action
that reveals the record's siblings.

## The same hierarchy as an org chart, with pictures

Same binding, three more settings:

| Property | Value |
| --- | --- |
| Layout | *Org chart* |
| Show pictures | On |
| Levels open at start | `2` |

Opening *Blue Yonder Airlines* draws it at the top with its picture, its three
subsidiaries side by side beneath it — the one with a subsidiary of its own
open, because two levels open at start — and centres Blue Yonder in the
column once they have loaded. Put it in a full-width section with the label
above; in a two-column section beside a label, a narrow window turns it back
into the tree.

## A custom table whose parent lookup was never flagged

A *Location* table with a *Parent Location* lookup, created in the maker
portal without ticking *Hierarchical* on the relationship.

Place the control on **Parent Location** with:

| Property | Value |
| --- | --- |
| Detail columns | `cr123_locationtype, cr123_manager` |
| Levels open at start | `2` |

The control asks the relationship metadata, learns the lookup is not
hierarchical, and takes the route that needs no flag: it walks up one record
per level and filters children on the lookup. Every node shows a chevron until
it is opened; an empty one loses it. Two levels open at start means the
children *and* the grandchildren load on first render — one query per node, so
keep this at 1 on a wide tree.

Flag the relationship later and, without touching the form, the control starts
reading the chain in one call and showing counts.

## A reporting line

User's *Manager* (`parentsystemuserid`) is a self-referential lookup. On the
User form:

| Property | Value |
| --- | --- |
| Detail columns | `title, businessunitid` |
| Levels open at start | `1` |

With **Layout** set to *Org chart* and **Show pictures** on, it is one: the
reporting line from the top down to this user, their direct reports hanging in
a column beneath them, each with their photo, title and business unit.
