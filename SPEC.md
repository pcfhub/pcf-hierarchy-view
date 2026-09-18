# Hierarchy View

A record's place in its hierarchy — ancestors above, children below — from its parent lookup.

Bound to a self-referential `Lookup.Simple` — `Account.parentaccountid`, a custom
table's *Parent* column — and read-only: it never writes the column it is bound
to. The bound column is the whole configuration: the target table comes from
`getTargetEntityType()`, the column to filter children on from
`attributes.LogicalName`, the record's own parent from `raw[0]`, and the record's
own id from `mode.contextInfo.entityId`.

## Measured — the 0.0.1 probe

The 0.0.1 build is a probe: `HierarchyView/probe.tsx` asks the form the
questions below and prints the answers into the control. Every design decision
under *The two routes* rests on one of them, so nothing under 0.1.0 was written
before the answers came back. Answers are recorded here with the environment
and the date.

**Environment:** the Accounts form on `cll365` (`https://cll365.crm.dynamics.com`),
2026-09-17, the control bound to *Parent Account* (`parentaccountid`), first on
*City Power & Light (sample)* (parent Blue Yonder Airlines, one child), then —
after P8 navigated there — on *Blue Yonder Airlines (sample)* (no parent, three
children, five descendants). Every answer came back the same on both records.
Nothing was cut; two answers removed work (P4: no pre-check of the refusal
shape is needed, and P10: the truncation signal is the cookie, not `nextLink`).

| # | Question | Decides | Answer |
| --- | --- | --- | --- |
| P1 | Does `context.webAPI.retrieveMultipleRecords(entity, '?fetchXml=…')` accept a FetchXML query, and does it want the XML URL-encoded or raw? What is the error shape of the loser? | `queryString()` in `query/fetchXml.ts` | Both. Encoded (`encodeURIComponent`) and raw XML each returned the same 2 rows; the raw spelling stays the default, as the Client API reference documents. |
| P2 | Do rows returned from a FetchXML query carry `@OData.Community.Display.V1.FormattedValue` annotations, and `_parentaccountid_value` for the lookup? | `toNode()` reads formatted values | Yes. `_parentaccountid_value@OData.Community.Display.V1.FormattedValue`, `…@Microsoft.Dynamics.CRM.lookuplogicalname` and `…associatednavigationproperty` beside `_parentaccountid_value`; the root row carried **no** `_parentaccountid_value` at all — a FetchXML result omits nulls, as documented. |
| P3 | Does `<attribute name='accountid' rowaggregate='CountChildren' alias='children'/>` come back, as a number or a string, and does it coexist with plain attributes without `aggregate='true'`? | the child-count badge, or its absence | Yes, as a **number** (`1`, `3`), beside the plain attributes, no `aggregate='true'`, with its own `@…FormattedValue` and `@…AttributeName` annotations. The same query without the aggregate returned the same rows. |
| P4 | `eq-or-above` on a self-referential lookup that is **not** hierarchical (`masterid` on account): the `errorCode` and `message` | the rig's refusal shape; whether a pre-check is needed at all | Refused as a plain object: `errorCode` and `code` both `2147746307`, `title` "Invalid Argument", `message` "Invalid Argument.", keys `errorCode, message, code, title, raw`. The server says nothing about hierarchy — which is why the control asks the metadata, not the query. The rig sends this shape now. |
| P5 | A same-origin `fetch` of `EntityDefinitions(LogicalName='account')/OneToManyRelationships?$select=…,IsHierarchical`: status, elapsed, `IsHierarchical` true for `parentaccountid` and false for `masterid`; is `page.getClientUrl` present on a field control | `isHierarchical()` | `page.getClientUrl()` is present on a field control and answered `https://cll365.crm.dynamics.com`. The fetch returned 200 in 153 ms with 58 rows, three self-referential: `parentaccountid` **true**, `masterid` false, `msa_managingpartnerid` false. |
| P6 | The keys of `parameters.value` and of its `attributes` on a bound `Lookup.Simple`; is `attributes.LogicalName === 'parentaccountid'`; what is `type` | `resolveBoundColumn()` | `attributes.LogicalName` = `parentaccountid`, `DisplayName` = "Parent Account", `Targets` = `["account"]`, `Type` = `lookup`; `type` = `Lookup.Simple`; `security` = `{ secured: false, editable: true, readable: true }`. The property bag itself is dataset-shaped (`records`, `paging`, `sorting`, `filtering`, `columns`, `linking`, `addColumn`…) — a lookup binding is a one-row dataset underneath. **`raw` was `[]` on the first pass** of a record whose parent is set; the row read back through FetchXML carried the parent. The control never depends on `raw[0]`. |
| P7 | `mode.contextInfo.entityId` on a saved record (braces? case?) and on an unsaved one | the *save the record first* state | `{ entityTypeName: "account", entityId: "83e84297-9486-ec11-93b0-000d3a5c8441", entityRecordName: "City Power & Light (sample)" }` — bare, lower-case, no braces, plus the record's name. An unsaved record was not tried (see *Not verified*). |
| P8 | `navigation.openForm({ entityName, entityId })` from a field control: present, navigates, what it resolves with | a card click | Present, and it navigates in place: the button opened the parent, and the control remounted on the parent's form with its `contextInfo.entityId`. What the promise resolves with was not observed — the page had moved on. |
| P9 | `getTargetEntityType()` returns `account`; `raw[0].entityType` agrees; `getViewId()` | `resolveTarget()` | `getTargetEntityType()` = `account`. `raw[0].entityType` was `undefined` because `raw` was empty (P6). **`getViewId()` returned `null`**, not a string — the typings say string. |
| P10 | With a FetchXML query and `maxPageSize = 1` on a node with two children: one row, and is `nextLink` or `fetchXmlPagingCookie` set | the *showing the first N* notice | One row. On a node with one child, no continuation; on a node with three, **`fetchXmlPagingCookie`** was set (a `<cookie pagenumber="2" pagingcookie="…">`) and `nextLink` stayed `undefined`. The `nextLink` key is always present on the result, undefined or not. The source reads either signal. |
| P11 | `utils.getEntityMetadata('account')`: `PrimaryIdAttribute`, `PrimaryNameAttribute`, elapsed | the title column and the primary key | `PrimaryIdAttribute` = `accountid`, `PrimaryNameAttribute` = `name`, `EntitySetName` = `accounts`, in 2–3 ms; own keys are the private `_…` fields, so the read is by name. |
| P12 | The fallback route: OData `$filter=_parentaccountid_value eq <id>` returns the children with formatted values; `retrieveRecord(parent, '?$select=…')` returns the parent | `childrenOData()`, the ancestor walk | `?$select=…&$filter=_parentaccountid_value eq <id>&$orderby=name asc` returned the children (`@odata.etag`, `accountid`, `name`, and the lookup omitted where null); `retrieveRecord(parent, ?$select=…)` returned the row with `@odata.context`, plus `merged` and `statecode` the platform adds unasked. |
| P13 | `under` on the current record: the descendant count, as a sanity check on the tree the form shows | nothing — a cross-check | `under` on City Power & Light: 1 descendant; on Blue Yonder Airlines: 5 — consistent with the counts the aggregate gave. |

## Platform behaviour worth knowing

Observed on the form, 2026-09-17, beyond what the probe asked:

- **A bound `Lookup.Simple` is a one-row dataset underneath.** Its property
  bag carries `records`, `paging`, `sorting`, `filtering`, `columns`,
  `linking`, `addColumn` and the rest of a dataset's surface beside `raw`,
  `type` and `attributes`. Nothing here reads any of it, but a control that
  does `Object.keys` on the property for a reason will meet forty names.
- **`raw` was empty on the first pass** for a record whose parent is set, and
  the FetchXML row confirmed the parent. Whether a later pass fills it was not
  watched — the control reads the parent off the row, never off `raw[0]`, so
  it did not matter here. A control that *does* need `raw[0]` on the first pass
  should not assume it.
- **`getViewId()` returns `null`** on this binding, against typings that say
  `string`. Unused here; recorded because `pcf-lookup-search` reads it.
- **`openForm` from a field control navigates in place**, and the control is
  destroyed and re-inited on the record it opened — which is the behaviour
  the docs promise and the reason the current record's card is not a link.
- **`retrieveRecord` adds columns you did not ask for**: `merged` and
  `statecode` came back beside the three requested, with their formatted
  values. Harmless; a `$select` is a floor, not a ceiling.

## The two routes

Decided by P5, not by P4: the control asks the metadata whether the bound
relationship is hierarchical *before* sending a hierarchical operator, because
a refused query is an error the user sees and a metadata read that fails is
not — any failure of the check (403, offline, no client URL) silently takes the
fallback route.

- **Hierarchical** — ancestors in one call with `eq-or-above` on the primary
  key, ordered client-side by following `_<column>_value`; children of a node
  with `<condition attribute='<column>' operator='eq'>` plus
  `rowaggregate='CountChildren'`, so a chevron is drawn only where there is
  something under it.
- **Fallback** — ancestors by `retrieveRecord` per level, walked from `raw[0]`
  up to 20 levels with a cycle guard; children by an OData `$filter` on the
  lookup; no counts, so every node gets a chevron until a load returns empty.

Both routes pass `maxChildren` as `maxPageSize` and stop there.

## What the build disagreed with

- **The suite crashed on a plain object, not the control.** The rig's Web API
  methods read `if (fails()) return fails();` — two rejected promises where
  one was meant, the first unhandled — and Node reported an unhandled
  rejection with reason `#<Object>`, which looked like the control rejecting
  wrongly. Fixed in `_template` and here: one refusal per call.
- **A dispatch from inside an effect re-runs the effect before the loop that
  dispatched has finished.** The loading effect marks each pending node
  `loading` and then asks for its children; the mark re-renders, the effect
  runs again, and without a set the loop owns the second run asked for the same
  children a second time. `inflight` in the component is that set.
- **The Fluent stub swallowed the `icon` slot**, so a chevron-only `Button`
  was an empty box on the harness page while the props said otherwise. The
  stub renders the icon before the children now, in `_template` and here.
- **A route is a fact about the organisation, and the harness has one.**
  `isHierarchical` is cached per organisation URL and the control's resolve is
  memoised on a key that carries that URL — correct on a form, where neither
  changes — so flipping *hierarchical*, *relationships* or *Web API fails* on
  the harness page did nothing until the page started treating each flip as a
  fresh organisation (`host.nextClientUrl()`).

## Demo

`mocked`. The control's whole content comes from `context.webAPI`, which the
hub's harness does not supply, so a demo that ran the control as-is would show
its *not available on this host* state and nothing else. `sampleData` exists
for this: a JSON tree the control renders instead of querying, documented as
demo-only, and each preset carries one. What the demo cannot show: a card click
(`openForm` has no form to open there), which of the two routes a real form
would take, and formatted values (the preset's are literal strings).

## Not verified

- **An unsaved record's `contextInfo`** — the *save the record first* state
  was reached in the rig only; the form was not opened on a new account.
- **What `openForm` resolves with** from a field control; the page had
  navigated before the promise settled.
- **Whether `raw` fills on a later pass** (P6) — not watched, not needed.
- An on-premises organisation URL with the organisation in the path
  (`https://host/org/api/data/…`) — `page.getClientUrl()` is preferred over a
  root-relative URL for that reason, following Data Table 0.5.0, but no
  on-premises environment has been tried.
- The phone client and Power Pages.
- A hierarchy deeper than the platform's 100-recursion limit for hierarchical
  operators, and a node with more than 5,000 children.

## Walkthrough — 0.1.0 on the form

The built control, imported over the probe on the same Accounts form, bound to
*Parent Account*. Each row is something the rig showed and the form has to
confirm; the tag follows the answers.

| # | On the form | Expected | Answer |
| --- | --- | --- | --- |
| W1 | Open *City Power & Light (sample)* | Blue Yonder Airlines above it (badge 3), City Power marked *This record* with badge 1, its one child beneath, collapsed with a chevron | *pending* |
| W2 | Press *Show all children* under Blue Yonder | City Power's two siblings appear beside it, by name; City Power keeps its mark and its child | *pending* |
| W3 | Press the chevron on the child | Its children load (or the chevron goes and no note appears if the count was 0 — it should not be 0, the badge said 1) | *pending* |
| W4 | Click a sibling's name | The form navigates to that record and the control redraws around it | *pending* |
| W5 | Set *Detail columns* to `address1_city, revenue` and reload | City and formatted revenue under each name; a record with neither shows no second line | *pending* |
| W6 | Open a **new** account (unsaved) | *Save the record to see its hierarchy.* — then save, and the tree appears | *pending* |
| W7 | Bind a second instance to *Master ID* (`masterid`, not hierarchical) on the same form | The tree still draws, with chevrons on every node and no badges: the fallback route | *pending* |

## Screenshots

Headless Chrome against `dev/preview.html` on the harness server
(`npm run harness -- --port 8096 --no-open`), at
`--force-device-scale-factor=2 --virtual-time-budget=4000 --hide-scrollbars`;
the page's `?width=` sets the width the host allocates and the root's, and
the window is 32 wider for the page's padding:

| File | Query | Window |
| --- | --- | --- |
| `screenshot.png` | `?width=760` | 792×314 |
| `screenshot-expanded.png` | `?showall=p1&expand=k1&width=760` | 792×394 |
| `screenshot-fallback.png` | `?hierarchical=false&width=760` | 792×314 |
| `screenshot-dark.png` | `?dark=1&showall=p1&width=760` | 792×344 |
| `screenshot-narrow.png` | `?width=320&depth=2` | 352×344 |

Heights are `document.body.scrollHeight` read off the page first. New file
names on every retake — the hub's mirror never re-fetches a path. The logo is
`media/logo.svg` in an `<img>` at 256 on a transparent body with
`--default-background-color=00000000`, checked RGBA by reading the IHDR.

## Promoting a finding

When something here turns out to be general — true of PCF rather than true of
this control — move it to the skill's `references/control-patterns.md` and
replace it here with a line naming where it went.
