---
title: API reference
description: Properties and outputs, generated from the control manifest.
order: 5
---

# API reference

<!--
  Do not write the property tables by hand.

  `props-table` renders from what the hub parsed out of
  ControlManifest.Input.xml at the release being viewed, so it cannot drift from
  the control. A hand-written table is wrong the first time somebody adds a
  property and forgets this file, and a reader has no way to tell.

  kind: input | bound | output | dataset | dataset_column
  Omit `kind` to render every property in one table.
-->

## Input properties

::props-table{kind=input}

## Bound properties

::props-table{kind=bound}

## Notes

The control declares no outputs: it reads the bound lookup and never writes it.

**Detail columns** is a comma-separated list of logical names —
`address1_city, revenue, primarycontactid`. Case does not matter, spaces are
ignored, duplicates and the primary name and key are dropped, and anything that
is not a logical name (`[a-z][a-z0-9_]*`) is dropped rather than sent to the
server. The first three survivors are shown, in the order given, as the
platform formats them: a currency with its symbol, a choice as its label, a
lookup as the related record's name.

**Levels open at start** is clamped to 0–5. **Children per node** is clamped to
1–250 and is the page size of every children query; a node with more children
than that shows the first page and says so.

**Sample data (demo only)** is a JSON object:

```json
{
  "current": "c1",
  "records": [
    { "id": "r1", "name": "Contoso Holdings", "parentId": null, "childCount": 1 },
    { "id": "c1", "name": "Contoso Europe", "parentId": "r1",
      "details": { "City": "Amsterdam", "Revenue": "$340,000,000.00" }, "childCount": 2 },
    { "id": "k1", "name": "Contoso Deutschland GmbH", "parentId": "c1" }
  ]
}
```

`current` names the record the tree is drawn around; `parentId` is another
record's `id` or `null`; `details` is up to three label → text pairs shown
as typed; `childCount` is optional and decides whether a chevron is drawn
before the node is opened. Ids are any non-empty strings. A record whose
`parentId` names nothing becomes a root. When this property holds anything at
all, the control renders it and makes **no query** — it exists for PCFHub's
demo and for previewing the layout, and belongs blank on a real form.
