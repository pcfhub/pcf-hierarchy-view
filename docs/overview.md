---
title: Overview
description: What Hierarchy View does, and when to reach for it.
order: 1
---

# Hierarchy View

A record's place in its hierarchy — ancestors above, children below — from its parent lookup.

::image{src=media/screenshot.png alt="An account form section showing Contoso Holdings at the top, Contoso Europe beneath it, the open record Contoso Deutschland GmbH marked 'This record' with a count of 2, and its two child accounts indented below with their city and revenue" zoom}

Place it on the lookup that points at a record's own table — **Parent Account**
on an account, **Manager** on a user, the *Parent* column of a custom table —
and it draws the record's position in that hierarchy: every ancestor up to the
top, the record itself marked, and its children beneath it, each expandable
one level at a time. Click a name to open that record.

Model-driven apps removed their built-in hierarchy visualisation in October
2025. This is a replacement that lives on the form rather than behind a button,
reads the same self-referential relationship, and works whether or not that
relationship was ever flagged as hierarchical.

## Why this one

- **It configures itself from the column it is bound to.** The target table,
  the column children are filtered on, the record's own parent — all read from
  the lookup. Rebind it to another parent lookup and it shows that hierarchy.
- **It works on a lookup nobody flagged as hierarchical.** Dataverse's
  hierarchy operators need `IsHierarchical` set on the relationship, and on a
  custom table it usually is not. The control asks first: with the flag it
  reads the whole ancestor chain in one call and knows how many children each
  node has; without it, it walks up one level at a time and filters children on
  the lookup. Both work; the second just has no counts until a node is opened.
- **It loads what you look at.** Children come one node at a time, ordered by
  name and capped at a page size you set. An ancestor shows only the branch you
  are on until you ask for *Show all children*, so a wide company tree does not
  arrive all at once.
- **It shows the columns you name.** Up to three logical names under each
  record — a city, a revenue, an owner — as the platform formats them.
- **It never writes.** The control is bound to the parent lookup to read it,
  and leaves the column exactly as it found it.

## What it works with

| Host | Works | Notes |
| --- | --- | --- |
| Model-driven form (web) | Yes | Both routes, counts on a hierarchical lookup |
| Model-driven form (phone, tablet) | Yes | Details hidden below 480px; not yet measured on the phone client |
| Canvas app | No | Binds a `Lookup.Simple`, which canvas cannot |
| Power Pages | No | No Web API from a code component there |

## What it does not do

It does not edit the hierarchy — no drag to re-parent, no *add child*. See
[Limitations](limitations.md) for what else was decided against.
