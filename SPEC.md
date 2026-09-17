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

**Environment:** the Accounts form on the `cll365` test environment, the control
bound to *Parent Account* (`parentaccountid`), on an account with a parent, a
grandparent, a sibling and at least two children.

| # | Question | Decides | Answer |
| --- | --- | --- | --- |
| P1 | Does `context.webAPI.retrieveMultipleRecords(entity, '?fetchXml=…')` accept a FetchXML query, and does it want the XML URL-encoded or raw? What is the error shape of the loser? | `queryString()` in `query/fetchXml.ts` | *pending* |
| P2 | Do rows returned from a FetchXML query carry `@OData.Community.Display.V1.FormattedValue` annotations, and `_parentaccountid_value` for the lookup? | `toNode()` reads formatted values | *pending* |
| P3 | Does `<attribute name='accountid' rowaggregate='CountChildren' alias='children'/>` come back, as a number or a string, and does it coexist with plain attributes without `aggregate='true'`? | the child-count badge, or its absence | *pending* |
| P4 | `eq-or-above` on a self-referential lookup that is **not** hierarchical (`masterid` on account): the `errorCode` and `message` | the rig's refusal shape; whether a pre-check is needed at all | *pending* |
| P5 | A same-origin `fetch` of `EntityDefinitions(LogicalName='account')/OneToManyRelationships?$select=…,IsHierarchical`: status, elapsed, `IsHierarchical` true for `parentaccountid` and false for `masterid`; is `page.getClientUrl` present on a field control | `isHierarchical()` | *pending* |
| P6 | The keys of `parameters.value` and of its `attributes` on a bound `Lookup.Simple`; is `attributes.LogicalName === 'parentaccountid'`; what is `type` | `resolveBoundColumn()` | *pending* |
| P7 | `mode.contextInfo.entityId` on a saved record (braces? case?) and on an unsaved one | the *save the record first* state | *pending* |
| P8 | `navigation.openForm({ entityName, entityId })` from a field control: present, navigates, what it resolves with | a card click | *pending* |
| P9 | `getTargetEntityType()` returns `account`; `raw[0].entityType` agrees; `getViewId()` | `resolveTarget()` | *pending* |
| P10 | With a FetchXML query and `maxPageSize = 1` on a node with two children: one row, and is `nextLink` or `fetchXmlPagingCookie` set | the *showing the first N* notice | *pending* |
| P11 | `utils.getEntityMetadata('account')`: `PrimaryIdAttribute`, `PrimaryNameAttribute`, elapsed | the title column and the primary key | *pending* |
| P12 | The fallback route: OData `$filter=_parentaccountid_value eq <id>` returns the children with formatted values; `retrieveRecord(parent, '?$select=…')` returns the parent | `childrenOData()`, the ancestor walk | *pending* |
| P13 | `under` on the current record: the descendant count, as a sanity check on the tree the form shows | nothing — a cross-check | *pending* |

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

## Demo

`mocked`. The control's whole content comes from `context.webAPI`, which the
hub's harness does not supply, so a demo that ran the control as-is would show
its *not available on this host* state and nothing else. `sampleData` exists
for this: a JSON tree the control renders instead of querying, documented as
demo-only, and each preset carries one. What the demo cannot show: a card click
(`openForm` has no form to open there), which of the two routes a real form
would take, and formatted values (the preset's are literal strings).

## Not verified

- Every row of the table above until its *Answer* is filled in.
- An on-premises organisation URL with the organisation in the path
  (`https://host/org/api/data/…`) — `page.getClientUrl()` is preferred over a
  root-relative URL for that reason, following Data Table 0.5.0, but no
  on-premises environment has been tried.
- The phone client and Power Pages.
- A hierarchy deeper than the platform's 100-recursion limit for hierarchical
  operators, and a node with more than 5,000 children.

## Promoting a finding

When something here turns out to be general — true of PCF rather than true of
this control — move it to the skill's `references/control-patterns.md` and
replace it here with a line naming where it went.
