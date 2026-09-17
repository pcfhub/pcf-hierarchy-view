---
title: Installation
description: Import the solution and make the control available.
order: 2
---

# Installation

:::steps
1. Download the **managed** solution for your environment.
2. In the Power Platform admin centre, import the solution.
3. Publish all customizations.
:::

:::callout{type=warning}
Import the managed solution into production. The unmanaged one is for a
development environment where you intend to change the control itself — it
cannot be cleanly uninstalled.
:::

## Requirements

- A **model-driven app**. The control binds a `Lookup.Simple` column, which
  canvas apps cannot bind; see [Limitations](limitations.md).
- A table with a lookup to **itself** — `parentaccountid` on Account,
  `parentcustomerid` on Contact when it points at a contact, `parentsystemuserid`
  on User, or a custom table's own *Parent* column.
- Nothing to enable on the relationship. If the self-referential relationship
  is flagged **hierarchical** (Tables → Relationships → *Hierarchical* on the
  one-to-many), the control reads the whole ancestor chain in one call and can
  show child counts; if it is not, the control still works and loads one level
  at a time.

## Permissions the maker is asked for

The solution declares two platform features, and both appear as a prompt when
the control is added to a form:

| Feature | What it is used for |
| --- | --- |
| `WebAPI` | Reading the record's ancestors and children from its own table |
| `Utility` | Finding the table's primary key and name columns |

Both are declared **optional**. A host that provides neither still loads the
control — it says the hierarchy is not available on this host rather than
failing to appear. Without `Utility` alone, the control assumes the usual
`<table>id` and `name` columns, which is right for every standard table and
most custom ones.

The control makes one more read that no feature gates: a same-origin request to
the table's relationship metadata (`EntityDefinitions(…)/OneToManyRelationships`),
to learn whether the lookup is hierarchical. If that read is refused, the
control takes the route that needs no flag. Nothing leaves the organisation.
