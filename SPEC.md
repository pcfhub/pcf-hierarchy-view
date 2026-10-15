# Hierarchy View

A record's place in its hierarchy — ancestors above, children below — from its parent lookup.

Bound to a self-referential `Lookup.Simple` — `Account.parentaccountid`, a custom
table's *Parent* column — and read-only: it never writes the column it is bound
to. The bound column is the whole configuration: the target table comes from
`getTargetEntityType()`, the column to filter children on from
`attributes.LogicalName`, the record's own parent from `raw[0]`, and the record's
own id from `mode.contextInfo.entityId`.

## Measured — the 0.2.9 probe (for 0.3.0: an org chart, pictures, one tab stop)

0.3.0 adds a `layout` input — the indented tree, or an **org chart** drawn top
down that scrolls sideways inside the control and falls back to the tree below
480 pixels — a `showImage` input for each record's picture, and the WAI-ARIA
tree keyboard the control has never had (one tab stop, arrows inside, from the
template's `lib/tree-keys`). Picked by the 25th demand run (2026-10-15): PCF
Gallery's two hierarchy requests, 28 and 10 votes, and the hub had no org chart.

The 0.2.9 build is the control as 0.2.0 draws it with `HierarchyView/probe.tsx`
under it, printing into the control and the console under
`[hierarchy-view probe 0.2.9]`. The manifest already carries `layout` and
`showImage`, so the property panel is part of what is measured. The A questions
are not for this control — it calls no action — but for the skill, whose
*Calling a Web API function* section has said since 2026-09-18 that no action
was ever measured; they run against a throwaway, no-plug-in Custom API created
and deleted from the console (`__hierarchyProbe.setup()` / `actions()` /
`cleanup()`).

**The rule:** an answer that goes the wrong way removes what depends on it. C3
or C4 the wrong way cuts `showImage`, not the chart. Keyboard reach is not
asked again: `pcf-code-editor`'s 1.6.9 probe pressed every key the pattern
uses on this form and the form took none.

| # | Question | Decides | Answer |
| --- | --- | --- | --- |
| C1 | On a one-column and a two-column section: `allocatedWidth`, `allocatedHeight` (expected −1), and whether a 2,400-pixel canvas scrolls **inside** the control without widening the section or the page — and whether the control follows the window both ways (Chart View's X7: grew and never shrank) | the chart's scroller; the root taking `allocatedWidth` | **Grows, unless the canvas is out of the flow — and `allocatedWidth` is the wrong width on a field.** An in-flow 2,400 px canvas widened the control to 2,420 px (pass 1: `allocatedWidth` −1, `allocatedHeight` −1; pass 2, ~3 s later: 723.5 / −1); nothing scrolled inside. Held to `allocatedWidth` (724) it scrolled, but **723.5 is the whole field cell with its label beside it — the control's own column was 540**, so a root set to it overflows by the label. A `position: relative; width: 100%; overflow: auto` scroller holding an **absolutely placed** 2,400 px canvas took the control's column exactly (538) and scrolled inside it, without reading `allocatedWidth`, and followed the window both ways (1497 → 1000 → 1497 px: 538 → 289 → 538). No page overflow in any run. |
| C2 | Setting the inner scroller's `scrollLeft` to centre a box moves the form's own scroll by nothing — at mount and on a button | centring the current record at mount | **Nothing moves but the scroller.** `scrollLeft` 0 → 1438 (held scroller) and 0 → 1532 (out-of-flow scroller) with the form's tab scroller at 0 and at 40: it stayed at 0 and at 40; `window.scrollY` 0 throughout. |
| C3 | `entityimage_url` through both routes — OData `$select` on `retrieveRecord`/`retrieveMultipleRecords` and a FetchXML `<attribute>` — on account and contact: its shape (relative?), and what a record with no picture answers | the column the routes add when `showImage` is on | **Both routes answer it; a record with no picture differs.** OData `$select=…,entityimage_url` (`retrieveRecord` and `retrieveMultipleRecords`, account and contact) answers a **relative** `/Image/download.aspx?Entity=account&Attribute=entityimage&Id=<id>&Timestamp=<ticks>`, and `null` without a picture. A FetchXML `<attribute name='entityimage_url'/>` answers the same string — and **omits the key** for a row without one (`keys` of such a row: `@odata.etag`, `accountid`, `name`). 1 account of 25 and 7 contacts of 25 had pictures (the samples). |
| C4 | That URL as an `<img src>` on the form: loads (with the user's session, under the form's CSP), and as a same-origin `fetch`: status and content type | `showImage` at all | **Loads.** `<img src>` at `getClientUrl()` + the relative URL: `onload`, natural 144×144 (the thumbnail; `&Full=true` is the full image — not asked). Same-origin `fetch`: 200, `image/jpeg`. The form's CSP and session are no obstacle. |
| C5 | The property panel: `layout` blank → `raw`? `showImage` blank → `raw`, and its type (boolean or string)? | the defaults and the TwoOptions normaliser | **Blank is `null` for both, not the default.** `layout`: `raw` null, `type` null; `showImage`: `raw` null (typeof object), `type` null — the manifest's `default-value` (`tree`, `false`) never arrives. The control reads `null` as `tree` and as off. |
| A1 | An unbound action (`pcfhub_ProbeEcho`, string in, string out, no plug-in) by same-origin `fetch` POST: which headers it needs (Content-Type, OData-Version), whether the session cookie is the whole of authentication, and the success shape (200 + body, or 204) | the skill's *Calling a Web API action* | **200 with the response properties, Content-Type required, the cookie is the whole of authentication.** POST `…/api/data/v9.2/pcfhub_ProbeEcho`, body `{"Text":…}`: 200 `{"@odata.context":"…$metadata#Microsoft.Dynamics.CRM.pcfhub_ProbeEchoResponse","Echo":null}` (a no-plug-in API answers its properties null) in 133 ms. **No `Content-Type` → 415** `0x80060888` *POST request requires Content-Type application/json.* Only `Content-Type`, no OData headers → 200. `credentials: 'omit'` → 401, empty body (4.7 s). No CSRF token. |
| A2 | The bound twin on `accounts(<id>)/Microsoft.Dynamics.CRM.pcfhub_ProbeEchoAccount` — and unqualified, and called unbound | the same section: the URL shapes | **Bound needs the qualified name.** `accounts(<id>)/Microsoft.Dynamics.CRM.pcfhub_ProbeEchoAccount` → 200 `…pcfhub_ProbeEchoAccountResponse`, `Echo: null`. Unqualified `accounts(<id>)/pcfhub_ProbeEchoAccount` → 404 `0x80060888` *Resource not found for the segment*; the bound one called unbound → the same 404. |
| A3 | The refusals: a missing required parameter, a wrong type, an unknown parameter, a malformed body, an action that does not exist, a GET on an action — each status and `{ error: { code, message } }` | the rig's action stub, refusals first | **Payload faults are 400 `0x80048d19` with a .NET stack in `message`; routing faults are 404.** Missing required parameter: 400 *…The missing parameters are: Text.* Wrong type (`5` for a string): 400 *Cannot convert the literal '5' to the expected type 'Edm.String'.* Unknown parameter: 400 *The parameter 'Nope' … is not a valid parameter.* Malformed body: 400 *Stream was not readable.* No such action: 404 `0x80060888` *Resource not found for the segment 'pcfhub_NoSuchAction'.* GET on an action: 404 with **`code: ""`** *No HTTP resource was found that matches the request URI.* Each `message` is 1.5–3.4 KB: show the first line. |
| A4 | Does a no-plug-in bound action touch the record (`modifiedon`, `versionnumber`)? | what the rig's stub may change | **Untouched.** `modifiedon` 2026-09-19T03:44:22Z and `versionnumber` 33816612 before and after the bound call. Creating and deleting the two Custom APIs: POST `customapis` with deep-inserted parameter and property, 204 in 2–7 s, no solution header needed for the `pcfhub_` prefix; DELETE cascades both (checked). |

**Environment:** the account form *Information* on the test environment, 2026-10-15, the control bound to *Parent Account* (`parentaccountid`, label beside the field, two-column section) on *City Power & Light (sample)()* — parent and children. 0.2.9 was imported and bound by Claude (pac, `ppdev form control bind`) and driven from the browser pane; its C3/C4 block threw before logging (the window object did not exist yet), so **0.2.10** re-asked C3/C4. C1/C2's out-of-flow scroller was measured with a test element placed beside the control's root from the console. A1–A4 ran from the console, calling the probe's own `fetch` code in the same window as the control. The Custom APIs were created and deleted the same minute.

**What the answers changed.** C1 removed a planned step: the root does **not** take `allocatedWidth` — on a field control with its label beside it that number is the cell, ~184 px wider than the control (the three-part rule from Chart View holds for a dataset, whose cell has no label). The chart is a canvas placed absolutely inside a `width: 100%` scroller, and the narrow fallback reads the control's own measured width. Nothing was cut: C3/C4 keep `showImage`; C5 adds a normaliser for `null`. The form-designer half of C5 (what the panel shows) was not looked at — the binding was made by XML.

**To run it:** import `HierarchyView_0.2.9_probe.zip` (unmanaged, as an upgrade),
publish, hard-reload the account form that carries the control on *Parent
Account*, on an account **with a parent and children**. For C4 at least one
account needs a picture (the avatar in the form header). C1 wants the control
in a one-column and then a two-column section (or the browser narrowed and
widened). Then in the console: `await __hierarchyProbe.setup()`, `await
__hierarchyProbe.actions()`, `await __hierarchyProbe.cleanup()`,
`copy(__hierarchyProbe.dump())`.

## Measured — the 0.0.1 probe

The 0.0.1 build is a probe: `HierarchyView/probe.tsx` asks the form the
questions below and prints the answers into the control. Every design decision
under *The two routes* rests on one of them, so nothing under 0.1.0 was written
before the answers came back. Answers are recorded here with the environment
and the date.

**Environment:** the Accounts form on the test environment,
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
| P5 | A same-origin `fetch` of `EntityDefinitions(LogicalName='account')/OneToManyRelationships?$select=…,IsHierarchical`: status, elapsed, `IsHierarchical` true for `parentaccountid` and false for `masterid`; is `page.getClientUrl` present on a field control | `isHierarchical()` | `page.getClientUrl()` is present on a field control and answered `https://<org>.crm.dynamics.com`. The fetch returned 200 in 153 ms with 58 rows, three self-referential: `parentaccountid` **true**, `masterid` false, `msa_managingpartnerid` false. |
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

- **The hub's demo found the sample route ignoring an input (0.1.1 → 0.1.2).**
  The *Names only* preset switched `detailColumns` to blank on a mounted
  control and the details stayed: in sample mode the nodes carried the
  sample's own `details` whatever the input said, and the sample route's key
  did not include the input, so the switch could not have restarted the tree
  either. Now blank means names only in sample mode too, and the key carries
  it. The third host again — an input that changes after `init` — reaching a
  branch the form never takes, because a form's sample data is always blank.

## Demo

**`mocked`, on the control's real code since 0.2.0 — and it needs pcfhub #35
deployed first** (`dataverse.boundColumns`, and a `$select` fix). Until then
this `pcfhub.json` and `demo/accounts.json` must not reach the default branch:
the live hub would query `_value_value` and draw one node.

Through 0.1.2 the demo ran on `sampleData`, a JSON tree the control drew
instead of querying: a demo-only property in every maker's panel, and a demo
that exercised none of the code a form runs. 0.2.0 removes it (the route, the
parser, the `bad-sample` state and three strings per language) and ships
`demo/accounts.json`, a `dataverse`-only fixture for the hub's stand-in
Dataverse: twelve accounts in one tree, the form record on Contoso Deutschland
GmbH, the self-referential `parentaccountid` relationship, and
`lookupTargets`/`boundColumns` so an empty lookup still names its table and the
bound property names its real column.

The control takes the **fallback route** there, exactly as on a lookup nobody
marked hierarchical: the stand-in reports `IsHierarchical: false` and answers no
FetchXML. So the demo walks up with `retrieveRecord`, asks for children with an
OData `$filter`, and draws no child-count badge on a node until it is opened.

Watched 2026-09-24 in the hub's harness (`npm run dev:demo-harness` on the #35
branch, this bundle served locally): the chain Contoso Holdings → Contoso
Europe → *This record* with its three branches and their details; expanding
Contoso Berlin loads its two; *A long branch* shows "Showing the first 1." and
Show all children on the ancestors.

**What running it found, in the hub rather than here:** the stand-in answered
`$select=parentaccountid` with `parentaccountid: null` instead of
`_parentaccountid_value`, so every row read through `$select` lost its parent
and the walk stopped at Contoso Europe. Fixed in #35. The control was right —
the real Web API does rename a selected lookup — which is the kind of thing only
running the real code against a stand-in could find.

What it cannot show, and `demo.limitations` says so: the FetchXML route and its
counts, a different record per preset (one fixture, one form record — the top
and a leaf are in the screenshots), a card click, and the platform's own
formatted values.

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

## Walkthrough — 0.1.0 on the form, 2026-09-18

The built control, imported over the probe on the same Accounts form, bound to
*Parent Account*. Each row is something the rig showed and the form had to
confirm. Two rows found defects the rig and the screenshots had both missed —
both about the control's *width on a form*, which no rig models and the
screenshots were taken too wide to show — and 0.1.1 carries the fixes, so
0.1.1 is the first release.

| # | On the form | Expected | Answer |
| --- | --- | --- | --- |
| W1 | Open *City Power & Light (sample)* | Blue Yonder Airlines above it (badge 3), City Power marked *This record* with badge 1, its one child beneath, collapsed with a chevron | As expected, except the child (Fabrikam) arrived open rather than collapsed — `initialDepth` 1 opens the current record's children, which is what the docs say; the expectation here was misworded. |
| W2 | Press *Show all children* under Blue Yonder | City Power's two siblings appear beside it, by name; City Power keeps its mark and its child | Yes — Alpine Ski House (1) above, Coho Winery below, by name; City Power kept its mark, its badge and Fabrikam. |
| W3 | Press the chevron on the child | Its children load (or the chevron goes and no note appears if the count was 0 — it should not be 0, the badge said 1) | Yes — Alpine Ski House opened to Adventure Works. |
| W4 | Click a sibling's name | The form navigates to that record and the control redraws around it | Yes. |
| W5 | Set *Detail columns* to `address1_city, revenue` and reload | City and formatted revenue under each name; a record with neither shows no second line | **Nothing appeared.** The control's column on the form is about 280px wide, and 0.1.0 hid the detail lines below 480px — a rule written for a phone that fired on every two-column section. 0.1.1 never hides them; narrow only tightens the indent. **Confirmed on the form, 2026-09-18.** |
| W6 | Open a **new** account (unsaved) | *Save the record to see its hierarchy.* — then save, and the tree appears | The tree appeared after the save, as a single marked row with *No child records.* — **but 26px right of the form's other fields**: every row reserved a chevron column to the left of its card, so the top row's card never lined up with the label. 0.1.1 makes the row the surface with the chevron inside it, as Fluent's Tree does. **Confirmed on the form, 2026-09-18.** |
| W7 | Bind a second instance to *Master ID* (`masterid`, not hierarchical) on the same form | The tree still draws, with chevrons on every node and no badges: the fallback route | Not run — *Master ID* is the merge lookup, read-only and usually off the form. The route's two halves were measured separately (P5 answers `false` for it; P12 is the OData it would send), so this would confirm the drawing only. Left open. |

## Screenshots

Headless Chrome against `dev/preview.html` on the harness server
(`npm run harness -- --port 8096 --no-open`), at
`--force-device-scale-factor=2 --virtual-time-budget=4000 --hide-scrollbars`;
the page's `?width=` sets the width the host allocates and the root's, and
the window is 32 wider for the page's padding:

| File | Query | Window |
| --- | --- | --- |
| `screenshot.png` | `?width=760` | 792×300 |
| `screenshot-expanded.png` | `?showall=p1&expand=k1&width=760` | 792×380 |
| `screenshot-fallback.png` | `?hierarchical=false&width=760` | 792×300 |
| `screenshot-dark.png` | `?dark=1&showall=p1&width=760` | 792×330 |
| `screenshot-narrow.png` | `?width=300&depth=2` | 332×380 |

Heights are `document.body.scrollHeight` read off the page first. New file
names on every retake — the hub's mirror never re-fetches a path. The logo is
`media/logo.svg` in an `<img>` at 256 on a transparent body with
`--default-background-color=00000000`, checked RGBA by reading the IHDR.

## Promoting a finding

When something here turns out to be general — true of PCF rather than true of
this control — move it to the skill's `references/control-patterns.md` and
replace it here with a line naming where it went.
