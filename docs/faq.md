---
title: FAQ
description: Questions that come up more than once.
order: 8
---

# FAQ

## It says "This control needs a lookup to the record's own table." I put it on a lookup.

The lookup points at a different table. The control draws the hierarchy of the
table the form is on, so it has to be bound to the lookup that points back at
that same table — *Parent Account* on Account, not *Primary Contact*. A
customer lookup is refused for the same reason: it can point at two tables.

## Why are there no counts next to the records?

The self-referential relationship is not flagged as hierarchical, so the
control took the route that works without the flag — walking up one level at a
time and filtering children on the lookup — and that route cannot know how
many children a node has until it is opened. Tick **Hierarchical** on the
one-to-many relationship (Tables → your table → Relationships) and the counts
appear on the next load. Nothing on the form needs to change.

## Why is there a chevron on a record that turns out to have no children?

Same reason as above: without the flag, every node might have children until
the control asks. The chevron goes away after the first click. With the flag,
chevrons are drawn only where the count is above zero.

## Why does the top of the tree show only one branch?

An ancestor shows the branch that leads down to this record, so the tree reads
as *where am I* rather than *everything*. **Show all children** under an
ancestor loads its other children — this record's siblings, or its parent's.

## Why does the top of the tree stop at a record that has a parent?

You do not have read access to that parent. The tree starts at the top-most
record you may see and does not say what sits above it.

## It says "Save the record to see its hierarchy."

The record is new and has no id yet, so there is nothing to look up. Save it;
the tree appears on the next render.

## It says "The hierarchy is not available on this host."

The host gave the control no Web API. That is a canvas app, a preview surface
that stubs the platform, or an environment where the `WebAPI` feature was
declined when the control was added. On a model-driven form it means the
latter.

## Can I show a column from a related table?

No. **Detail columns** takes logical names on the record's own table. A lookup
column shows the related record's *name*, which covers the common case.

## Does clicking a name open the record in the same tab?

It calls the platform's `openForm`, which opens the record the way the app is
configured to — normally in place, replacing the current form. The current
record is not a link.

## Does it work offline / on the phone?

It renders in the phone layout — the details hide below 480 pixels — and it
needs a connection, because everything it shows is read from Dataverse when the
form opens. It has not yet been opened on the phone client itself; see
[Limitations](limitations.md).
